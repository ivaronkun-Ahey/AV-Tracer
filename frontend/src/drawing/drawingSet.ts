import { ProjectDoc } from '../types/device.types';
import { blockScheme, connectionScheme, functionalLinks, structuralLinks } from './schemes';
import { layoutBlocks, MIN_SHEET_TEXT, placeOnSheet } from './layout';
import { cableColumns, cableRows, SPEC_COLUMNS, specRows, tablePages } from './tables';
import { frame, titleBlock } from './titleBlock';
import { DrawingFonts, renderPdf } from './pdf';
import { Prim, SheetFormat, sheetSize } from './sheet';

/**
 * Комплект чертежей в PDF: схемы (структурная, функциональная, соединений),
 * кабельный журнал и спецификация. Каждый лист — с рамкой и основной надписью
 * по ГОСТ Р 21.101 (форма 3); число листов указывается на первом листе.
 */

export type DrawingKind = 'structural' | 'functional' | 'connections' | 'cables' | 'spec';

export const DRAWING_KINDS: Array<{ kind: DrawingKind; title: string }> = [
  { kind: 'structural', title: 'Схема структурная' },
  { kind: 'functional', title: 'Схема функциональная' },
  { kind: 'connections', title: 'Схема соединений' },
  { kind: 'cables', title: 'Кабельный журнал' },
  { kind: 'spec', title: 'Спецификация оборудования, изделий и материалов' },
];

export interface DrawingOptions {
  kinds: DrawingKind[];
  /** Формат листов схем; таблицы — всегда А3 (ширина формы ГОСТ 21.110 — 395 мм). */
  format: SheetFormat | 'auto';
  date?: Date;
}

export interface DrawingResult {
  bytes: Uint8Array;
  sheets: number;
  /** Предупреждения для пользователя (например, мелкий текст на выбранном формате). */
  notes: string[];
}

interface Page {
  format: SheetFormat;
  title: string;
  items: Prim[];
}

const shortDate = (d: Date) =>
  `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getFullYear()).slice(2)}`;

export async function buildDrawingPdf(doc: ProjectDoc, opts: DrawingOptions, fonts: DrawingFonts): Promise<DrawingResult> {
  if (doc.devices.length === 0) throw new Error('схема пуста — нечего выпускать');
  const kinds = DRAWING_KINDS.filter((k) => opts.kinds.includes(k.kind));
  if (kinds.length === 0) throw new Error('не выбран ни один лист');
  const meta = doc.meta ?? {};
  const notes: string[] = [];

  // Раскладка блоков (ELK) — асинхронная, до вывода
  const structLinks = structuralLinks(doc.devices, doc.connections);
  const funcLinks = functionalLinks(doc.devices, doc.connections);
  const structPos = opts.kinds.includes('structural') ? await layoutBlocks(doc, structLinks) : {};
  const funcPos = opts.kinds.includes('functional') ? await layoutBlocks(doc, funcLinks) : {};
  let total = 0;

  const bytes = await renderPdf(
    (measure) => {
      const pages: Page[] = [];
      const scheme = (title: string, content: ReturnType<typeof connectionScheme>) => {
        const placed = placeOnSheet(content, opts.format);
        if (placed.minTextMm < MIN_SHEET_TEXT - 0.05) {
          notes.push(`«${title}»: на формате ${placed.format} мелкий текст (${placed.minTextMm.toFixed(1)} мм) — выберите формат крупнее или «авто»`);
        }
        pages.push({ format: placed.format, title, items: placed.items });
      };
      const table = (title: string, tablePagesList: ReturnType<typeof tablePages>) =>
        tablePagesList.forEach((p, i) => pages.push({ format: p.format, title: i === 0 ? title : `${title} (продолжение)`, items: p.items }));

      for (const { kind, title } of kinds) {
        if (kind === 'structural') scheme(title, blockScheme(doc, structPos, structLinks));
        if (kind === 'functional') scheme(title, blockScheme(doc, funcPos, funcLinks, { legend: true }));
        if (kind === 'connections') scheme(title, connectionScheme(doc));
        if (kind === 'cables') table(title, tablePages(cableColumns(doc.rooms.length > 0), cableRows(doc), measure));
        if (kind === 'spec') table(title, tablePages(SPEC_COLUMNS, specRows(doc), measure));
      }
      total = pages.length;
      const date = shortDate(opts.date ?? new Date());
      return pages.map((p, i) => {
        const { width, height } = sheetSize(p.format);
        return {
          format: p.format,
          width,
          height,
          title: p.title,
          items: [
            ...frame(width, height),
            ...p.items,
            ...titleBlock(width, height, {
              meta,
              sheetTitle: p.title,
              sheet: i + 1,
              ...(i === 0 ? { sheets: pages.length } : {}),
              format: p.format,
              date,
            }, measure),
          ],
        };
      });
    },
    fonts,
    { title: [meta.code, meta.object || 'AV-Tracer'].filter(Boolean).join(' — '), author: meta.organization }
  );
  return { bytes, sheets: total, notes };
}
