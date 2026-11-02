import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { renderPdf } from './pdf';
import { testFonts } from './testFonts';
import { frame, titleBlock } from './titleBlock';
import { sheetSize, TITLE_BLOCK, frameRect } from './sheet';


describe('лист с рамкой и основной надписью в PDF', () => {
  it('A3 альбомный: размер страницы, кириллица встраивается', async () => {
    const { width, height } = sheetSize('A3');
    const pdfBytes = await renderPdf(
      () => [
        {
          format: 'A3',
          width,
          height,
          title: 'Схема',
          items: [
            ...frame(width, height),
            ...titleBlock(width, height, {
              meta: { code: '2026-01-СС', object: 'Конференц-зал', stage: 'Р', developer: 'Иванов', organization: 'ООО «Пример»' },
              sheetTitle: 'Структурная схема',
              sheet: 1,
              sheets: 3,
              format: 'A3',
              date: '28.10.26',
            }),
          ],
        },
      ],
      testFonts(),
      { title: 'Тест' }
    );
    const pdf = await PDFDocument.load(pdfBytes);
    expect(pdf.getPageCount()).toBe(1);
    const { width: w, height: h } = pdf.getPage(0).getSize();
    expect(Math.round((w * 25.4) / 72)).toBe(420);
    expect(Math.round((h * 25.4) / 72)).toBe(297);
    expect(pdf.getTitle()).toBe('Тест');
  });

  it('основная надпись 185 × 55 мм вплотную к правому нижнему углу рамки', () => {
    const { width, height } = sheetSize('A3');
    const items = titleBlock(width, height, { meta: {}, sheetTitle: '', sheet: 1, format: 'A3', date: '' });
    const outline = items[0];
    expect(outline.kind).toBe('path');
    if (outline.kind !== 'path') return;
    const f = frameRect(width, height);
    const xs = outline.points.map((p) => p.x);
    const ys = outline.points.map((p) => p.y);
    expect(Math.max(...xs)).toBeCloseTo(f.x + f.width);
    expect(Math.max(...ys)).toBeCloseTo(f.y + f.height);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(TITLE_BLOCK.width);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(TITLE_BLOCK.height);
  });
});
