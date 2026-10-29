import { Connection, Device, ProjectDoc, SignalType } from '../types/device.types';
import { deviceTypeLabel, portLabel } from '../data/labels';
import { deviceTags } from '../data/deviceTags';
import {
  Anchor,
  HEADER_H,
  PORT_R,
  ROOM_PAD,
  ROOM_PAD_TOP,
  labelPoint,
  laneOffset,
  nodeSize,
  portAnchor,
  portSlots,
  roomBounds,
  routeCable,
  slotOffset,
} from '../components/deviceGeometry';
import { LineStyle, Prim, Pt, Rect, rectPath } from './sheet';

/**
 * Содержимое схем в единицах холста (1 ед. ≈ 1 px на экране); на лист
 * переносится масштабированием (layout.ts). Линии чёрные: тип сигнала на
 * функциональной схеме различается типом линии (ГОСТ 2.303) и подписью.
 */

export interface SchemeContent {
  prims: Prim[];
  /** Самый мелкий текст схемы — по нему выбирается масштаб и формат. */
  minText: number;
}

type Positions = Record<string, { x: number; y: number }>;

const ESTIMATE = 0.62; // ширина символа PT Sans Narrow относительно высоты прописных — для подложек

const text = (x: number, y: number, s: string, size: number, opts: Partial<Extract<Prim, { kind: 'text' }>> = {}): Prim => ({
  kind: 'text',
  x,
  y,
  text: s,
  size,
  ...opts,
});

/** Подпись поверх линии на белой подложке. */
function labelOnLine(p: Pt, s: string, size: number): Prim[] {
  const w = s.length * size * ESTIMATE + 4;
  return [
    rectPath({ x: p.x - w / 2, y: p.y - size / 2 - 2, width: w, height: size + 4 }, 'none', 'solid', '#ffffff'),
    text(p.x, p.y + size / 2, s, size, { align: 'center' }),
  ];
}

function roomFrame(r: Rect, name: string): Prim[] {
  return [rectPath(r, 'thin', 'dashdot'), text(r.x + 8, r.y + 20, name, 12, { bold: true, maxWidth: r.width - 16 })];
}

/* ------------------------------------------------------------------ */
/* Схема соединений: устройства с разъёмами и маркировкой кабелей      */
/* ------------------------------------------------------------------ */

export function connectionScheme({ devices, connections, rooms }: ProjectDoc): SchemeContent {
  const tags = deviceTags(devices);
  const prims: Prim[] = [];
  for (const room of rooms) {
    const r = roomBounds(room.id, devices, connections);
    if (r) prims.push(...roomFrame(r, room.name));
  }
  const byId = Object.fromEntries(devices.map((d) => [d.id, d]));
  for (const c of connections) {
    const from = byId[c.from.device];
    const to = byId[c.to.device];
    const a = from && portAnchor(from, c.from.port, connections);
    const b = to && portAnchor(to, c.to.port, connections);
    if (!from || !to || !a || !b) continue;
    const below = Math.max(from.position.y + nodeSize(from, connections).height, to.position.y + nodeSize(to, connections).height);
    const points = routeCable(a, b, laneOffset(c, from, to, connections), below);
    prims.push({ kind: 'path', points, weight: 'thin' });
    const label = [c.label, `${c.cable_length} м`].filter(Boolean).join(' · ');
    prims.push(...labelOnLine(labelPoint(points), label, 9));
  }
  for (const d of devices) {
    const { width, height } = nodeSize(d, connections);
    const { x, y } = d.position;
    prims.push(rectPath({ x, y, width, height }, 'thick'));
    prims.push({ kind: 'path', points: [{ x, y: y + HEADER_H }, { x: x + width, y: y + HEADER_H }], weight: 'thin' });
    prims.push(text(x + 8, y + 15, `${deviceTypeLabel(d.type)} · ${d.manufacturer}`, 9, { maxWidth: width - 74 }));
    prims.push(text(x + width - 8, y + 15, tags[d.id] ?? '', 10, { align: 'right', bold: true, maxWidth: 60 }));
    prims.push(text(x + 8, y + 33, d.model, 12, { bold: true, maxWidth: width - 16 }));
    for (const slot of portSlots(d, connections)) {
      const o = slotOffset(slot);
      const px = x + o.x;
      const py = y + o.y;
      prims.push({ kind: 'circle', x: px, y: py, r: PORT_R * 0.8, weight: 'thin', fill: '#ffffff' });
      const left = slot.side === 'left';
      prims.push(
        text(left ? px + 9 : px - 9, py + 4.5, portLabel(slot.port), 9, {
          align: left ? 'left' : 'right',
          maxWidth: width / 2 - 14,
        })
      );
    }
  }
  return { prims, minText: 9 };
}

/* ------------------------------------------------------------------ */
/* Структурная и функциональная схемы: устройства-блоки                */
/* ------------------------------------------------------------------ */

export const BLOCK = { width: 180, height: 64 };

/** Связь между блоками: одна линия на пару устройств (или на пару и вид сигнала). */
export interface BlockLink {
  from: string;
  to: string;
  /** Сигнал в обе стороны (Ethernet) — без стрелки. */
  both: boolean;
  style: LineStyle;
  label?: string;
}

export type SignalGroup = 'audio' | 'video' | 'data';

const SIGNAL_GROUP: Record<SignalType, SignalGroup> = {
  analog_audio: 'audio',
  line_100v: 'audio',
  digital_audio: 'audio',
  hdmi: 'video',
  sdi: 'video',
  hdbaset: 'video',
  video: 'video',
  network: 'data',
  control: 'data',
  usb: 'data',
};

export const GROUP_STYLE: Record<SignalGroup, { style: LineStyle; name: string }> = {
  audio: { style: 'solid', name: 'Звук (аналоговый, Dante)' },
  video: { style: 'dashed', name: 'Видео (HDMI, SDI, HDBaseT)' },
  data: { style: 'dashdot', name: 'Сеть, управление, USB' },
};

const SIGNAL_SHORT: Record<SignalType, string> = {
  analog_audio: 'Аудио',
  line_100v: '100 В',
  digital_audio: 'Dante',
  hdmi: 'HDMI',
  sdi: 'SDI',
  hdbaset: 'HDBaseT',
  video: 'Видео',
  network: 'Ethernet',
  control: 'Упр.',
  usb: 'USB',
};

const signalOf = (devices: Record<string, Device>, c: Connection): SignalType | undefined =>
  devices[c.from.device]?.ports.find((p) => p.id === c.from.port)?.signal_type;

/** Структурная схема: связь — одна линия на пару устройств; стрелка — направление сигнала. */
export function structuralLinks(devices: Device[], connections: Connection[]): BlockLink[] {
  const pairs = new Map<string, BlockLink>();
  for (const c of connections) {
    if (c.from.device === c.to.device) continue;
    const key = [c.from.device, c.to.device].sort().join('|');
    const existing = pairs.get(key);
    if (!existing) pairs.set(key, { from: c.from.device, to: c.to.device, both: false, style: 'solid' });
    else if (existing.from !== c.from.device) existing.both = true;
  }
  const bidirectional = new Set(
    devices.flatMap((d) => d.ports.filter((p) => p.direction === 'bidirectional').map((p) => `${d.id}|${p.id}`))
  );
  // Кабель между двумя двунаправленными портами (сеть) — без стрелки
  for (const c of connections) {
    if (bidirectional.has(`${c.from.device}|${c.from.port}`) && bidirectional.has(`${c.to.device}|${c.to.port}`)) {
      const link = pairs.get([c.from.device, c.to.device].sort().join('|'));
      if (link) link.both = true;
    }
  }
  return [...pairs.values()];
}

/** Функциональная схема: отдельная линия на каждый вид сигнала между парой, подпись — сигнал и число кабелей. */
export function functionalLinks(devices: Device[], connections: Connection[]): BlockLink[] {
  const byId = Object.fromEntries(devices.map((d) => [d.id, d]));
  const groups = new Map<string, { link: BlockLink; signals: Map<string, number> }>();
  for (const c of connections) {
    const signal = signalOf(byId, c);
    if (!signal || c.from.device === c.to.device) continue;
    const group = SIGNAL_GROUP[signal];
    const key = `${[c.from.device, c.to.device].sort().join('|')}|${group}`;
    let entry = groups.get(key);
    if (!entry) {
      entry = { link: { from: c.from.device, to: c.to.device, both: group === 'data', style: GROUP_STYLE[group].style }, signals: new Map() };
      groups.set(key, entry);
    } else if (entry.link.from !== c.from.device) entry.link.both = true;
    const name = SIGNAL_SHORT[signal];
    entry.signals.set(name, (entry.signals.get(name) ?? 0) + 1);
  }
  return [...groups.values()].map(({ link, signals }) => ({
    ...link,
    label: [...signals].map(([name, n]) => (n > 1 ? `${name} ×${n}` : name)).join(', '),
  }));
}

/** Блоки, рамки помещений и связи; позиции блоков — из раскладки (layout.ts). */
export function blockScheme(
  { devices, rooms }: ProjectDoc,
  positions: Positions,
  links: BlockLink[],
  opts: { legend?: boolean } = {}
): SchemeContent {
  const tags = deviceTags(devices);
  const prims: Prim[] = [];
  const box = (id: string): Rect => ({ ...positions[id], width: BLOCK.width, height: BLOCK.height });

  for (const room of rooms) {
    const members = devices.filter((d) => d.room === room.id && positions[d.id]);
    if (members.length === 0) continue;
    const r = unionRect(members.map((d) => box(d.id)));
    prims.push(
      ...roomFrame(
        { x: r.x - ROOM_PAD, y: r.y - ROOM_PAD_TOP, width: r.width + ROOM_PAD * 2, height: r.height + ROOM_PAD_TOP + ROOM_PAD },
        room.name
      )
    );
  }

  // Точки подключения связей распределены по сторонам блока: выходы справа, входы слева
  const outgoing = new Map<string, BlockLink[]>();
  const incoming = new Map<string, BlockLink[]>();
  for (const l of links) {
    if (!positions[l.from] || !positions[l.to]) continue;
    outgoing.set(l.from, [...(outgoing.get(l.from) ?? []), l]);
    incoming.set(l.to, [...(incoming.get(l.to) ?? []), l]);
  }
  const anchor = (id: string, list: BlockLink[], l: BlockLink, side: 'left' | 'right'): Anchor => {
    const b = box(id);
    const other = (x: BlockLink) => positions[side === 'right' ? x.to : x.from]?.y ?? 0;
    const ordered = [...list].sort((p, q) => other(p) - other(q));
    const i = ordered.indexOf(l);
    return { x: side === 'right' ? b.x + b.width : b.x, y: b.y + (b.height * (i + 1)) / (ordered.length + 1), side };
  };
  links.forEach((l, index) => {
    if (!positions[l.from] || !positions[l.to]) return;
    const a = anchor(l.from, outgoing.get(l.from)!, l, 'right');
    const b = anchor(l.to, incoming.get(l.to)!, l, 'left');
    const below = Math.max(box(l.from).y, box(l.to).y) + BLOCK.height;
    const points = routeCable(a, b, ((index % 5) - 2) * 6, below);
    prims.push({ kind: 'path', points, weight: 'thin', style: l.style, arrow: !l.both });
    if (l.label) prims.push(...labelOnLine(labelPoint(points, 40), l.label, 9));
  });

  for (const d of devices) {
    if (!positions[d.id]) continue;
    const b = box(d.id);
    prims.push(rectPath(b, 'thick'));
    prims.push(text(b.x + 8, b.y + 17, tags[d.id] ?? '', 11, { bold: true, maxWidth: b.width - 16 }));
    prims.push(text(b.x + 8, b.y + 35, `${d.manufacturer} ${d.model}`, 11, { maxWidth: b.width - 16 }));
    prims.push(text(b.x + 8, b.y + 53, deviceTypeLabel(d.type), 9, { maxWidth: b.width - 16 }));
  }

  if (opts.legend) prims.push(...legend(prims, links));
  return { prims, minText: 9 };
}

/** Условные обозначения линий — под схемой слева. */
function legend(prims: Prim[], links: BlockLink[]): Prim[] {
  const used = (Object.keys(GROUP_STYLE) as SignalGroup[]).filter((g) => links.some((l) => l.style === GROUP_STYLE[g].style));
  if (used.length === 0) return [];
  let bottom = -Infinity;
  let left = Infinity;
  for (const p of prims) {
    if (p.kind === 'path') p.points.forEach((q) => ((bottom = Math.max(bottom, q.y)), (left = Math.min(left, q.x))));
  }
  const items: Prim[] = [text(left, bottom + 40, 'Условные обозначения', 11, { bold: true })];
  used.forEach((g, i) => {
    const y = bottom + 62 + i * 20;
    items.push({ kind: 'path', points: [{ x: left, y: y - 4 }, { x: left + 60, y: y - 4 }], weight: 'thin', style: GROUP_STYLE[g].style });
    items.push(text(left + 72, y, GROUP_STYLE[g].name, 10));
  });
  return items;
}

function unionRect(rects: Rect[]): Rect {
  const x = Math.min(...rects.map((r) => r.x));
  const y = Math.min(...rects.map((r) => r.y));
  return {
    x,
    y,
    width: Math.max(...rects.map((r) => r.x + r.width)) - x,
    height: Math.max(...rects.map((r) => r.y + r.height)) - y,
  };
}
