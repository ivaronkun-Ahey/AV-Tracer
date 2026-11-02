import { describe, it, expect } from 'vitest';
import { createDevice, findEquipment } from '../data/equipment';
import { withDeviceTags } from '../data/deviceTags';
import { Device, ProjectDoc, Room } from '../types/device.types';
import { planNote, planPages } from './planSheet';
import { contentRect, primsBounds, sheetSize } from './sheet';

const dev = (eq: string, id: string, extra: Partial<Device>): Device => ({
  ...createDevice(findEquipment(eq)!, id, { x: 0, y: 0 }),
  ...extra,
});
const doc = (rooms: Room[]): ProjectDoc => ({
  devices: withDeviceTags([
    dev('jbl-prx815w', 's1', { room: 'hall', plan: { x: 1, y: 1, rotation: 0 } }),
    dev('shure-sm58', 'm1', { room: 'hall', plan: { x: 6, y: 4 } }),
    dev('shure-sm58', 'm2', { room: 'store' }),
  ]),
  connections: [],
  rooms,
});
const texts = (items: ReturnType<typeof planPages>['pages'][number]['items']) => items.flatMap((p) => (p.kind === 'text' ? [p.text] : []));

describe('план расположения оборудования', () => {
  it('лист на помещение с размером и расставленным оборудованием; масштаб — из ряда, размеры в мм', () => {
    const { pages, notes } = planPages(
      doc([
        { id: 'hall', name: 'Зал', color: '#5B8DEF', size: { width: 14, length: 9 } },
        { id: 'store', name: 'Склад', color: '#E0A030', size: { width: 5, length: 5 } }, // на плане никого
        { id: 'empty', name: 'Без размеров', color: '#43A047' },
      ]),
      'auto'
    );
    expect(notes).toEqual([]);
    expect(pages.map((p) => p.room)).toEqual(['Зал']);
    expect(pages[0].format).toBe('A4');
    expect(texts(pages[0].items)).toEqual(expect.arrayContaining(['Зал', '14000', '9000', 'SPK-01', 'MIC-01', planNote(100)]));
    const { width, height } = sheetSize('A4');
    const area = contentRect(width, height);
    const b = primsBounds(pages[0].items)!;
    expect(b.x + b.width).toBeLessThanOrEqual(area.x + area.width + 0.01);
    expect(b.y + b.height).toBeLessThanOrEqual(area.y + area.height + 0.01);
  });

  it('большое помещение — мельче масштаб или крупнее формат', () => {
    const big = planPages(doc([{ id: 'hall', name: 'Зал', color: '#5B8DEF', size: { width: 60, length: 40 } }]), 'auto');
    expect(big.pages[0].format).toBe('A1');
    expect(texts(big.pages[0].items)).toContain(planNote(100));
    const a4 = planPages(doc([{ id: 'hall', name: 'Зал', color: '#5B8DEF', size: { width: 60, length: 40 } }]), 'A4');
    expect(texts(a4.pages[0].items)).toContain(planNote(500));
  });
});
