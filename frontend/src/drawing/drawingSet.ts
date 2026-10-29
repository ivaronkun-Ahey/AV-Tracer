import { ProjectDoc } from '../types/device.types';
import { blockScheme, connectionScheme, functionalLinks, structuralLinks } from './schemes';
import { layoutBlocks, MIN_SHEET_TEXT, placeOnSheet } from './layout';
import { cableColumns, cableRows, SPEC_COLUMNS, specRows, tablePages } from './tables';
import { rackPages } from './rackSheet';
import { planPages } from './planSheet';
import { frame, titleBlock } from './titleBlock';
import { renderPdf } from './pdf';
import { DrawingFonts, createTextKit } from './textkit';
import { Prim, Sheet, SheetFormat, TextMeasure, sheetSize } from './sheet';
import { translit } from './translit';

/**
 * Комплект чертежей (PDF, SVG, DXF, VSDX): схемы (структурная, функциональная, соединений),
 * кабельный журнал и спецификация. Каждый лист — с рамкой и основной надписью
 * по ГОСТ Р 21.101 (форма 3); число листов указывается на первом листе.
 */

export type DrawingKind = 'structural' | 'functional' | 'connections' | 'racks' | 'plan' | 'cables' | 'spec';

export const DRAWING_KINDS: Array<{ kind: DrawingKind; title: string }> = [
  { kind: 'structural', title: 'Схема структурная' },
  { kind: 'functional', title: 'Схема функциональная' },
  { kind: 'connections', title: 'Схема соединений' },
  { kind: 'racks', title: 'Схема расположения оборудования в шкафах' },
  { kind: 'plan', title: 'План расположения оборудования' },
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

/**
 * Подготовка комплекта: раскладка блоков (ELK, асинхронно), затем — функция,
 * которая по метрикам шрифта собирает листы. Одни и те же листы выводятся в
 * PDF, SVG, DXF и VSDX.
 */
export async function prepareDrawingSet(doc: ProjectDoc, opts: DrawingOptions) {
  if (doc.devices.length === 0) throw new Error('схема пуста — нечего выпускать');
  // Схема расположения в шкафах — если есть шкафы, план — если оборудование расставлено на плане
  const available = (k: DrawingKind) =>
    k === 'racks' ? (doc.racks?.length ?? 0) > 0 : k === 'plan' ? doc.devices.some((d) => d.plan) : true;
  const kinds = DRAWING_KINDS.filter((k) => opts.kinds.includes(k.kind) && available(k.kind));
  if (kinds.length === 0) {
    throw new Error(
      opts.kinds.some((k) => k === 'racks' || k === 'plan')
        ? 'в проекте нет шкафов и оборудования на плане — строить не из чего'
        : 'не выбран ни один лист'
    );
  }
  const meta = doc.meta ?? {};
  const notes: string[] = [];

  const structLinks = structuralLinks(doc.devices, doc.connections);
  const funcLinks = functionalLinks(doc.devices, doc.connections);
  const structPos = opts.kinds.includes('structural') ? await layoutBlocks(doc, structLinks) : {};
  const funcPos = opts.kinds.includes('functional') ? await layoutBlocks(doc, funcLinks) : {};

  const build = (measure: TextMeasure): Sheet[] => {
    notes.length = 0;
    const pages: Page[] = [];
    const scheme = (title: string, content: ReturnType<typeof connectionScheme>) => {
      const placed = placeOnSheet(content, opts.format);
      if (placed.minTextMm < MIN_SHEET_TEXT - 0.05) {
        notes.push(
          `«${title}»: на формате ${placed.format} мелкий текст (${placed.minTextMm.toFixed(1)} мм) — выберите формат крупнее или «авто»`
        );
      }
      pages.push({ format: placed.format, title, items: placed.items });
    };
    const table = (title: string, list: ReturnType<typeof tablePages>) =>
      list.forEach((p, i) =>
        pages.push({
          format: p.format,
          title: i === 0 ? title : `${title} (продолжение)`,
          items: p.items,
        })
      );

    for (const { kind, title } of kinds) {
      if (kind === 'structural') scheme(title, blockScheme(doc, structPos, structLinks));
      if (kind === 'functional') scheme(title, blockScheme(doc, funcPos, funcLinks, { legend: true }));
      if (kind === 'connections') scheme(title, connectionScheme(doc));
      if (kind === 'racks') {
        const racks = rackPages(doc, opts.format);
        notes.push(...racks.notes);
        racks.pages.forEach((p, i) => pages.push({ format: p.format, title: i === 0 ? title : `${title} (продолжение)`, items: p.items }));
      }
      if (kind === 'plan') {
        const plans = planPages(doc, opts.format);
        notes.push(...plans.notes);
        plans.pages.forEach((p) => pages.push({ format: p.format, title: `${title}. ${p.room}`, items: p.items }));
      }
      if (kind === 'cables') table(title, tablePages(cableColumns(doc.rooms.length > 0), cableRows(doc), measure));
      if (kind === 'spec') table(title, tablePages(SPEC_COLUMNS, specRows(doc), measure));
    }
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
          ...titleBlock(
            width,
            height,
            {
              meta,
              sheetTitle: p.title,
              sheet: i + 1,
              ...(i === 0 ? { sheets: pages.length } : {}),
              format: p.format,
              date,
            },
            measure
          ),
        ],
      };
    });
  };

  return {
    build,
    notes,
    title: [meta.code, meta.object || 'AV-Tracer'].filter(Boolean).join(' — '),
    author: meta.organization,
  };
}

export async function buildDrawingPdf(doc: ProjectDoc, opts: DrawingOptions, fonts: DrawingFonts): Promise<DrawingResult> {
  const set = await prepareDrawingSet(doc, opts);
  let sheets = 0;
  const bytes = await renderPdf(
    (measure) => {
      const list = set.build(measure);
      sheets = list.length;
      return list;
    },
    fonts,
    { title: set.title, author: set.author }
  );
  return { bytes, sheets, notes: [...set.notes] };
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '');

/**
 * SVG: один файл на лист; несколько листов — ZIP-архив (имена файлов —
 * «01-skhema-strukturnaya.svg» и т. д.).
 */
export async function buildDrawingSvg(
  doc: ProjectDoc,
  opts: DrawingOptions,
  fonts: DrawingFonts
): Promise<DrawingResult & { zip: boolean }> {
  const set = await prepareDrawingSet(doc, opts);
  const kit = await createTextKit(fonts);
  const { sheetToSvg } = await import('./svg');
  const list = set.build(kit.measure);
  const files = list.map((sheet, i) => ({
    name: `${String(i + 1).padStart(2, '0')}-${translit(slug(sheet.title))}.svg`,
    text: sheetToSvg(sheet, kit, `${set.title} — ${sheet.title}`),
  }));
  if (files.length === 1)
    return {
      bytes: new TextEncoder().encode(files[0].text),
      sheets: 1,
      notes: [...set.notes],
      zip: false,
    };
  const { zipSync, strToU8 } = await import('fflate');
  const bytes = zipSync(Object.fromEntries(files.map((f) => [f.name, strToU8(f.text)])));
  return { bytes, sheets: files.length, notes: [...set.notes], zip: true };
}

/** DXF R12: все листы в одном файле, рядом в пространстве модели. */
export async function buildDrawingDxf(doc: ProjectDoc, opts: DrawingOptions, fonts: DrawingFonts): Promise<DrawingResult> {
  const set = await prepareDrawingSet(doc, opts);
  const kit = await createTextKit(fonts);
  const { sheetsToDxf, encodeDxf } = await import('./dxf');
  const list = set.build(kit.measure);
  return {
    bytes: encodeDxf(sheetsToDxf(list, kit)),
    sheets: list.length,
    notes: [...set.notes],
  };
}

/** VSDX (Visio): страница на лист, в натуральную величину. */
export async function buildDrawingVsdx(doc: ProjectDoc, opts: DrawingOptions, fonts: DrawingFonts): Promise<DrawingResult> {
  const set = await prepareDrawingSet(doc, opts);
  const kit = await createTextKit(fonts);
  const { sheetsToVsdx } = await import('./vsdx');
  const list = set.build(kit.measure);
  return { bytes: sheetsToVsdx(list, kit, { title: set.title, author: set.author }), sheets: list.length, notes: [...set.notes] };
}
