import { Device, Connection, SimulationResult, SignalFlow, SimIssue } from '../types/device.types';
import { cableMaxLength } from '../data/cables';

/**
 * Клиентский движок симуляции — точный аналог backend/app/services/engine.py.
 * Используется как резерв, когда Python-сервер недоступен, чтобы функция
 * «Симуляция» работала всегда, без обязательного запуска бэкенда.
 */

interface Hop {
  to: string;
  from_port: string;
  to_port: string;
}
type Graph = Record<string, Hop[]>;

const AUDIO_SOURCES = ['microphone', 'array_microphone', 'wireless_mic'];
const VIDEO_SOURCES = ['camera', 'media_player'];
const AUDIO_SINKS = ['speaker', 'subwoofer'];
const VIDEO_SINKS = ['display', 'projector'];

// Сигналы, физически передаваемые по сети/IP (Dante, AV-over-IP).
const IP_SIGNALS = new Set(['network', 'digital_audio']);

const SIG_RU: Record<string, string> = {
  analog_audio: 'аналог. аудио',
  digital_audio: 'цифр. аудио',
  video: 'видео',
  hdmi: 'HDMI',
  sdi: 'SDI',
  network: 'сеть',
  control: 'управление',
  usb: 'USB',
};

const SINK_RU: Record<string, string> = {
  speaker: 'Колонка',
  subwoofer: 'Сабвуфер',
  display: 'Дисплей',
  projector: 'Проектор',
};

function signalsCompatible(a: string, b: string): boolean {
  if (a === b) return true;
  return IP_SIGNALS.has(a) && IP_SIGNALS.has(b);
}

function buildGraph(connections: Connection[]): Graph {
  const graph: Graph = {};
  for (const c of connections) {
    if (!c.from?.device) continue;
    (graph[c.from.device] ||= []).push({
      to: c.to.device,
      from_port: c.from.port,
      to_port: c.to.port,
    });
  }
  return graph;
}

function nextHop(graph: Graph, node: string): string | null {
  const hops = graph[node];
  if (!hops || hops.length === 0) return null;
  return hops[0].to || null;
}

function portSignal(device: Device | undefined, portId: string): string | null {
  if (!device) return null;
  return device.ports.find((p) => p.id === portId)?.signal_type ?? null;
}

function startLevel(type: string): number {
  return type === 'wireless_mic' ? -50.0 : -60.0;
}

function processAudio(device: Device, level: number): number {
  const p = device.properties || {};
  if (device.type === 'mixer') return level + (p.gain ?? p.master_gain ?? 0);
  if (device.type === 'amplifier') return level + (p.gain ?? 20);
  if (device.type === 'dsp') return level + (p.gain ?? 0);
  return level;
}

export function runSimulation(devices: Device[], connections: Connection[]): SimulationResult {
  const byId: Record<string, Device> = {};
  for (const d of devices) byId[d.id] = d;
  const graph = buildGraph(connections);
  const incoming = (id: string) => connections.filter((c) => c.to.device === id);

  // --- Аудиоцепочки ---
  const audioFlows: SignalFlow[] = [];
  for (const d of devices) {
    if (!AUDIO_SOURCES.includes(d.type)) continue;
    let level = startLevel(d.type);
    const path = [d.id];
    let current = d.id;
    const visited = new Set<string>();
    while (!visited.has(current)) {
      visited.add(current);
      const next = nextHop(graph, current);
      if (!next || !byId[next]) break;
      level = processAudio(byId[next], level);
      path.push(next);
      current = next;
    }
    audioFlows.push({
      type: 'audio',
      source: d.id,
      path,
      final_level_db: Math.round(level * 10) / 10,
      status: level >= -10 && level <= 10 ? 'ok' : 'warning',
    });
  }

  // --- Видеоцепочки (с учётом масштабирования разрешения) ---
  const videoFlows: SignalFlow[] = [];
  for (const d of devices) {
    if (!VIDEO_SOURCES.includes(d.type)) continue;
    const path = [d.id];
    let resolution = (d.properties || {}).resolution ?? '1920x1080';
    let current = d.id;
    const visited = new Set<string>();
    while (!visited.has(current)) {
      visited.add(current);
      const next = nextHop(graph, current);
      if (!next || !byId[next]) break;
      const nextDev = byId[next];
      if (nextDev.properties?.resolution_out) resolution = nextDev.properties.resolution_out;
      path.push(next);
      current = next;
    }
    videoFlows.push({ type: 'video', source: d.id, path, resolution, status: 'ok' });
  }

  const warnings: SimIssue[] = [];
  const errors: SimIssue[] = [];

  // Фантомное питание для устройств, которым оно требуется
  for (const d of devices) {
    if (d.specs?.requires_phantom && d.properties?.phantom_power === false) {
      warnings.push({
        type: 'phantom_power',
        device: d.id,
        message:
          d.type === 'microphone'
            ? 'Конденсаторному микрофону требуется фантомное питание (+48V)'
            : 'Устройству требуется фантомное питание (+48V)',
        severity: 'medium',
      });
    }
  }

  // Несовместимость сигналов на соединении (актуально для загруженных файлов)
  for (const c of connections) {
    const fromSig = portSignal(byId[c.from.device], c.from.port);
    const toSig = portSignal(byId[c.to.device], c.to.port);
    if (fromSig && toSig && !signalsCompatible(fromSig, toSig)) {
      errors.push({
        type: 'signal_mismatch',
        device: c.from.device,
        message: `Несовместимые сигналы: ${SIG_RU[fromSig] || fromSig} → ${SIG_RU[toSig] || toSig}`,
        severity: 'high',
      });
    }
  }

  // Активные/пассивные АС и сабвуферы относительно усилителя
  for (const d of devices) {
    if (!AUDIO_SINKS.includes(d.type)) continue;
    const active = d.properties?.active;
    for (const c of incoming(d.id)) {
      const from = byId[c.from.device];
      if (!from) continue;
      if (active === true && from.type === 'amplifier') {
        errors.push({
          type: 'active_on_amp',
          device: d.id,
          message: `${SINK_RU[d.type]} «${d.model}» активный — его нельзя подключать к выходу усилителя, подайте линейный сигнал`,
          severity: 'high',
        });
      } else if (active === false && from.type !== 'amplifier') {
        errors.push({
          type: 'passive_no_amp',
          device: d.id,
          message: `${SINK_RU[d.type]} «${d.model}» пассивный — ему требуется усилитель мощности`,
          severity: 'high',
        });
      }
    }
  }

  // Питание PoE: устройство требует PoE, но подключено к коммутатору без PoE
  for (const d of devices) {
    const needsPoe = d.specs?.requires_poe || d.properties?.requires_poe;
    if (!needsPoe) continue;
    const links = connections.filter((c) => c.to.device === d.id || c.from.device === d.id);
    for (const c of links) {
      const otherId = c.to.device === d.id ? c.from.device : c.to.device;
      const other = byId[otherId];
      if (other?.type === 'network_switch' && other.properties?.poe === false) {
        warnings.push({
          type: 'no_poe',
          device: d.id,
          message: `«${d.model}» требует питания PoE, но коммутатор «${other.model}» его не подаёт`,
          severity: 'medium',
        });
      }
    }
  }

  // Бюджет мощности: усилитель → пассивные АС (мощность и сопротивление)
  for (const amp of devices) {
    if (amp.type !== 'amplifier') continue;
    const ampW = amp.properties?.power_watts ?? 0;
    const minOhm = amp.properties?.min_impedance_ohms ?? 4;
    const byPort: Record<string, Device[]> = {};
    for (const c of connections) {
      if (c.from.device !== amp.id) continue;
      const sink = byId[c.to.device];
      if (!sink) continue;
      if ((sink.type === 'speaker' || sink.type === 'subwoofer') && sink.properties?.active === false) {
        (byPort[c.from.port] ||= []).push(sink);
      }
    }
    for (const port of Object.keys(byPort)) {
      const spks = byPort[port];
      const impedances = spks.map((s) => s.properties?.impedance_ohms ?? 8);
      const parallel = 1 / impedances.reduce((acc, z) => acc + 1 / z, 0);
      const load = Math.round(parallel * 10) / 10;
      const totalHandling = spks.reduce((acc, s) => acc + (s.properties?.power_handling_watts ?? 0), 0);
      if (parallel + 1e-9 < minOhm) {
        errors.push({
          type: 'impedance_low',
          device: amp.id,
          message: `Нагрузка ${load} Ω на «${amp.model}» ниже минимума ${minOhm} Ω — риск перегрузки и срабатывания защиты`,
          severity: 'high',
        });
      }
      if (totalHandling > 0 && ampW > 0) {
        if (ampW > totalHandling * 2) {
          warnings.push({
            type: 'power_over',
            device: amp.id,
            message: `Усилитель ${ampW} Вт мощнее суммарной мощности АС ${totalHandling} Вт — риск повреждения на высокой громкости`,
            severity: 'medium',
          });
        } else if (ampW * 2 < totalHandling) {
          warnings.push({
            type: 'power_under',
            device: amp.id,
            message: `Усилитель ${ampW} Вт недостаточен для АС ${totalHandling} Вт — возможен клиппинг`,
            severity: 'medium',
          });
        }
      }
    }
  }

  // Длина кабеля относительно рекомендуемой для типа разъёма
  for (const c of connections) {
    const max = cableMaxLength(c.cable_type);
    if (c.cable_length > max) {
      warnings.push({
        type: 'cable_length',
        device: c.from.device,
        message: `Кабель ${String(c.cable_type).toUpperCase()} ${c.cable_length} м превышает рекомендуемые ${max} м — возможны потери сигнала`,
        severity: 'low',
      });
    }
  }

  // Приёмник сигнала без входного подключения
  for (const d of devices) {
    if ([...AUDIO_SINKS, ...VIDEO_SINKS].includes(d.type) && incoming(d.id).length === 0) {
      errors.push({
        type: 'no_input',
        device: d.id,
        message: `${SINK_RU[d.type] || d.type} «${d.model}» не подключён ко входному сигналу`,
        severity: 'high',
      });
    }
  }

  return {
    valid: errors.length === 0,
    signal_flows: [...audioFlows, ...videoFlows],
    warnings,
    errors,
    computed_by: 'local',
  };
}
