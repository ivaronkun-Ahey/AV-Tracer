import { describe, it, expect } from 'vitest';
import { computeAutoLayout } from './autoLayout';
import { EXAMPLE_PROJECTS } from '../data/examples';
import { nodeSize, portAnchor, roomBounds, GRID } from '../components/deviceGeometry';
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
    // Сваливаем всё в одну точку и без помещений — раскладка должна разобрать
    const devices = example.devices.map((d) => ({ ...d, room: undefined, position: { x: 0, y: 0 } }));
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

  it('помещения — полосы: ход сигнала слева направо сохраняется, рамки не пересекаются', async () => {
    const example = EXAMPLE_PROJECTS.find((e) => e.id === 'concert')!.build();
    const devices = example.devices.map((d) => ({ ...d, position: { x: 0, y: 0 } }));
    const positions = await computeAutoLayout(devices, example.connections);
    const placed = devices.map((d) => ({ ...d, position: positions[d.id] }));
    const x = (id: string) => positions[id].x;
    expect(x('c_mic')).toBeLessThan(x('c_mix'));
    expect(x('c_mix')).toBeLessThan(x('c_amp'));
    expect(x('c_amp')).toBeLessThan(x('c_sp1'));

    const stage = roomBounds('c_stage', placed)!;
    const foh = roomBounds('c_foh', placed)!;
    const intersects = (a: typeof stage, b: typeof stage) =>
      a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
    expect(intersects(stage, foh)).toBe(false);
    // В рамке помещения нет чужих устройств
    for (const d of placed) {
      const s = nodeSize(d);
      const rect = { x: d.position.x, y: d.position.y, width: s.width, height: s.height };
      expect(intersects(rect, d.room === 'c_stage' ? foh : stage)).toBe(false);
    }
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) expect(overlaps(placed[i], placed[j])).toBe(false);
    }
    // Рамки видны: не уходят за верхний и левый край
    expect(Math.min(stage.y, foh.y)).toBeGreaterThanOrEqual(0);
  });
});
