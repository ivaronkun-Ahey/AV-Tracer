import { describe, it, expect } from 'vitest';
import { createDevice, findEquipment } from '../data/equipment';
import { withDeviceTags } from '../data/deviceTags';
import { ProjectDoc, Rack } from '../types/device.types';
import { RACK_SHEET_NOTE, rackPages } from './rackSheet';
import { specRows } from './tables';
import { contentRect, primsBounds, sheetSize } from './sheet';
import { bomCsv } from '../features/exportDocs';

const mk = (eq: string, id: string, rack?: { rack: string; u: number }) => ({
  ...createDevice(findEquipment(eq)!, id, { x: 0, y: 0 }),
  ...(rack ? { rack } : {}),
});

const doc = (racks: Rack[]): ProjectDoc => ({
  devices: withDeviceTags([
    mk('crown-xls2502', 'a1', { rack: 'r1', u: 41 }),
    mk('cisco-sg350', 's1', { rack: 'r1', u: 1 }),
    mk('shure-sm58', 'm1'),
  ]),
  connections: [],
  rooms: [{ id: 'hall', name: 'Аппаратная', color: '#5B8DEF' }],
  racks,
});

const texts = (items: ReturnType<typeof rackPages>['pages'][number]['items']) => items.flatMap((p) => (p.kind === 'text' ? [p.text] : []));

describe('схема расположения оборудования в шкафах', () => {
  it('шкаф 42U в масштабе 1:10 — на А3, с номерами юнитов и обозначениями', () => {
    const { pages, notes } = rackPages(doc([{ id: 'r1', name: 'ШТ-1', units: 42, room: 'hall' }]), 'auto');
    expect(notes).toEqual([]);
    expect(pages).toHaveLength(1);
    expect(pages[0].format).toBe('A3');
    const t = texts(pages[0].items);
    expect(t).toEqual(
      expect.arrayContaining(['ШТ-1', '42U · Аппаратная', '1', '42', 'AMP-01', 'Crown XLS 2502', 'NSW-01 Cisco SG350-28', RACK_SHEET_NOTE])
    );
    // Всё — в поле над основной надписью
    const area = contentRect(sheetSize('A3').width, sheetSize('A3').height);
    const b = primsBounds(pages[0].items)!;
    expect(b.y + b.height).toBeLessThanOrEqual(area.y + area.height + 0.01);
    // Высота шкафа: 42 × 4,445 мм + стойки
    const outline = pages[0].items.find((p) => p.kind === 'path' && p.weight === 'thick' && p.closed)!;
    if (outline.kind !== 'path') throw new Error();
    const ys = outline.points.map((p) => p.y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(42 * 4.445 + 6, 2);
  });

  it('много шкафов — на нескольких листах; высокий шкаф на А4 — предупреждение', () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ id: `r${i + 1}`, name: `Шкаф ${i + 1}`, units: 42 }));
    const { pages } = rackPages(doc(many), 'A3');
    expect(pages.length).toBeGreaterThan(1);
    expect(pages.flatMap((p) => texts(p.items)).filter((t) => t.startsWith('Шкаф '))).toHaveLength(8);
    expect(rackPages(doc([{ id: 'r1', name: 'ШТ-1', units: 42 }]), 'A4').notes.join()).toContain('не помещается на формате A4');
    expect(rackPages(doc([]), 'auto').pages).toEqual([]);
  });

  it('шкафы — в спецификации и в CSV', () => {
    const d = doc([
      { id: 'r1', name: 'ШТ-1', units: 42 },
      { id: 'r2', name: 'ШТ-2', units: 42 },
      { id: 'r3', name: 'Стойка', units: 12 },
    ]);
    const rows = specRows(d);
    const at = rows.findIndex((r) => r.section && r.cells[1] === 'Шкафы');
    expect(at).toBeGreaterThan(0);
    expect(rows[at + 1].cells).toEqual(['', 'Шкаф телекоммуникационный 19″, 42U', '42U', '', '', 'шт.', '2', '', 'ШТ-1, ШТ-2']);
    expect(rows[at + 2].cells[6]).toBe('1');
    expect(bomCsv(d.devices, d.rooms, d.racks)).toContain('Шкаф телекоммуникационный 19″, 42U;2');
  });
});
