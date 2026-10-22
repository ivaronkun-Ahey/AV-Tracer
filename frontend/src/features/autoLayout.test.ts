import { describe, it, expect } from 'vitest';
import { computeAutoLayout } from './autoLayout';
import { EXAMPLE_PROJECTS } from '../data/examples';
import { nodeSize, portAnchor, GRID } from '../components/deviceGeometry';
import { Device } from '../types/device.types';

function overlaps(a: Device, b: Device) {
  const sa = nodeSize(a);
  const sb = nodeSize(b);
  return (
    a.position.x < b.position.x + sb.width &&
    b.position.x < a.position.x + sa.width &&
    a.position.y < b.position.y + sb.height &&
    b.position.y < a.position.y + sa.height
  );
}

describe('computeAutoLayout', () => {
  it('раскладывает по ходу сигнала слева направо, без наложений, по сетке', async () => {
    const example = EXAMPLE_PROJECTS.find((e) => e.id === 'concert')!.build();
    // Сваливаем всё в одну точку — раскладка должна разобрать
    const devices = example.devices.map((d) => ({ ...d, position: { x: 0, y: 0 } }));
    const positions = await computeAutoLayout(devices, example.connections);
    const placed = devices.map((d) => ({ ...d, position: positions[d.id] }));
    const x = (id: string) => positions[id].x;

    expect(x('c_mic')).toBeLessThan(x('c_mix'));
    expect(x('c_mix')).toBeLessThan(x('c_amp'));
    expect(x('c_amp')).toBeLessThan(x('c_sp1'));
    for (const p of Object.values(positions)) {
      expect(p.x % GRID).toBe(0);
      expect(p.y % GRID).toBe(0);
    }
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) expect(overlaps(placed[i], placed[j])).toBe(false);
    }
    // Микрофон и микшер соединены первыми портами — кабель должен получиться прямым
    const byId = Object.fromEntries(placed.map((d) => [d.id, d]));
    expect(portAnchor(byId.c_mic, 'xlr_out')!.y).toBe(portAnchor(byId.c_mix, 'xlr_in_1')!.y);
  });
});
