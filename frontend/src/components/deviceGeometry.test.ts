import { describe, it, expect } from 'vitest';
import { portSlots, portAnchor, routeCable, roundedPath, labelPoint, nodeSize, freeSpot, HEADER_H, ROW_H, NODE_W } from './deviceGeometry';
import { createDevice, findEquipment } from '../data/equipment';

const make = (eq: string, id: string, x = 0, y = 0) => createDevice(findEquipment(eq)!, id, { x, y });

describe('порты слева/справа', () => {
  it('входы слева, выходы справа, строки по порядку', () => {
    const mixer = make('allen-heath-sq5', 'mix');
    const slots = portSlots(mixer);
    expect(slots.filter((s) => s.side === 'left')).toHaveLength(16);
    expect(slots.filter((s) => s.side === 'right')).toHaveLength(12);
    expect(slots.find((s) => s.port.id === 'xlr_in_3')).toMatchObject({ side: 'left', row: 2 });
    expect(nodeSize(mixer).height).toBe(HEADER_H + 16 * ROW_H + 6);
  });

  it('у коммутатора Ethernet-порты делятся пополам и рисуются по одному разу', () => {
    const slots = portSlots(make('cisco-sg350', 'sw'));
    expect(slots).toHaveLength(24);
    expect(slots.filter((s) => s.side === 'left')).toHaveLength(12);
  });

  it('Ethernet-порт встаёт по направлению кабеля: принимающий слева, отдающий справа', () => {
    const sw = make('cisco-sg350', 'sw');
    const link = (from: [string, string], to: [string, string]) => ({
      id: from.join() + to.join(),
      from: { device: from[0], port: from[1] },
      to: { device: to[0], port: to[1] },
      cable_type: 'cat6' as const,
      cable_length: 1,
    });
    const slots = portSlots(sw, [link(['mic', 'dante_out'], ['sw', 'eth_20']), link(['sw', 'eth_1'], ['dsp', 'dante_in'])]);
    expect(slots.find((s) => s.port.id === 'eth_20')?.side).toBe('left');
    expect(slots.find((s) => s.port.id === 'eth_1')?.side).toBe('right');
    expect(slots.filter((s) => s.side === 'left')).toHaveLength(12);
  });

  it('LAN-порт медиаплеера — справа, рядом с выходами', () => {
    const slots = portSlots(make('brightsign-xt1144', 'mp'));
    expect(slots.every((s) => s.side === 'right')).toBe(true);
  });

  it('порты стоят на сетке 20 px со смещением 10 — выровненные устройства соединяются прямо', () => {
    const a = portAnchor(make('shure-sm58', 'mic', 40, 80), 'xlr_out')!;
    const b = portAnchor(make('allen-heath-sq5', 'mix', 340, 80), 'xlr_in_1')!;
    expect(a).toEqual({ x: 40 + NODE_W, y: 80 + HEADER_H + ROW_H / 2, side: 'right' });
    expect(routeCable(a, b)).toEqual([
      { x: a.x, y: a.y },
      { x: b.x, y: b.y },
    ]);
  });
});

describe('routeCable', () => {
  it('прокладывает трассу только горизонтальными и вертикальными участками', () => {
    const pts = routeCable({ x: 100, y: 50, side: 'right' }, { x: 300, y: 170, side: 'left' });
    for (let i = 1; i < pts.length; i++) {
      expect(pts[i].x === pts[i - 1].x || pts[i].y === pts[i - 1].y).toBe(true);
    }
    expect(pts[0]).toEqual({ x: 100, y: 50 });
    expect(pts[pts.length - 1]).toEqual({ x: 300, y: 170 });
  });

  it('кабель «назад» обходит устройства снизу', () => {
    const pts = routeCable({ x: 300, y: 50, side: 'right' }, { x: 100, y: 50, side: 'left' }, 0, 200);
    expect(Math.max(...pts.map((p) => p.y))).toBeGreaterThan(200);
  });

  it('подпись — на самом длинном горизонтальном участке', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 300 },
      { x: 220, y: 300 },
    ];
    expect(labelPoint(pts)).toEqual({ x: 120, y: 300 });
  });

  it('скругляет углы в SVG-пути', () => {
    const d = roundedPath([
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 50 },
    ]);
    expect(d).toBe('M0 0 L42 0 Q50 0 50 8 L50 50');
  });
});

describe('место для нового устройства', () => {
  const overlaps = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
    a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

  it('на пустой схеме — желаемая точка (по сетке)', () => {
    expect(freeSpot([], { width: 210, height: 80 }, { x: 103, y: 47 })).toEqual({ x: 100, y: 40 });
  });

  it('занятое место обходится: новое устройство не перекрывает существующие', () => {
    const existing = [make('shure-sm58', 'a', 100, 100), make('allen-heath-sq5', 'b', 400, 80)];
    const size = nodeSize(make('shure-sm58', 'n'));
    for (const preferred of [{ x: 100, y: 100 }, { x: 420, y: 200 }]) {
      const spot = freeSpot(existing, size, preferred);
      for (const d of existing) {
        const s = nodeSize(d);
        expect(overlaps({ ...spot, w: size.width, h: size.height }, { ...d.position, w: s.width, h: s.height })).toBe(false);
      }
      // и стоит рядом с желаемой точкой, а не где-то далеко
      expect(Math.hypot(spot.x - preferred.x, spot.y - preferred.y)).toBeLessThan(600);
    }
  });
});
