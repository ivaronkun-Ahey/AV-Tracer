import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { EXAMPLE_PROJECTS } from '../data/examples';
import { withCableLabels } from '../data/cableLabels';
import { withDeviceTags } from '../data/deviceTags';
import { createDevice, findEquipment } from '../data/equipment';
import { Connection, ProjectDoc } from '../types/device.types';
import { contentRect, primsBounds, sheetSize, wrapText } from './sheet';
import { cableColumns, SPEC_COLUMNS, specRows, tablePages, cableRows } from './tables';
import { connectionScheme, functionalLinks, structuralLinks } from './schemes';
import { MIN_SHEET_TEXT, placeOnSheet } from './layout';
import { buildDrawingPdf } from './drawingSet';
import { testFonts } from './testFonts';

const concert = (): ProjectDoc => {
  const p = EXAMPLE_PROJECTS.find((e) => e.id === 'concert')!.build();
  const devices = withDeviceTags(p.devices);
  return { devices, connections: withCableLabels(devices, p.connections), rooms: p.rooms ?? [], meta: { code: '2026-01-СС' } };
};

/** Простой измеритель для таблиц: символ = 0,6 высоты. */
const measure = (t: string, size: number) => t.length * size * 0.6;

describe('таблицы на листах', () => {
  it('колонки спецификации (ГОСТ 21.110, форма 1) и кабельного журнала — 395 мм, ширина рамки А3', () => {
    const sum = (cols: { width: number }[]) => cols.reduce((a, c) => a + c.width, 0);
    expect(sum(SPEC_COLUMNS)).toBe(395);
    expect(sum(cableColumns(true))).toBe(395);
    expect(sum(cableColumns(false))).toBe(395);
  });

  it('перенос по словам и разрезание длинного слова', () => {
    expect(wrapText('один два три', 9, 2.5, measure)).toEqual(['один', 'два', 'три']);
    expect(wrapText('один два', 20, 2.5, measure)).toEqual(['один два']);
    expect(wrapText('абвгдежзиклмн', 9, 2.5, measure).every((l) => measure(l, 2.5) <= 9)).toBe(true);
  });

  it('длинная таблица переходит на следующие листы, заголовок повторяется', () => {
    const rows = Array.from({ length: 80 }, (_, i) => ({ cells: [`A-${i}`, 'Сцена', 'MIC-01', 'XLR OUT', 'Зал', 'MIX-01', 'XLR IN 1', 'XLR', 'Аудио', '10', ''] }));
    const pages = tablePages(cableColumns(true), rows, measure);
    expect(pages.length).toBeGreaterThan(2);
    for (const page of pages) {
      const texts = page.items.flatMap((p) => (p.kind === 'text' ? [p.text] : []));
      expect(texts).toContain('Начало');
      // Таблица не заходит на основную надпись
      const bottom = Math.max(...page.items.flatMap((p) => (p.kind === 'path' ? p.points.map((q) => q.y) : [])));
      expect(bottom).toBeLessThanOrEqual(page.height - 5 - 55 + 0.01);
    }
  });

  it('спецификация: разделы по помещениям и кабели в метрах', () => {
    const rows = specRows(concert());
    const sections = rows.filter((r) => r.section).map((r) => r.cells[1]);
    expect(sections).toEqual(['Сцена', 'Пульт FOH', 'Кабели']);
    const xlr = rows.find((r) => r.cells[2] === 'XLR')!;
    expect(xlr.cells[5]).toBe('м');
    expect(xlr.cells[6]).toBe('80');
    expect(cableRows(concert()).filter((r) => !r.section).length).toBe(4 + 2);
  });
});

describe('схемы', () => {
  it('структурная: одна линия на пару устройств, сеть — без стрелки', () => {
    const doc = concert();
    expect(structuralLinks(doc.devices, doc.connections)).toHaveLength(4);
    const sw = createDevice(findEquipment('cisco-sg350')!, 'sw', { x: 0, y: 0 });
    const pc = createDevice(findEquipment('generic-laptop')!, 'pc', { x: 0, y: 0 });
    const lan: Connection = { id: 'n1', from: { device: 'pc', port: 'eth' }, to: { device: 'sw', port: 'eth_1' }, cable_type: 'cat6', cable_length: 5 };
    const [link] = structuralLinks([sw, pc], [lan]);
    expect(link.both).toBe(true);
  });

  it('функциональная: линия на вид сигнала с подписью и числом кабелей', () => {
    const doc = concert();
    const links = functionalLinks(doc.devices, doc.connections);
    expect(links.every((l) => l.style === 'solid')).toBe(true);
    expect(links.find((l) => l.from === 'c_amp' && l.to === 'c_sp1')?.label).toBe('Аудио');
  });

  it('схема на листе: в поле над основной надписью, «авто» выбирает формат с текстом не мельче 2,5 мм', () => {
    const placed = placeOnSheet(connectionScheme(concert()), 'auto');
    expect(placed.minTextMm).toBeGreaterThanOrEqual(MIN_SHEET_TEXT - 1e-9);
    const { width, height } = sheetSize(placed.format);
    const area = contentRect(width, height);
    const b = primsBounds(placed.items)!;
    expect(b.x).toBeGreaterThanOrEqual(area.x - 0.5);
    expect(b.y).toBeGreaterThanOrEqual(area.y - 0.5);
    expect(b.x + b.width).toBeLessThanOrEqual(area.x + area.width + 0.5);
    expect(b.y + b.height).toBeLessThanOrEqual(area.y + area.height + 0.5);
    // Принудительный A4 — схема влезает, но текст мельче нормы
    expect(placeOnSheet(connectionScheme(concert()), 'A4').minTextMm).toBeLessThan(MIN_SHEET_TEXT);
  });
});

describe('комплект чертежей в PDF', () => {
  it('пять видов листов, нумерация, форматы, предупреждение о мелком тексте', async () => {
    const result = await buildDrawingPdf(
      concert(),
      { kinds: ['structural', 'functional', 'connections', 'cables', 'spec'], format: 'auto', date: new Date('2026-10-28') },
      testFonts()
    );
    expect(result.sheets).toBe(5);
    expect(result.notes).toEqual([]);
    const pdf = await PDFDocument.load(result.bytes);
    expect(pdf.getPageCount()).toBe(5);
    const formats = pdf.getPages().map((p) => Math.round((p.getWidth() * 25.4) / 72));
    expect(formats[3]).toBe(420); // кабельный журнал — А3
    expect(pdf.getTitle()).toContain('2026-01-СС');

    const small = await buildDrawingPdf(concert(), { kinds: ['connections'], format: 'A4' }, testFonts());
    expect(small.notes.join(' ')).toContain('мелкий текст');
  });

  it('пустая схема и пустой выбор листов — понятная ошибка', async () => {
    await expect(buildDrawingPdf({ devices: [], connections: [], rooms: [] }, { kinds: ['spec'], format: 'auto' }, testFonts())).rejects.toThrow('пуста');
    await expect(buildDrawingPdf(concert(), { kinds: [], format: 'auto' }, testFonts())).rejects.toThrow('не выбран');
  });
});
