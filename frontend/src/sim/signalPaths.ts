import { Connection, Device, Port, RoutingMode } from '../types/device.types';

/**
 * Прохождение сигнала по схеме на уровне портов.
 *
 * Сигнал описывается состоянием «устройство + порт, через который он вошёл».
 * Кабель передаёт сигнал, только если оба его конца несут этот вид сигнала
 * (аудио/видео), а устройство пропускает сигнал со входа только на те выходы,
 * которые разрешают его правила коммутации (routing): все выходы, тот же канал,
 * выбранный вход или таблица матрицы. Ethernet-порт оконечного устройства —
 * это управление, а не медиапоток: через него сигнал не входит и не выходит.
 */

export type Domain = 'audio' | 'video';

export interface TracedPath {
  /** Устройства по порядку, от источника. */
  devices: string[];
  /** Порт, через который сигнал вошёл в устройство (у источника — null). */
  entries: (string | null)[];
  /** Почему ветвь закончилась раньше: например, вход не выбран на коммутаторе. */
  note?: string;
  /** Устройство, остановившее ветвь (для подсказок «нет сигнала»). */
  blockedAt?: string;
}

interface Edge {
  connection: string;
  fromPort: string;
  to: string;
  toPort: string;
}

/** Предел ветвей на один источник — защита от взрывного роста в плотных сетях. */
const MAX_PATHS_PER_SOURCE = 128;
const MAX_STEPS_PER_SOURCE = 20000;

const DEFAULT_ROUTING: Record<string, RoutingMode> = {
  amplifier: 'channel',
  di_box: 'channel',
  switcher: 'select',
  scaler: 'select',
};

export function routingMode(device: Device): RoutingMode {
  const fromSpecs = device.specs?.routing;
  if (fromSpecs === 'all' || fromSpecs === 'channel' || fromSpecs === 'select' || fromSpecs === 'matrix') return fromSpecs;
  return DEFAULT_ROUTING[device.type] ?? 'all';
}

/** Какие виды сигнала несёт порт этого устройства. */
export function portDomains(device: Device, port: Port): Set<Domain> {
  switch (port.signal_type) {
    case 'analog_audio':
    case 'digital_audio':
    case 'line_100v':
      return new Set(['audio']);
    case 'usb':
      return new Set(['audio', 'video']);
    // HDMI, SDI и HDBaseT несут и встроенный звук: он идёт вместе с видео до
    // деэмбеддера, где выходит в аналоговый тракт
    case 'hdmi':
    case 'sdi':
    case 'hdbaset':
      return new Set(['video', 'audio']);
    case 'video':
      return new Set(['video']);
    case 'network':
      // Коммутатор передаёт любые потоки; LAN-порт оконечного устройства — управление;
      // направленный сетевой порт (кодер/декодер AV-over-IP, IP-камера) — видео.
      if (device.type === 'network_switch') return new Set(['audio', 'video']);
      if (port.direction === 'bidirectional') return new Set();
      return new Set(['video']);
    default:
      return new Set();
  }
}

const IP_SIGNALS = new Set(['network', 'digital_audio']);
export function signalsCompatible(a: string, b: string): boolean {
  return a === b || (IP_SIGNALS.has(a) && IP_SIGNALS.has(b));
}

const isOutputSide = (p: Port) => p.direction === 'output' || p.direction === 'bidirectional';
const inputsOf = (d: Device) => d.ports.filter((p) => p.direction === 'input');
const outputsOf = (d: Device) => d.ports.filter((p) => p.direction === 'output');

/** Канал порта по окончанию идентификатора: xlr_in_l → «l», speakon_out_2 → «2». */
function channelKey(portId: string): string | null {
  const m = /_(\d+|l|r)$/i.exec(portId);
  return m ? m[1].toLowerCase() : null;
}

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Таблица матрицы «вход>выход» (номера с 1). Пустая или ошибочная — диагональ 1>1, 2>2… */
export function matrixRoutes(device: Device): Array<[number, number]> {
  const raw = device.properties?.routes;
  const pairs: Array<[number, number]> = [];
  if (typeof raw === 'string') {
    for (const token of raw.split(/[,;]+/)) {
      const m = /^\s*(\d+)\s*(?:>|→|->|-|:)\s*(\d+)\s*$/.exec(token);
      if (m) pairs.push([Number(m[1]), Number(m[2])]);
    }
  }
  if (pairs.length > 0) return pairs;
  const n = Math.min(inputsOf(device).length, outputsOf(device).length);
  return Array.from({ length: n }, (_, i) => [i + 1, i + 1]);
}

export function selectedInput(device: Device): number {
  return Math.max(1, Math.round(num(device.properties?.selected_input, 1)));
}

export interface Transfer {
  /** Порты, через которые сигнал выходит (у «голого» устройства без описания портов — любые). */
  exits: (portId: string) => boolean;
  note?: string;
}

/**
 * Куда устройство пропускает сигнал, вошедший через порт entry
 * (entry = null — сигнал рождается в самом устройстве-источнике).
 */
export function transfer(device: Device, entry: string | null, domain: Domain): Transfer {
  // Устройство без описания портов (ручные тесты, старые файлы) — пропускает всё
  if (device.ports.length === 0) return { exits: () => true };
  const carries = (p: Port) => isOutputSide(p) && p.id !== entry && portDomains(device, p).has(domain);
  const allow = (ports: Port[]) => {
    const ids = new Set(ports.filter(carries).map((p) => p.id));
    return (id: string) => ids.has(id);
  };
  if (entry === null) return { exits: allow(device.ports) };
  // Звук, пришедший в компьютер (микрофоны видеобара по USB), уходит в звонок, а не
  // обратно на его выходы — иначе было бы эхо; видео через компьютер проходит
  if (domain === 'audio' && device.type === 'computer') return { exits: () => false };

  const mode = routingMode(device);
  if (mode === 'channel') {
    const key = channelKey(entry);
    const same = key ? device.ports.filter((p) => carries(p) && channelKey(p.id) === key) : [];
    return { exits: allow(same.length > 0 ? same : device.ports) };
  }
  if (mode === 'select') {
    const inputs = inputsOf(device);
    const index = inputs.findIndex((p) => p.id === entry) + 1;
    if (index === 0) return { exits: allow(device.ports) };
    const selected = selectedInput(device);
    if (index !== selected) {
      return {
        exits: () => false,
        note: `вход ${index} на «${device.model}» не выбран (выбран вход ${selected})`,
      };
    }
    return { exits: allow(device.ports) };
  }
  if (mode === 'matrix') {
    const inputs = inputsOf(device);
    const outputs = outputsOf(device);
    const index = inputs.findIndex((p) => p.id === entry) + 1;
    if (index === 0) return { exits: allow(device.ports) };
    const targets = matrixRoutes(device)
      .filter(([i]) => i === index)
      .map(([, o]) => outputs[o - 1])
      .filter((p): p is Port => !!p);
    if (targets.length === 0) {
      return { exits: () => false, note: `вход ${index} на «${device.model}» не скоммутирован ни на один выход` };
    }
    return { exits: allow(targets) };
  }
  return { exits: allow(device.ports) };
}

/** Может ли сигнал войти в устройство через этот порт. */
function accepts(device: Device, portId: string, domain: Domain): boolean {
  if (device.ports.length === 0) return true;
  const port = device.ports.find((p) => p.id === portId);
  return !!port && portDomains(device, port).has(domain);
}

function portOf(device: Device | undefined, portId: string): Port | undefined {
  return device?.ports.find((p) => p.id === portId);
}

/**
 * Рёбра графа: кабель ведёт от выхода ко входу; кабель между двумя
 * двунаправленными портами (коммутатор ↔ коммутатор) проходим в обе стороны.
 */
export function buildEdges(devices: Record<string, Device>, connections: Connection[]): Record<string, Edge[]> {
  const edges: Record<string, Edge[]> = {};
  const add = (from: string, edge: Edge) => (edges[from] ||= []).push(edge);
  for (const c of connections) {
    const a = devices[c.from.device];
    const b = devices[c.to.device];
    if (!a || !b) continue;
    const pa = portOf(a, c.from.port);
    const pb = portOf(b, c.to.port);
    if (pa && pb && !signalsCompatible(pa.signal_type, pb.signal_type)) continue;
    add(c.from.device, { connection: c.id, fromPort: c.from.port, to: c.to.device, toPort: c.to.port });
    if (pa?.direction === 'bidirectional' && pb?.direction === 'bidirectional') {
      add(c.to.device, { connection: c.id, fromPort: c.to.port, to: c.from.device, toPort: c.from.port });
    }
  }
  return edges;
}

/**
 * Все ветви сигнала от источника. Устройство не повторяется внутри одной ветви
 * (защита от петель), но разные ветви могут проходить через одно устройство —
 * например, каналы L и R через один усилитель.
 */
export function tracePaths(
  sourceId: string,
  domain: Domain,
  devices: Record<string, Device>,
  edges: Record<string, Edge[]>
): TracedPath[] {
  const paths: TracedPath[] = [];
  let steps = 0;

  const walk = (path: string[], entries: (string | null)[]) => {
    if (paths.length >= MAX_PATHS_PER_SOURCE || ++steps > MAX_STEPS_PER_SOURCE) return;
    const node = path[path.length - 1];
    const device = devices[node];
    const { exits, note } = transfer(device, entries[entries.length - 1], domain);
    let extended = false;
    for (const edge of edges[node] ?? []) {
      if (path.includes(edge.to)) continue;
      if (!exits(edge.fromPort)) continue;
      const target = devices[edge.to];
      if (!target || !accepts(target, edge.toPort, domain)) continue;
      extended = true;
      walk([...path, edge.to], [...entries, edge.toPort]);
    }
    if (!extended) {
      paths.push({ devices: path, entries, ...(note ? { note, blockedAt: node } : {}) });
    }
  };

  walk([sourceId], [null]);
  return paths;
}
