import { ProjectDoc } from '../types/device.types';
import { rackBom, rackTitle } from '../data/racks';
import { buildBom, buildCableSchedule, cableTotals } from '../features/exportDocs';
import { CABLE_DESCRIPTION } from '../data/cables';
import { CableType } from '../types/device.types';
import { Prim, Rect, SheetFormat, TITLE_BLOCK, TextMeasure, frameRect, line, sheetSize, wrapText, cellText } from './sheet';

/**
 * Таблицы на листах: спецификация оборудования по ГОСТ 21.110 (форма 1) и
 * кабельный журнал. Таблица начинается от верхней линии рамки во всю её ширину
 * и заканчивается над основной надписью; заголовок повторяется на каждом листе.
 */

export interface Column {
  title: string;
  width: number;
  align?: 'left' | 'center' | 'right';
  /** Общий заголовок над соседними колонками («Начало», «Конец»). */
  group?: string;
}

export interface TableRow {
  cells: string[];
  /** Заголовок раздела: текст из колонки section, жирным. */
  section?: boolean;
}

export interface TablePage {
  format: SheetFormat;
  width: number;
  height: number;
  items: Prim[];
}

const TEXT = 2.5;
const LINE_STEP = 4;
const MIN_ROW = 8;
const HEADER = 15;
const PAD = 1.2;

/** Колонки растягиваются на ширину рамки, если их сумма меньше. */
function fitColumns(columns: Column[], width: number): Column[] {
  const total = columns.reduce((a, c) => a + c.width, 0);
  return total >= width ? columns : columns.map((c) => ({ ...c, width: (c.width * width) / total }));
}

export function tablePages(
  columns: Column[],
  rows: TableRow[],
  measure: TextMeasure,
  opts: { format?: SheetFormat; sectionColumn?: number } = {}
): TablePage[] {
  const format = opts.format ?? 'A3';
  const { width, height } = sheetSize(format);
  const f = frameRect(width, height);
  const cols = fitColumns(columns, f.width);
  const xs = cols.reduce<number[]>((acc, c) => [...acc, acc[acc.length - 1] + c.width], [f.x]);
  const limit = f.y + f.height - TITLE_BLOCK.height;
  const hasGroups = cols.some((c) => c.group);
  const sectionCol = opts.sectionColumn ?? 1;

  const header = (top: number): Prim[] => {
    const items: Prim[] = [];
    const groupH = hasGroups ? 6 : 0;
    cols.forEach((c, i) => {
      if (c.group && cols[i - 1]?.group === c.group) return;
      if (c.group) {
        const span = cols.slice(i).findIndex((x) => x.group !== c.group);
        const end = span === -1 ? cols.length : i + span;
        items.push(cellText({ x: xs[i], y: top, width: xs[end] - xs[i], height: groupH }, c.group, TEXT));
        items.push(line(xs[i], top + groupH, xs[end], top + groupH, 'thin'));
      }
    });
    cols.forEach((c, i) => {
      const r: Rect = c.group
        ? { x: xs[i], y: top + groupH, width: c.width, height: HEADER - groupH }
        : { x: xs[i], y: top, width: c.width, height: HEADER };
      items.push(...multiline(r, c.title, 'center', false));
    });
    items.push(line(f.x, top + HEADER, f.x + f.width, top + HEADER, 'thick'));
    return items;
  };

  /** Текст ячейки в несколько строк, блок строк — по центру ячейки по вертикали. */
  function multiline(r: Rect, text: string, align: 'left' | 'center' | 'right', bold: boolean): Prim[] {
    const lines = wrapText(text, r.width - PAD * 2, TEXT, measure);
    const top = r.y + (r.height - ((lines.length - 1) * LINE_STEP + TEXT)) / 2;
    const x = align === 'left' ? r.x + PAD : align === 'right' ? r.x + r.width - PAD : r.x + r.width / 2;
    return lines.map((t, i) => ({ kind: 'text', x, y: top + TEXT + i * LINE_STEP, text: t, size: TEXT, align, bold, maxWidth: r.width - PAD * 2 }));
  }

  const rowHeight = (row: TableRow) => {
    const cells = row.section ? [row.cells[sectionCol] ?? ''] : row.cells;
    const widths = row.section ? [cols[sectionCol].width] : cols.map((c) => c.width);
    const lines = Math.max(1, ...cells.map((t, i) => wrapText(t, widths[i] - PAD * 2, TEXT, measure).length));
    return Math.max(MIN_ROW, lines * LINE_STEP + 3);
  };

  const pages: TablePage[] = [];
  let items: Prim[] = [];
  let y = 0;
  const startPage = () => {
    items = header(f.y);
    y = f.y + HEADER;
  };
  const finishPage = () => {
    // Вертикали колонок — основные линии на всю высоту таблицы листа; внутри
    // общего заголовка («Начало», «Конец») — от строки названий колонок
    xs.slice(1, -1).forEach((x, i) => {
      const sameGroup = !!cols[i].group && cols[i].group === cols[i + 1].group;
      items.push(line(x, sameGroup ? f.y + 6 : f.y, x, y, 'thick'));
    });
    pages.push({ format, width, height, items });
  };
  startPage();
  for (const row of rows) {
    const h = rowHeight(row);
    if (y + h > limit && y > f.y + HEADER) {
      finishPage();
      startPage();
    }
    const r = (i: number): Rect => ({ x: xs[i], y, width: cols[i].width, height: h });
    if (row.section) items.push(...multiline(r(sectionCol), row.cells[sectionCol] ?? '', 'left', true));
    else row.cells.forEach((t, i) => t && items.push(...multiline(r(i), t, cols[i].align ?? 'left', false)));
    y += h;
    items.push(line(f.x, y, f.x + f.width, y, 'thin'));
  }
  finishPage();
  return pages;
}

/* ------------------------------------------------------------------ */

/** Спецификация оборудования, изделий и материалов — ГОСТ 21.110, форма 1 (сумма колонок — 395 мм, А3). */
export const SPEC_COLUMNS: Column[] = [
  { title: 'Поз.', width: 20, align: 'center' },
  { title: 'Наименование и техническая характеристика', width: 130 },
  { title: 'Тип, марка оборудования. Обозначение документа, опросного листа', width: 60 },
  { title: 'Код продукции', width: 35 },
  { title: 'Поставщик', width: 45 },
  { title: 'Ед. измерения', width: 20, align: 'center' },
  { title: 'Кол.', width: 20, align: 'center' },
  { title: 'Масса единицы, кг', width: 25, align: 'center' },
  { title: 'Примечание', width: 40 },
];

export function specRows({ devices, connections, rooms, racks = [] }: ProjectDoc): TableRow[] {
  const rows: TableRow[] = [];
  const empty = (name: string): TableRow => ({ cells: ['', name, '', '', '', '', '', '', ''], section: true });
  let room: string | null = null;
  for (const r of buildBom(devices, rooms)) {
    if (rooms.length > 0 && r.room !== room) {
      room = r.room;
      rows.push(empty(r.room || 'Вне помещений'));
    }
    const generic = r.manufacturer === 'Типовое';
    rows.push({
      cells: [
        r.tags.join(', '),
        `${r.type}. ${r.fullName}`,
        r.model,
        '',
        generic ? '' : r.manufacturer,
        'шт.',
        String(r.qty),
        '',
        generic ? 'типовое, подобрать модель' : '',
      ],
    });
  }
  if (racks.length > 0) {
    rows.push(empty('Шкафы'));
    for (const r of rackBom(racks)) {
      rows.push({ cells: ['', rackTitle(r.units), `${r.units}U`, '', '', 'шт.', String(r.qty), '', r.names.join(', ')] });
    }
  }
  const cables = cableTotals(buildCableSchedule(devices, connections, rooms));
  if (cables.length > 0) {
    rows.push(empty('Кабели'));
    for (const t of cables) {
      const type = t.cable.toLowerCase() as CableType;
      rows.push({
        cells: ['', CABLE_DESCRIPTION[type] ?? `Кабель ${t.cable}`, t.cable, '', '', 'м', String(t.length), '', `${t.count} шт. по журналу`],
      });
    }
  }
  return rows;
}

/** Кабельный журнал: с колонками помещений, если в проекте есть помещения (сумма — 395 мм). */
export function cableColumns(withRooms: boolean): Column[] {
  const end = (group: string): Column[] =>
    withRooms
      ? [
          { title: 'Помещение', width: 35, group },
          { title: 'Устройство', width: 55, group },
          { title: 'Разъём', width: 30, group },
        ]
      : [
          { title: 'Устройство', width: 75, group },
          { title: 'Разъём', width: 35, group },
        ];
  return [
    { title: 'Обозна- чение', width: 20, align: 'center' },
    ...end('Начало'),
    ...end('Конец'),
    { title: 'Тип кабеля', width: withRooms ? 35 : 40, align: 'center' },
    { title: 'Сигнал', width: withRooms ? 45 : 55 },
    { title: 'Длина, м', width: withRooms ? 20 : 25, align: 'center' },
    { title: 'Примечание', width: 35 },
  ];
}

export function cableRows({ devices, connections, rooms }: ProjectDoc): TableRow[] {
  const withRooms = rooms.length > 0;
  const rows: TableRow[] = buildCableSchedule(devices, connections, rooms).map((r) => ({
    cells: [
      r.label,
      ...(withRooms ? [r.fromRoom] : []),
      r.from,
      r.fromPort,
      ...(withRooms ? [r.toRoom] : []),
      r.to,
      r.toPort,
      r.cable,
      r.signal,
      String(r.length),
      '',
    ],
  }));
  const totals = cableTotals(buildCableSchedule(devices, connections, rooms));
  if (totals.length > 0) {
    const width = cableColumns(withRooms).length;
    rows.push({ cells: ['', 'Итого по типам кабеля', ...Array(width - 2).fill('')], section: true });
    for (const t of totals) {
      const cells = Array(width).fill('');
      cells[width - 4] = t.cable;
      cells[width - 3] = `${t.count} шт.`;
      cells[width - 2] = String(t.length);
      rows.push({ cells });
    }
  }
  return rows;
}
