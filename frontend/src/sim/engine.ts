import { Device, Connection, SimulationResult, SignalFlow, SimIssue, SimFix } from '../types/device.types';
import { cableMaxLength } from '../data/cables';
import { buildEdges, routingMode, signalsCompatible, tracePaths, TracedPath, Domain } from './signalPaths';

/**
 * Движок симуляции AV-системы — единственный в проекте, считает в браузере.
 * Если понадобится проверка на сервере (оценки, ИИ-ассистент, API), этот же
 * модуль запускается в Node, а не переписывается на другом языке.
 * Эталонные схемы для регрессии — shared/sim-fixtures (npm run fixtures:update).
 */

/** Нормальный линейный уровень (дБu) на входе усилителя или активной АС. */
export const LINE_MIN_DBU = -10;
export const LINE_MAX_DBU = 20;
/** Номинальный профессиональный линейный уровень — цель исправления «усиление». */
const NOMINAL_DBU = 4;
/** Больше типичного предусилителя не предлагаем: значит, ошибка в схеме, а не в ручке. */
const MAX_FIX_GAIN_DB = 70;

// Компьютер и видеобар выдают звук линейного уровня (параметр output_level, дБu)
const AUDIO_SOURCES = ['microphone', 'array_microphone', 'wireless_mic', 'computer', 'video_bar'];
// DI-бокс без подключённого входа изображает инструмент (гитару, клавиши)
const DI_LEVEL_DBU = -35;
const VIDEO_SOURCES = ['camera', 'media_player', 'computer', 'document_camera', 'video_bar'];
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

const SIG_RU: Record<string, string> = {
  analog_audio: 'аналог. аудио',
  line_100v: 'линия 100 В',
  digital_audio: 'цифр. аудио',
  video: 'видео',
  hdmi: 'HDMI',
  sdi: 'SDI',
  hdbaset: 'HDBaseT',
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

function portDirection(device: Device | undefined, portId: string): string | null {
  return device?.ports.find((p) => p.id === portId)?.direction ?? null;
}

function portSignal(device: Device | undefined, portId: string): string | null {
  if (!device) return null;
  return device.ports.find((p) => p.id === portId)?.signal_type ?? null;
}

function startLevel(d: Device): number {
  const p = d.properties || {};
  if (d.type === 'array_microphone') return ARRAY_MIC_LEVEL_DBU;
  if (d.type === 'di_box') return DI_LEVEL_DBU - Math.abs(num(p.pad, 0));
  if (typeof p.output_level === 'number') return p.output_level - Math.abs(num(p.pad, 0));
  const base = typeof p.sensitivity === 'number' ? p.sensitivity + DBV_TO_DBU : MIC_LEVEL_DBU;
  return base - Math.abs(num(p.pad, 0));
}

/**
 * Усиление канала, на который пришёл сигнал: gain:<порт> (своё у каждого входа),
 * иначе общее «Усиление входа». Цифровой вход (Dante) предусилителя не имеет.
 */
export function channelGain(d: Device, entry: string | null): number {
  const p = d.properties || {};
  const own = entry ? p[`gain:${entry}`] : undefined;
  if (typeof own === 'number' && Number.isFinite(own)) return own;
  const port = entry ? d.ports.find((x) => x.id === entry) : undefined;
  if (port?.signal_type === 'digital_audio') return 0;
  return num(p.input_gain, 0);
}

/** Поле fix только когда исправление есть (без ключа со значением undefined). */
const withFix = (fix: SimFix | null | undefined | false): { fix?: SimFix } => (fix ? { fix } : {});

/** Исправление уровня: усиление канала entry так, чтобы на выходе каскада был номинал. */
function gainFix(d: Device, entry: string | null, levelOut: number, verb: string): SimFix | undefined {
  if (!entry) return undefined;
  const value = Math.round(channelGain(d, entry) + NOMINAL_DBU - levelOut);
  if (value > MAX_FIX_GAIN_DB) return undefined;
  return {
    kind: 'set_property',
    label: `${verb} усиление входа ${portName(entry)} на «${d.model}» до ${value} дБ`,
    device: d.id,
    property: `gain:${entry}`,
    value,
  };
}

function stageGain(d: Device, entry: string | null): number {
  const p = d.properties || {};
  if (d.type === 'mixer') return channelGain(d, entry) + num(p.master_gain, 0);
  if (d.type === 'dsp') return channelGain(d, entry) + num(p.gain, 0);
  if (d.type === 'audio_interface') return channelGain(d, entry);
  return 0;
}

/**
 * Уровень сигнала вдоль ветви. Контрольная точка — вход первого усилителя или
 * АС (дальше уровень уже не линейный), иначе — выход последнего устройства.
 */
function analyzeAudioPath(traced: TracedPath, byId: Record<string, Device>) {
  const path = traced.devices;
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
  let lastStage: { device: Device; entry: string | null } | null = null;
  let clip: { device: Device; entry: string | null; level: number } | null = null;
  for (let i = 1; i < end; i++) {
    const d = byId[path[i]];
    if (!GAIN_STAGES.includes(d.type)) continue;
    level = level + stageGain(d, traced.entries[i]);
    lastStage = { device: d, entry: traced.entries[i] };
    if (!clip && level > LINE_MAX_DBU) clip = { device: d, entry: traced.entries[i], level };
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
        ...withFix(gainFix(clip.device, clip.entry, clip.level, 'Уменьшить')),
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
        device: (lastStage?.device ?? src).id,
        message: lastStage
          ? `Слабый сигнал: ${lvl} дБu на «${at.model}» (норма ${LINE_MIN_DBU}…+${LINE_MAX_DBU} дБu) — увеличьте усиление «${lastStage.device.model}»`
          : `Слабый сигнал: ${lvl} дБu на «${at.model}» — микрофонный уровень нужно поднять предусилителем (микшер, DSP, аудиоинтерфейс)`,
        severity: 'medium',
        ...withFix(lastStage && gainFix(lastStage.device, lastStage.entry, level, 'Поднять')),
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
  // Кто задаёт текущее разрешение: источник (resolution) или масштабатор (resolution_out)
  let setBy = { device: src, property: 'resolution' };
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
          fix: {
            kind: 'set_property',
            label: `Выставить на «${setBy.device.model}» разрешение ${fmtRes(max)}`,
            device: setBy.device.id,
            property: setBy.property,
            value: fmtRes(max).replace('×', 'x'),
          },
        });
      }
      if (typeof p.resolution_out === 'string' && p.resolution_out) {
        resolution = p.resolution_out;
        setBy = { device: d, property: 'resolution_out' };
      }
    }
  }
  return { resolution, issues };
}

export function runSimulation(devices: Device[], connections: Connection[]): SimulationResult {
  const byId: Record<string, Device> = {};
  for (const d of devices) byId[d.id] = d;
  const edges = buildEdges(byId, connections);
  const incoming = (id: string) => connections.filter((c) => c.to.device === id);
  const isAudioSource = (d: Device) =>
    AUDIO_SOURCES.includes(d.type) || (d.type === 'di_box' && incoming(d.id).length === 0);

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

  // Фантомное питание подаёт вход, к которому подключено устройство (микшер,
  // аудиоинтерфейс, DSP), а не сам микрофон: проверяем каждый его XLR-кабель
  const phantomMissing = new Set<string>();
  for (const d of devices) {
    if (!d.specs?.requires_phantom) continue;
    for (const c of connections) {
      if (c.from.device !== d.id || d.ports.find((p) => p.id === c.from.port)?.type !== 'xlr') continue;
      const r = byId[c.to.device];
      if (!r) continue;
      const perPort = r.properties?.[`phantom:${c.to.port}`];
      const deviceWide = r.properties?.phantom_power;
      if (perPort === true || (perPort === undefined && deviceWide === true)) continue;
      phantomMissing.add(d.id);
      const canSupply = typeof perPort === 'boolean' || typeof deviceWide === 'boolean';
      // Свой переключатель у входа — включаем его, иначе общий +48V устройства
      const property = typeof perPort === 'boolean' ? `phantom:${c.to.port}` : 'phantom_power';
      errors.push({
        type: 'phantom_power',
        device: d.id,
        connection: c.id,
        message: canSupply
          ? `Для «${d.model}» нужно фантомное питание +48 В, но на «${r.model}» оно выключено — включите его на «${r.model}»`
          : `Для «${d.model}» нужно фантомное питание +48 В, а «${r.model}» не может его подать — подключите через микшер, предусилитель или блок питания +48 В`,
        severity: 'high',
        ...withFix(
          canSupply && { kind: 'set_property', label: `Включить +48 В на «${r.model}»`, device: r.id, property, value: true }
        ),
      });
    }
  }

  // --- Аудиоцепочки: все ветви от каждого источника, по портам и каналам ---
  const audioFlows: SignalFlow[] = [];
  // Где и почему ветвь остановилась (для подсказки «нет сигнала») и как это исправить
  const blocked = new Map<string, { note: string; fix?: SimFix }>();
  const noteBlocked = (traced: TracedPath) => {
    if (!traced.blockedAt || !traced.note || blocked.has(traced.blockedAt)) return;
    const router = byId[traced.blockedAt];
    const entry = traced.entries[traced.entries.length - 1];
    const index = router.ports.filter((p) => p.direction === 'input').findIndex((p) => p.id === entry) + 1;
    const fix: SimFix | undefined =
      routingMode(router) === 'select' && index > 0
        ? {
            kind: 'set_property',
            label: `Выбрать вход ${index} на «${router.model}»`,
            device: router.id,
            property: 'selected_input',
            value: index,
          }
        : undefined;
    blocked.set(traced.blockedAt, { note: traced.note, ...withFix(fix) });
  };
  for (const d of devices) {
    if (!isAudioSource(d)) continue;
    for (const traced of tracePaths(d.id, 'audio', byId, edges)) {
      const r = analyzeAudioPath(traced, byId);
      r.issues.forEach(addFlowWarning);
      noteBlocked(traced);
      const unpowered = phantomMissing.has(d.id);
      audioFlows.push({
        type: 'audio',
        source: d.id,
        path: traced.devices,
        entry_ports: traced.entries,
        final_level_db: r.level,
        level_at: r.at,
        status: unpowered ? 'error' : r.issues.length ? 'warning' : 'ok',
        ...(unpowered ? { note: 'нет фантомного питания — микрофон не работает' } : traced.note ? { note: traced.note } : {}),
      });
    }
  }

  // --- Видеоцепочки (с учётом масштабирования и поддерживаемого разрешения) ---
  const videoFlows: SignalFlow[] = [];
  for (const d of devices) {
    if (!VIDEO_SOURCES.includes(d.type)) continue;
    for (const traced of tracePaths(d.id, 'video', byId, edges)) {
      const r = analyzeVideoPath(traced.devices, byId);
      r.issues.forEach(addFlowWarning);
      noteBlocked(traced);
      videoFlows.push({
        type: 'video',
        source: d.id,
        path: traced.devices,
        entry_ports: traced.entries,
        resolution: r.resolution,
        status: r.issues.length ? 'warning' : 'ok',
        ...(traced.note ? { note: traced.note } : {}),
      });
    }
  }

  // Какие приёмники действительно получают сигнал от источника
  const reached: Record<Domain, Set<string>> = { audio: new Set(), video: new Set() };
  for (const f of [...audioFlows, ...videoFlows]) f.path.slice(1).forEach((id) => reached[f.type].add(id));

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
        fix: { kind: 'remove_connection', label: `Отключить кабель ${c.label ?? ''}`.trim(), connection: c.id },
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
          fix: {
            kind: 'remove_connection',
            label: `Отключить лишний кабель ${using[using.length - 1].label ?? ''}`.trim(),
            connection: using[using.length - 1].id,
          },
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
      // Громкоговоритель 100 В питается от линии: от усилителя или по проходным клеммам соседнего
      if (d.ports.find((p) => p.id === c.to.port)?.signal_type === 'line_100v') continue;
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
      // Выход на трансляционную линию считается отдельно — по отводам громкоговорителей
      if (amp.ports.find((p) => p.id === c.from.port)?.signal_type === 'line_100v') continue;
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

  // Трансляционная линия 70/100 В: громкоговорители с трансформаторами включены
  // параллельно (по проходным клеммам), нагрузка — сумма отводов; её держат не
  // больше 80 % мощности канала. Отводы заданы для 100 В: на 70 В мощность
  // каждого — в (70/100)² ≈ 2 раза меньше.
  for (const amp of devices) {
    if (amp.type !== 'amplifier') continue;
    const ampW = num(amp.properties?.power_watts, 0);
    const voltage = num(amp.properties?.line_voltage, 100);
    const factor = (voltage / 100) ** 2;
    for (const out of amp.ports.filter((p) => p.signal_type === 'line_100v' && p.direction === 'output')) {
      const speakers: Device[] = [];
      const seen = new Set<string>([amp.id]);
      const queue = connections.filter((c) => c.from.device === amp.id && c.from.port === out.id).map((c) => c.to.device);
      while (queue.length) {
        const id = queue.shift()!;
        const d = byId[id];
        if (!d || seen.has(id)) continue;
        seen.add(id);
        speakers.push(d);
        for (const c of connections) {
          if (c.from.device === id && d.ports.find((p) => p.id === c.from.port)?.signal_type === 'line_100v') queue.push(c.to.device);
        }
      }
      if (speakers.length === 0) continue;
      const line = `${amp.tag ?? amp.model} · ${out.id.replace('line100_out', 'выход').replace('_', ' ')}`;
      for (const s of speakers.filter((x) => !(num(x.properties?.tap_watts, 0) > 0))) {
        warnings.push({
          type: 'tap_missing',
          device: s.id,
          message: `У «${s.model}» не выбран отвод трансформатора — нагрузку линии «${line}» не посчитать`,
          severity: 'medium',
        });
      }
      const total = round1(speakers.reduce((acc, x) => acc + num(x.properties?.tap_watts, 0), 0) * factor);
      if (ampW <= 0 || total <= 0) continue;
      const of = `${total} Вт на ${speakers.length} громкоговорител${speakers.length === 1 ? 'ь' : speakers.length < 5 ? 'я' : 'ей'}`;
      const at70 = voltage !== 100 ? ` (на ${voltage} В отводы дают в ${round1(1 / factor)} раза меньше мощности)` : '';
      if (total > ampW) {
        errors.push({
          type: 'line_overload',
          device: amp.id,
          message: `Линия ${voltage} В «${line}»: сумма отводов ${of} больше мощности канала ${ampW} Вт — усилитель перегружен${at70}; уменьшите отводы или разделите громкоговорители на две линии`,
          severity: 'high',
        });
      } else if (total > ampW * 0.8) {
        warnings.push({
          type: 'line_headroom',
          device: amp.id,
          message: `Линия ${voltage} В «${line}»: сумма отводов ${of} — больше 80 % мощности канала ${ampW} Вт, запаса почти нет${at70}`,
          severity: 'low',
        });
      }
    }
  }

  // Длина кабеля относительно рекомендуемой для типа разъёма
  for (const c of connections) {
    const max = cableMaxLength(c.cable_type);
    const length = num(c.cable_length, 0);
    if (length > max) {
      // HDMI или USB между помещениями — типичная ошибка: для таких трасс есть удлинители
      const fromRoom = byId[c.from.device]?.room;
      const toRoom = byId[c.to.device]?.room;
      const betweenRooms = !!fromRoom && !!toRoom && fromRoom !== toRoom;
      const advice =
        betweenRooms && (c.cable_type === 'hdmi' || c.cable_type === 'usb')
          ? ' — между помещениями используйте HDBaseT-удлинитель или AV-over-IP'
          : ' — возможны потери сигнала';
      warnings.push({
        type: 'cable_length',
        device: c.from.device,
        connection: c.id,
        message: `Кабель ${String(c.cable_type).toUpperCase()} ${length} м превышает рекомендуемые ${max} м${advice}`,
        severity: 'low',
      });
    }
  }

  // Приёмник без кабеля на входе — и приёмник, до которого не доходит сигнал источника
  const upstream = (id: string): Set<string> => {
    const found = new Set<string>();
    const queue = [id];
    while (queue.length) {
      const cur = queue.shift()!;
      for (const c of connections) {
        // Вверх по течению: по кабелю против направления; связь двух
        // двунаправленных портов (коммутатор ↔ коммутатор) — в обе стороны
        const bothWays =
          portDirection(byId[c.from.device], c.from.port) === 'bidirectional' &&
          portDirection(byId[c.to.device], c.to.port) === 'bidirectional';
        const prev = c.to.device === cur ? c.from.device : bothWays && c.from.device === cur ? c.to.device : null;
        if (prev && prev !== id && !found.has(prev) && byId[prev]) {
          found.add(prev);
          queue.push(prev);
        }
      }
    }
    return found;
  };
  for (const d of devices) {
    const domain: Domain | null = AUDIO_SINKS.includes(d.type) ? 'audio' : VIDEO_SINKS.includes(d.type) ? 'video' : null;
    if (!domain) continue;
    if (incoming(d.id).length === 0) {
      errors.push({
        type: 'no_input',
        device: d.id,
        message: `На вход «${d.model}» (${SINK_RU[d.type] || d.type}) не подан сигнал — подключите источник`,
        severity: 'high',
      });
      continue;
    }
    if (reached[domain].has(d.id)) continue;
    const up = [...upstream(d.id)];
    const block = up.map((id) => blocked.get(id)).find(Boolean);
    const blockNote = block?.note;
    const hasSource = up.some((id) => (domain === 'audio' ? isAudioSource(byId[id]) : VIDEO_SOURCES.includes(byId[id].type)));
    // Ближайшее по цепочке устройство, которое коммутирует сигнал не «на все выходы»
    const router = up.map((id) => byId[id]).find((x) => routingMode(x) !== 'all' && x.ports.length > 0);
    const ROUTER_HINT = {
      select: 'проверьте выбранный вход на',
      matrix: 'проверьте таблицу коммутации (вход>выход) на',
      channel: 'проверьте, что вход и выход в одном канале (L/R, 1/2) на',
    } as const;
    const hint = blockNote
      ? blockNote
      : !hasSource
        ? `в подключённой цепочке нет источника (${domain === 'audio' ? 'микрофона, радиосистемы, компьютера' : 'камеры, плеера, компьютера'})`
        : router && routingMode(router) !== 'all'
          ? `${ROUTER_HINT[routingMode(router) as keyof typeof ROUTER_HINT]} «${router.model}»`
          : 'сигнал теряется по дороге — проверьте, что кабели идут в порты с этим сигналом (Ethernet-порт управления видео и звук не передаёт)';
    errors.push({
      type: 'no_signal',
      device: d.id,
      message: `На «${d.model}» не приходит ${domain === 'audio' ? 'звук' : 'видео'}: ${hint}`,
      severity: 'high',
      ...withFix(block?.fix),
    });
  }

  return {
    valid: errors.length === 0,
    signal_flows: [...audioFlows, ...videoFlows],
    warnings,
    errors,
  };
}
