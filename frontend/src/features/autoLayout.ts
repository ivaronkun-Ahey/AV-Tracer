import type { ElkNode } from 'elkjs/lib/elk-api';
import { Connection, Device } from '../types/device.types';
import { nodeSize, portSlots, slotOffset, snapToGrid, GRID } from '../components/deviceGeometry';

type Positions = Record<string, { x: number; y: number }>;

const portKey = (deviceId: string, portId: string) => `${deviceId}::${portId}`;

/**
 * Автоматическая раскладка схемы по ходу сигнала (слева направо): источники →
 * обработка → распределение → приёмники. Алгоритм layered из ELK сам расставляет
 * устройства по столбцам и порядку, уменьшая пересечения кабелей; порты закреплены
 * там, где они нарисованы. Библиотека грузится только при первом использовании.
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
  return positions;
}
