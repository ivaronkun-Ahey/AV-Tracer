import { Connection, Device, Port } from '../types/device.types';

// Схема рисуется слева направо, как принято в AV-документации:
// входы — на левой кромке устройства, выходы — на правой, у каждого порта подпись.

export const NODE_W = 210;
export const HEADER_H = 40;
export const ROW_H = 20;
export const BODY_PAD = 6;
export const PORT_R = 5;
/** Шаг сетки холста. Порты стоят на y ≡ 10 (mod 20): у выровненных устройств кабели прямые. */
export const GRID = 20;
/** Длина прямого участка кабеля у разъёма. */
const STUB = 16;

export type PortSide = 'left' | 'right';

export interface PortSlot {
  port: Port;
  side: PortSide;
  row: number;
}

export interface Anchor {
  x: number;
  y: number;
  side: PortSide;
}

/**
 * Расстановка портов по сторонам. Двунаправленный порт (Ethernet) рисуется один
 * раз и встаёт по направлению своего кабеля: принимающий — слева, отдающий —
 * справа. Свободные порты сетевого оборудования делятся между сторонами поровну,
 * у остальных устройств свободный LAN-порт стоит справа, рядом с выходами.
 */
export function portSlots(device: Device, connections: Connection[] = []): PortSlot[] {
  const sideOf = (p: Port): PortSide | null => {
    if (p.direction === 'input') return 'left';
    if (p.direction === 'output') return 'right';
    if (connections.some((c) => c.to.device === device.id && c.to.port === p.id)) return 'left';
    if (connections.some((c) => c.from.device === device.id && c.from.port === p.id)) return 'right';
    return null;
  };
  const sides = device.ports.map(sideOf);
  const onlyBidirectional = device.ports.every((p) => p.direction === 'bidirectional');
  let leftCount = sides.filter((x) => x === 'left').length;
  const leftShare = Math.ceil(device.ports.length / 2);
  const left: Port[] = [];
  const right: Port[] = [];
  device.ports.forEach((p, i) => {
    let side = sides[i];
    if (!side) side = onlyBidirectional && leftCount++ < leftShare ? 'left' : 'right';
    (side === 'left' ? left : right).push(p);
  });
  return [
    ...left.map((port, row) => ({ port, side: 'left' as const, row })),
    ...right.map((port, row) => ({ port, side: 'right' as const, row })),
  ];
}

export function nodeSize(device: Device, connections: Connection[] = []): { width: number; height: number } {
  const slots = portSlots(device, connections);
  const rows = Math.max(1, ...slots.map((s) => s.row + 1));
  return { width: NODE_W, height: HEADER_H + rows * ROW_H + BODY_PAD };
}

/** Координата центра порта относительно левого верхнего угла устройства. */
export function slotOffset(slot: PortSlot): { x: number; y: number } {
  return { x: slot.side === 'left' ? 0 : NODE_W, y: HEADER_H + slot.row * ROW_H + ROW_H / 2 };
}

/** Абсолютная точка подключения кабеля к порту. */
export function portAnchor(device: Device, portId: string, connections: Connection[] = []): Anchor | null {
  const slot = portSlots(device, connections).find((s) => s.port.id === portId);
  if (!slot) return null;
  const o = slotOffset(slot);
  return { x: device.position.x + o.x, y: device.position.y + o.y, side: slot.side };
}

export function snapToGrid(value: number): number {
  return Math.round(value / GRID) * GRID;
}

type Pt = { x: number; y: number };

function simplify(points: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (last && Math.abs(last.x - p.x) < 0.01 && Math.abs(last.y - p.y) < 0.01) continue;
    const prev = out[out.length - 2];
    // Убираем точку посередине прямого участка
    if (prev && last && ((prev.x === last.x && last.x === p.x) || (prev.y === last.y && last.y === p.y))) {
      out[out.length - 1] = p;
      continue;
    }
    out.push(p);
  }
  return out;
}

/**
 * Ортогональная трасса кабеля (только горизонтальные и вертикальные участки).
 * lane сдвигает вертикальный участок, чтобы параллельные кабели не сливались;
 * belowY — нижняя граница устройств для обхода, когда кабель идёт «назад».
 */
export function routeCable(a: Anchor, b: Anchor, lane = 0, belowY = Math.max(a.y, b.y)): Pt[] {
  const d1 = a.side === 'right' ? 1 : -1;
  const d2 = b.side === 'right' ? 1 : -1;
  const s1 = { x: a.x + d1 * STUB, y: a.y };
  const s2 = { x: b.x + d2 * STUB, y: b.y };
  let middle: Pt[];
  if (d1 !== d2) {
    const forward = d1 > 0 ? s1.x <= s2.x : s1.x >= s2.x;
    if (forward) {
      const mx = (s1.x + s2.x) / 2 + lane;
      middle = [
        { x: mx, y: s1.y },
        { x: mx, y: s2.y },
      ];
    } else {
      // Кабель идёт назад: обходим устройства снизу
      const my = belowY + GRID + Math.abs(lane);
      middle = [
        { x: s1.x, y: my },
        { x: s2.x, y: my },
      ];
    }
  } else {
    const x = d1 > 0 ? Math.max(s1.x, s2.x) + Math.abs(lane) : Math.min(s1.x, s2.x) - Math.abs(lane);
    middle = [
      { x, y: s1.y },
      { x, y: s2.y },
    ];
  }
  return simplify([{ x: a.x, y: a.y }, s1, ...middle, s2, { x: b.x, y: b.y }]);
}

/** SVG-путь по ломаной со скруглёнными углами. */
export function roundedPath(points: Pt[], radius = 8): string {
  if (points.length === 0) return '';
  let d = `M${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i];
    const prev = points[i - 1];
    const next = points[i + 1];
    const lenIn = Math.hypot(p.x - prev.x, p.y - prev.y);
    const lenOut = Math.hypot(next.x - p.x, next.y - p.y);
    const r = Math.min(radius, lenIn / 2, lenOut / 2);
    const bx = p.x - ((p.x - prev.x) / lenIn) * r;
    const by = p.y - ((p.y - prev.y) / lenIn) * r;
    const ax = p.x + ((next.x - p.x) / lenOut) * r;
    const ay = p.y + ((next.y - p.y) / lenOut) * r;
    d += ` L${bx} ${by} Q${p.x} ${p.y} ${ax} ${ay}`;
  }
  const last = points[points.length - 1];
  return `${d} L${last.x} ${last.y}`;
}

/** Точка посередине ломаной (по длине) — для подписи кабеля. */
export function midpoint(points: Pt[]): Pt {
  const lengths = points.slice(1).map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y));
  let rest = lengths.reduce((a, b) => a + b, 0) / 2;
  for (let i = 0; i < lengths.length; i++) {
    if (rest <= lengths[i] && lengths[i] > 0) {
      const t = rest / lengths[i];
      return { x: points[i].x + (points[i + 1].x - points[i].x) * t, y: points[i].y + (points[i + 1].y - points[i].y) * t };
    }
    rest -= lengths[i];
  }
  return points[0] ?? { x: 0, y: 0 };
}

/**
 * Место подписи кабеля: середина самого длинного горизонтального участка
 * (подпись читается вдоль кабеля и не ложится на соседние вертикали),
 * иначе — середина всей трассы.
 */
export function labelPoint(points: Pt[], minLength = 60): Pt {
  let best: { a: Pt; b: Pt; len: number } | null = null;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const len = Math.abs(b.x - a.x);
    if (a.y === b.y && len >= minLength && (!best || len > best.len)) best = { a, b, len };
  }
  return best ? { x: (best.a.x + best.b.x) / 2, y: best.a.y } : midpoint(points);
}

/** Габариты схемы (для «вписать в экран» и экспорта). */
export function diagramBounds(
  devices: Device[],
  connections: Connection[] = []
): { x: number; y: number; width: number; height: number } | null {
  if (devices.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const d of devices) {
    const { width, height } = nodeSize(d, connections);
    minX = Math.min(minX, d.position.x);
    minY = Math.min(minY, d.position.y);
    maxX = Math.max(maxX, d.position.x + width);
    maxY = Math.max(maxY, d.position.y + height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Цвет категории устройства: полоса и пиктограмма на холсте, карточки библиотеки. */
const CATEGORY_COLORS: Record<string, string> = {
  audio: '#FF6B00',
  video: '#00B8D4',
  network: '#00C853',
  control: '#9C27B0',
};

export function categoryColor(category: string): string {
  return CATEGORY_COLORS[category] || '#0066CC';
}

const SIGNAL_COLORS: Record<string, string> = {
  analog_audio: '#FF6B00',
  digital_audio: '#0066CC',
  video: '#00B8D4',
  hdmi: '#00B8D4',
  sdi: '#00C8FF',
  hdbaset: '#7C4DFF',
  network: '#00C853',
  control: '#9C27B0',
  usb: '#E91E63',
};

export function signalColor(signalType: string): string {
  return SIGNAL_COLORS[signalType] || '#0066CC';
}

// Сигналы, которые физически передаются по сети/IP (один кабель cat6).
const IP_SIGNALS = new Set(['network', 'digital_audio']);

/** Можно ли соединить два порта по типу сигнала. */
export function signalsCompatible(a: string, b: string): boolean {
  if (a === b) return true;
  return IP_SIGNALS.has(a) && IP_SIGNALS.has(b);
}
