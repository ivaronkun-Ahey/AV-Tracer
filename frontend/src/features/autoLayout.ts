import type { ElkNode } from 'elkjs/lib/elk-api';
import { Connection, Device } from '../types/device.types';
import { nodeSize, portSlots, slotOffset, snapToGrid, GRID, ROOM_PAD, ROOM_PAD_TOP } from '../components/deviceGeometry';

type Positions = Record<string, { x: number; y: number }>;

const portKey = (deviceId: string, portId: string) => `${deviceId}::${portId}`;

/** Промежуток между полосами помещений. */
const BAND_GAP = GRID * 2;

const ceilGrid = (v: number) => Math.ceil(v / GRID) * GRID;

/**
 * Помещения — горизонтальные полосы, как на структурных схемах: столбцы
 * (ход сигнала слева направо) берутся из общей раскладки, а устройства каждого
 * помещения собираются в свою полосу. Полосы идут сверху вниз в порядке, в
 * котором устройства помещений стояли в общей раскладке; устройства вне
 * помещений — отдельной полосой без рамки. Внутри полосы порядок по вертикали
 * сохраняется, наложения сдвигаются вниз. Рамки разных помещений не пересекаются.
 */
export function arrangeRooms(
  devices: Device[],
  flat: Positions,
  sizeOf: (d: Device) => { width: number; height: number }
): Positions {
  if (!devices.some((d) => d.room)) return flat;
  const bands = new Map<string, Device[]>();
  for (const d of devices) bands.set(d.room ?? '', [...(bands.get(d.room ?? '') ?? []), d]);
  const meanY = (ds: Device[]) => ds.reduce((acc, d) => acc + flat[d.id].y, 0) / ds.length;
  const order = [...bands.entries()].sort(([, a], [, b]) => meanY(a) - meanY(b));

  const result: Positions = {};
  let top = 0;
  for (const [room, members] of order) {
    const padTop = room ? ROOM_PAD_TOP : 0;
    const padBottom = room ? ROOM_PAD : 0;
    const minY = Math.min(...members.map((d) => flat[d.id].y));
    const placed: Array<{ x: number; y: number; w: number; h: number }> = [];
    for (const d of [...members].sort((a, b) => flat[a.id].y - flat[b.id].y || flat[a.id].x - flat[b.id].x)) {
      const { width, height } = sizeOf(d);
      const x = flat[d.id].x;
      let y = top + padTop + flat[d.id].y - minY;
      // Сдвигаем вниз, пока устройство накладывается на уже поставленные в этой полосе
      for (let moved = true; moved; ) {
        moved = false;
        for (const p of placed) {
          if (x < p.x + p.w + GRID && p.x < x + width + GRID && y < p.y + p.h + GRID && p.y < y + height + GRID) {
            y = ceilGrid(p.y + p.h + GRID * 2);
            moved = true;
          }
        }
      }
      placed.push({ x, y, w: width, h: height });
      result[d.id] = { x, y };
    }
    const bottom = Math.max(...placed.map((p) => p.y + p.h));
    top = ceilGrid(bottom + padBottom + BAND_GAP);
  }
  return result;
}

/**
 * Автоматическая раскладка схемы по ходу сигнала (слева направо): источники →
 * обработка → распределение → приёмники. Алгоритм layered из ELK сам расставляет
 * устройства по столбцам и порядку, уменьшая пересечения кабелей; порты закреплены
 * там, где они нарисованы. Помещения затем собираются в полосы (arrangeRooms).
 * Библиотека грузится только при первом использовании.
 */
export async function computeAutoLayout(devices: Device[], connections: Connection[]): Promise<Positions> {
  if (devices.length === 0) return {};
  const { default: ELK } = await import('elkjs/lib/elk.bundled.js');
  const elk = new ELK();

  const knownPorts = new Set(devices.flatMap((d) => d.ports.map((p) => portKey(d.id, p.id))));
  const graph: ElkNode = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.layered.spacing.nodeNodeBetweenLayers': '120',
      'elk.spacing.nodeNode': '40',
      'elk.spacing.componentComponent': '80',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.separateConnectedComponents': 'true',
    },
    children: devices.map((d) => {
      const { width, height } = nodeSize(d, connections);
      return {
        id: d.id,
        width,
        height,
        layoutOptions: { 'elk.portConstraints': 'FIXED_POS' },
        ports: portSlots(d, connections).map((slot) => {
          const o = slotOffset(slot);
          return {
            id: portKey(d.id, slot.port.id),
            x: o.x,
            y: o.y,
            width: 0,
            height: 0,
            layoutOptions: { 'elk.port.side': slot.side === 'left' ? 'WEST' : 'EAST' },
          };
        }),
      };
    }),
    edges: connections
      .filter((c) => knownPorts.has(portKey(c.from.device, c.from.port)) && knownPorts.has(portKey(c.to.device, c.to.port)))
      .map((c) => ({
        id: c.id,
        sources: [portKey(c.from.device, c.from.port)],
        targets: [portKey(c.to.device, c.to.port)],
      })),
  };

  const result = await elk.layout(graph);
  const positions: Positions = {};
  for (const child of result.children ?? []) {
    // Привязка к сетке сохраняет выравнивание портов, найденное ELK (шаг строк = шагу сетки)
    positions[child.id] = { x: snapToGrid((child.x ?? 0) + GRID * 2), y: snapToGrid((child.y ?? 0) + GRID * 2) };
  }
  const arranged = arrangeRooms(devices, positions, (d) => nodeSize(d, connections));
  // Полосы помещений начинаются от нуля — сдвигаем к тому же отступу, что и без помещений
  const shiftY = devices.some((d) => d.room) ? GRID * 2 : 0;
  return Object.fromEntries(Object.entries(arranged).map(([id, p]) => [id, { x: p.x, y: p.y + shiftY }]));
}
