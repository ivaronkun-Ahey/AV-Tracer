import { Device, Connection, SimulationResult, SignalFlow, SimIssue } from '../types/device.types';
import { cableMaxLength } from '../data/cables';

/**
 * Клиентский движок симуляции — точный аналог backend/app/services/engine.py.
 * Используется как резерв, когда Python-сервер недоступен, чтобы функция
 * «Симуляция» работала всегда. Совпадение результатов двух движков проверяют
 * общие тестовые схемы из shared/sim-fixtures.
 */

/** Нормальный линейный уровень (дБu) на входе усилителя или активной АС. */
export const LINE_MIN_DBU = -10;
export const LINE_MAX_DBU = 20;

interface Hop {
  id: string;
  to: string;
  from_port: string;
  to_port: string;
}
type Graph = Record<string, Hop[]>;
type Domain = 'audio' | 'video';

const AUDIO_SOURCES = ['microphone', 'array_microphone', 'wireless_mic'];
const VIDEO_SOURCES = ['camera', 'media_player'];
const AUDIO_SINKS = ['speaker', 'subwoofer'];
const VIDEO_SINKS = ['display', 'projector'];
// Каскады с регулируемым усилением: предусилитель входа + выходной уровень
const GAIN_STAGES = ['mixer', 'dsp', 'audio_interface'];

// Уровень микрофона без указанной чувствительности, дБu
const MIC_LEVEL_DBU = -50;
// Цифровой выход Dante микрофонного массива — номинальный линейный уровень, дБu
const ARRAY_MIC_LEVEL_DBU = 4;
// Перевод дБВ (чувствительность микрофона) в дБu
const DBV_TO_DBU = 2.2;

// Сигналы, которые устройство «понимает» как аудио или видео
const NATIVE: Record<Domain, Set<string>> = {
  audio: new Set(['analog_audio', 'digital_audio', 'usb']),
  video: new Set(['hdmi', 'sdi', 'video']),
};
// Сигналы, по которым аудио или видео идёт по кабелю (включая IP: Dante, AV-over-IP)
const TRANSPORT: Record<Domain, Set<string>> = {
  audio: new Set(['analog_audio', 'digital_audio', 'usb', 'network']),
  video: new Set(['hdmi', 'sdi', 'video', 'network']),
};

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
  speaker: 'колонка',
  subwoofer: 'сабвуфер',
  display: 'дисплей',
  projector: 'проектор',
};
const ACTIVE_RU: Record<string, string> = { speaker: 'активная колонка', subwoofer: 'активный сабвуфер' };
const PASSIVE_RU: Record<string, string> = { speaker: 'пассивная колонка', subwoofer: 'пассивный сабвуфер' };

const RES_ALIASES: Array<[string, number, number]> = [
  ['8k', 7680, 4320],
  ['4k', 3840, 2160],
  ['uhd', 3840, 2160],
  ['2160p', 3840, 2160],
  ['1440p', 2560, 1440],
  ['wuxga', 1920, 1200],
  ['1200p', 1920, 1200],
  ['fhd', 1920, 1080],
  ['1080p', 1920, 1080],
  ['1080i', 1920, 1080],
  ['720p', 1280, 720],
];

/** Разрешение из строки: '3840x2160', '1920×1080', '4K60', '1080p' и т. п. */
export function parseResolution(value: unknown): { w: number; h: number } | null {
  if (typeof value !== 'string') return null;
  const s = value.trim().toLowerCase();
  const m = /^(\d{3,5})\s*[x×]\s*(\d{3,5})/.exec(s);
  if (m) return { w: Number(m[1]), h: Number(m[2]) };
  for (const [alias, w, h] of RES_ALIASES) {
    if (s.startsWith(alias)) return { w, h };
  }
  return null;
}

const fmtRes = (r: { w: number; h: number }) => `${r.w}×${r.h}`;
const round1 = (x: number) => Math.round(x * 10) / 10;
const portName = (portId: string) => portId.replace(/_/g, ' ').toUpperCase();

/** Число из параметра устройства; пустое/некорректное значение заменяется значением по умолчанию. */
function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function positive(value: unknown, fallback: number): number {
  const n = num(value, fallback);
  return n > 0 ? n : fallback;
}

function signalsCompatible(a: string, b: string): boolean {
  if (a === b) return true;
  return IP_SIGNALS.has(a) && IP_SIGNALS.has(b);
}

function buildGraph(connections: Connection[]): Graph {
  const graph: Graph = {};
  for (const c of connections) {
    if (!c.from?.device) continue;
    (graph[c.from.device] ||= []).push({
      id: c.id,
      to: c.to.device,
      from_port: c.from.port,
      to_port: c.to.port,
    });
  }
  return graph;
}

function portSignal(device: Device | undefined, portId: string): string | null {
  if (!device) return null;
  return device.ports.find((p) => p.id === portId)?.signal_type ?? null;
}

/** Может ли аудио/видео пройти по кабелю hop от устройства from к устройству to. */
function hopAllowed(from: Device, hop: Hop, to: Device | undefined, domain: Domain): boolean {
  if (!to) return false;
  const fromPort = from.ports.find((p) => p.id === hop.from_port);
  if (fromPort) {
    if (!TRANSPORT[domain].has(fromPort.signal_type)) return false;
    // LAN-порт оконечного устройства служит для управления, а не для медиапотока
    if (fromPort.direction === 'bidirectional' && fromPort.signal_type === 'network' && from.type !== 'network_switch') {
      return false;
    }
  }
  if (to.type === 'network_switch' || to.ports.length === 0) return true;
  return to.ports.some((p) => NATIVE[domain].has(p.signal_type));
}

/**
 * Все ветви сигнала от источника: обход в глубину по всем кабелям (а не только
 * по первому). Каждое устройство посещается один раз; каждая ветвь — путь от
 * источника до конечного устройства.
 */
function tracePaths(sourceId: string, domain: Domain, byId: Record<string, Device>, graph: Graph): string[][] {
  const visited = new Set<string>([sourceId]);
  const paths: string[][] = [];
  const walk = (path: string[]) => {
    const node = path[path.length - 1];
    let extended = false;
    for (const hop of graph[node] || []) {
      if (visited.has(hop.to)) continue;
      if (!hopAllowed(byId[node], hop, byId[hop.to], domain)) continue;
      visited.add(hop.to);
      extended = true;
      walk([...path, hop.to]);
    }
    if (!extended) paths.push(path);
  };
  walk([sourceId]);
  return paths;
}

function startLevel(d: Device): number {
  const p = d.properties || {};
  if (d.type === 'array_microphone') return ARRAY_MIC_LEVEL_DBU;
  const base = typeof p.sensitivity === 'number' ? p.sensitivity + DBV_TO_DBU : MIC_LEVEL_DBU;
  return base - Math.abs(num(p.pad, 0));
}

function stageGain(d: Device): number {
  const p = d.properties || {};
  if (d.type === 'mixer') return num(p.input_gain, 0) + num(p.master_gain, 0);
  if (d.type === 'dsp') return num(p.input_gain, 0) + num(p.gain, 0);
  if (d.type === 'audio_interface') return num(p.input_gain, 0);
  return 0;
}

/**
 * Уровень сигнала вдоль ветви. Контрольная точка — вход первого усилителя или
 * АС (дальше уровень уже не линейный), иначе — выход последнего устройства.
 */
function analyzeAudioPath(path: string[], byId: Record<string, Device>) {
  const src = byId[path[0]];
  let level = startLevel(src);
  let measureIdx = -1;
  for (let i = 1; i < path.length; i++) {
    const t = byId[path[i]].type;
    if (t === 'amplifier' || AUDIO_SINKS.includes(t)) {
      measureIdx = i;
      break;
    }
  }
  const end = measureIdx === -1 ? path.length : measureIdx;
  let lastStage: Device | null = null;
  let clip: { device: Device; level: number } | null = null;
  for (let i = 1; i < end; i++) {
    const d = byId[path[i]];
    if (!GAIN_STAGES.includes(d.type)) continue;
    level = level + stageGain(d);
    lastStage = d;
    if (!clip && level > LINE_MAX_DBU) clip = { device: d, level };
  }
  const at = byId[measureIdx === -1 ? path[path.length - 1] : path[measureIdx]];
  const issues: SimIssue[] = [];
  if (path.length > 1) {
    const lvl = round1(level);
    if (clip) {
      issues.push({
        type: 'level_high',
        device: clip.device.id,
        message: `Перегрузка: ${round1(clip.level)} дБu на выходе «${clip.device.model}» — выше +${LINE_MAX_DBU} дБu, уменьшите усиление`,
        severity: 'medium',
      });
    } else if (level > LINE_MAX_DBU) {
      issues.push({
        type: 'level_high',
        device: at.id,
        message: `Перегрузка: ${lvl} дБu на «${at.model}» — выше +${LINE_MAX_DBU} дБu, уменьшите уровень источника`,
        severity: 'medium',
      });
    }
    if (level < LINE_MIN_DBU) {
      issues.push({
        type: 'level_low',
        device: (lastStage ?? src).id,
        message: lastStage
          ? `Слабый сигнал: ${lvl} дБu на «${at.model}» (норма ${LINE_MIN_DBU}…+${LINE_MAX_DBU} дБu) — увеличьте усиление «${lastStage.model}»`
          : `Слабый сигнал: ${lvl} дБu на «${at.model}» — микрофонный уровень нужно поднять предусилителем (микшер, DSP, аудиоинтерфейс)`,
        severity: 'medium',
      });
    }
  }
  return { level: round1(level), at: at.id, issues };
}

/** Разрешение вдоль ветви: масштабаторы меняют его, коммутаторы и приёмники проверяют. */
function analyzeVideoPath(path: string[], byId: Record<string, Device>) {
  const src = byId[path[0]];
  const srcRes = src.properties?.resolution;
  let resolution = typeof srcRes === 'string' ? srcRes : '1920x1080';
  const issues: SimIssue[] = [];
  for (let i = 1; i < path.length; i++) {
    const d = byId[path[i]];
    const p = d.properties || {};
    const sig = parseResolution(resolution);
    if (VIDEO_SINKS.includes(d.type)) {
      const native = parseResolution(p.resolution);
      if (sig && native && sig.w * sig.h > native.w * native.h) {
        issues.push({
          type: 'resolution_downscale',
          device: d.id,
          message: `Сигнал ${fmtRes(sig)} выше родного разрешения ${fmtRes(native)} у «${d.model}» — изображение будет уменьшено`,
          severity: 'low',
        });
      }
    } else {
      const max = parseResolution(p.max_resolution);
      if (sig && max && sig.w * sig.h > max.w * max.h) {
        issues.push({
          type: 'resolution_unsupported',
          device: d.id,
          message: `«${d.model}» принимает до ${fmtRes(max)}, а источник выдаёт ${fmtRes(sig)} — понизьте разрешение источника (EDID) или поставьте масштабатор`,
          severity: 'medium',
        });
      }
      if (typeof p.resolution_out === 'string' && p.resolution_out) resolution = p.resolution_out;
    }
  }
  return { resolution, issues };
}

export function runSimulation(devices: Device[], connections: Connection[]): SimulationResult {
  const byId: Record<string, Device> = {};
  for (const d of devices) byId[d.id] = d;
  const graph = buildGraph(connections);
  const incoming = (id: string) => connections.filter((c) => c.to.device === id);

  const warnings: SimIssue[] = [];
  const errors: SimIssue[] = [];
  // Одна и та же проблема на общем участке нескольких ветвей выводится один раз
  const seen = new Set<string>();
  const addFlowWarning = (issue: SimIssue) => {
    const key = `${issue.type}|${issue.device}`;
    if (seen.has(key)) return;
    seen.add(key);
    warnings.push(issue);
  };

  // --- Аудиоцепочки: все ветви от каждого источника ---
  const audioFlows: SignalFlow[] = [];
  for (const d of devices) {
    if (!AUDIO_SOURCES.includes(d.type)) continue;
    for (const path of tracePaths(d.id, 'audio', byId, graph)) {
      const r = analyzeAudioPath(path, byId);
      r.issues.forEach(addFlowWarning);
      audioFlows.push({
        type: 'audio',
        source: d.id,
        path,
        final_level_db: r.level,
        level_at: r.at,
        status: r.issues.length ? 'warning' : 'ok',
      });
    }
  }

  // --- Видеоцепочки (с учётом масштабирования и поддерживаемого разрешения) ---
  const videoFlows: SignalFlow[] = [];
  for (const d of devices) {
    if (!VIDEO_SOURCES.includes(d.type)) continue;
    for (const path of tracePaths(d.id, 'video', byId, graph)) {
      const r = analyzeVideoPath(path, byId);
      r.issues.forEach(addFlowWarning);
      videoFlows.push({
        type: 'video',
        source: d.id,
        path,
        resolution: r.resolution,
        status: r.issues.length ? 'warning' : 'ok',
      });
    }
  }

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
        connection: c.id,
        message: `Несовместимые сигналы: ${SIG_RU[fromSig] || fromSig} → ${SIG_RU[toSig] || toSig}`,
        severity: 'high',
      });
    }
  }

  // В один вход (или Ethernet-порт) подключено несколько кабелей
  for (const d of devices) {
    for (const port of d.ports) {
      if (port.direction === 'output') continue;
      const using = connections.filter(
        (c) =>
          (c.to.device === d.id && c.to.port === port.id) ||
          (port.direction === 'bidirectional' && c.from.device === d.id && c.from.port === port.id)
      );
      if (using.length > 1) {
        errors.push({
          type: 'input_busy',
          device: d.id,
          connection: using[using.length - 1].id,
          message: `К порту ${portName(port.id)} устройства «${d.model}» подключено несколько кабелей (${using.length}) — в разъём входит только один`,
          severity: 'high',
        });
      }
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
          message: `«${d.model}» — ${ACTIVE_RU[d.type]} со встроенным усилителем: к выходу усилителя мощности не подключается, подайте линейный сигнал`,
          severity: 'high',
        });
      } else if (active === false && from.type !== 'amplifier') {
        errors.push({
          type: 'passive_no_amp',
          device: d.id,
          message: `«${d.model}» — ${PASSIVE_RU[d.type]}: нужен усилитель мощности`,
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
    const ampW = num(amp.properties?.power_watts, 0);
    const minOhm = num(amp.properties?.min_impedance_ohms, 4);
    const byPort: Record<string, Device[]> = {};
    for (const c of connections) {
      if (c.from.device !== amp.id) continue;
      const sink = byId[c.to.device];
      if (!sink) continue;
      if (AUDIO_SINKS.includes(sink.type) && sink.properties?.active === false) {
        (byPort[c.from.port] ||= []).push(sink);
      }
    }
    for (const port of Object.keys(byPort)) {
      const spks = byPort[port];
      const impedances = spks.map((s) => positive(s.properties?.impedance_ohms, 8));
      const parallel = 1 / impedances.reduce((acc, z) => acc + 1 / z, 0);
      const load = round1(parallel);
      const totalHandling = spks.reduce((acc, s) => acc + num(s.properties?.power_handling_watts, 0), 0);
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
    const length = num(c.cable_length, 0);
    if (length > max) {
      warnings.push({
        type: 'cable_length',
        device: c.from.device,
        connection: c.id,
        message: `Кабель ${String(c.cable_type).toUpperCase()} ${length} м превышает рекомендуемые ${max} м — возможны потери сигнала`,
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
        message: `На вход «${d.model}» (${SINK_RU[d.type] || d.type}) не подан сигнал — подключите источник`,
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
