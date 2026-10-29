import { ProjectMeta } from '../types/device.types';
import { Prim, Rect, SheetFormat, TITLE_BLOCK, TextMeasure, cellText, frameRect, line, rectPath, wrapText } from './sheet';

/**
 * Основная надпись по ГОСТ Р 21.101-2020, форма 3 (листы основного комплекта
 * рабочих чертежей и графической части проектной документации), 185 × 55 мм,
 * и дополнительные графы в поле подшивки.
 *
 * Расположение и размеры граф заданы таблицей ниже — так их проще сверить с
 * приложением Ж стандарта и поправить в одном месте. Сверка с текстом
 * стандарта не выполнена (он недоступен из среды разработки): см. docs/STATUS.md.
 */

export interface StampData {
  meta: ProjectMeta;
  /** Наименование изображения на листе. */
  sheetTitle: string;
  sheet: number;
  /** Общее число листов — только на первом листе комплекта. */
  sheets?: number;
  format: SheetFormat;
  /** Дата выпуска (ДД.ММ.ГГ) — в графу «Дата» у исполнителей. */
  date: string;
}

/** Левая часть: колонки «Изм. | Кол.уч. | Лист | № док. | Подп. | Дата», мм. */
const LEFT_COLS = [10, 10, 10, 10, 15, 10];
const LEFT_WIDTH = LEFT_COLS.reduce((a, b) => a + b, 0);
const ROW = 5;
/** Строки изменений над заголовком таблицы. */
const CHANGE_ROWS = 2;

/** Правая часть: графы сверху вниз (высоты, мм). */
const RIGHT = {
  code: 15, // обозначение документа (шифр)
  object: 10, // наименование объекта
  building: 15, // наименование здания; «Стадия | Лист | Листов»
  title: 15, // наименование изображения; организация-разработчик
};
/** Колонки нижних строк правой части, мм: наименование | стадия | лист | листов. */
const RIGHT_COLS = { name: 70, stage: 15, sheet: 15, sheets: 20 };

const ROLES: Array<[string, keyof ProjectMeta]> = [
  ['Разраб.', 'developer'],
  ['Пров.', 'checker'],
  ['Н. контр.', 'normControl'],
  ['ГИП', 'chiefEngineer'],
];

/**
 * Текст графы в несколько строк (если не помещается в одну и есть измеритель);
 * строк больше, чем помещается, — текст уменьшается до 2,5 мм.
 */
function boxText(r: Rect, text: string, size: number, measure?: TextMeasure): Prim[] {
  if (!text) return [];
  const pad = 1.5;
  if (!measure || measure(text, size) <= r.width - pad * 2) return [cellText(r, text, size)];
  let s = size;
  let lines = wrapText(text, r.width - pad * 2, s, measure);
  while (lines.length * s * 1.5 > r.height && s > 2.5) {
    s = Math.max(2.5, s - 0.5);
    lines = wrapText(text, r.width - pad * 2, s, measure);
  }
  const step = s * 1.5;
  const top = r.y + (r.height - ((lines.length - 1) * step + s)) / 2;
  return lines.map((t, i) => ({ kind: 'text', x: r.x + r.width / 2, y: top + s + i * step, text: t, size: s, align: 'center', maxWidth: r.width - pad * 2 }));
}

/** Основная надпись в правом нижнем углу рамки листа. */
export function titleBlock(width: number, height: number, data: StampData, measure?: TextMeasure): Prim[] {
  const f = frameRect(width, height);
  const x0 = f.x + f.width - TITLE_BLOCK.width;
  const y0 = f.y + f.height - TITLE_BLOCK.height;
  const items: Prim[] = [rectPath({ x: x0, y: y0, width: TITLE_BLOCK.width, height: TITLE_BLOCK.height }, 'thick')];

  // --- Левая часть: изменения и исполнители ---
  const colX = LEFT_COLS.reduce<number[]>((acc, w) => [...acc, acc[acc.length - 1] + w], [x0]);
  const rows = TITLE_BLOCK.height / ROW;
  for (let i = 1; i < rows; i++) {
    const y = y0 + i * ROW;
    // Линия под заголовком таблицы изменений — основная
    items.push(line(x0, y, x0 + LEFT_WIDTH, y, i === CHANGE_ROWS + 1 ? 'thick' : 'thin'));
  }
  // Вертикали: в таблице изменений — все колонки, в строках исполнителей — «должность | фамилия | подпись | дата»
  const changesBottom = y0 + (CHANGE_ROWS + 1) * ROW;
  colX.slice(1, -1).forEach((x, i) => {
    const spansPeople = i !== 0 && i !== 2; // после «Изм.» и «Лист» в строках исполнителей линии нет
    items.push(line(x, y0, x, spansPeople ? y0 + TITLE_BLOCK.height : changesBottom, 'thick'));
  });
  items.push(line(x0 + LEFT_WIDTH, y0, x0 + LEFT_WIDTH, y0 + TITLE_BLOCK.height, 'thick'));

  const head = ['Изм.', 'Кол.уч.', 'Лист', '№ док.', 'Подп.', 'Дата'];
  head.forEach((t, i) => items.push(cellText(cell(colX[i], y0 + CHANGE_ROWS * ROW, LEFT_COLS[i], ROW), t, 2.5, { pad: 0.5 })));
  ROLES.forEach(([role, key], i) => {
    const y = changesBottom + i * ROW;
    items.push(cellText(cell(colX[0], y, 20, ROW), role, 2.5, { align: 'left' }));
    const name = data.meta[key];
    if (name) {
      items.push(cellText(cell(colX[2], y, 20, ROW), name, 2.5, { align: 'left' }));
      items.push(cellText(cell(colX[5], y, LEFT_COLS[5], ROW), data.date, 2.5, { pad: 0.7 }));
    }
  });

  // --- Правая часть ---
  const xr = x0 + LEFT_WIDTH;
  const wr = TITLE_BLOCK.width - LEFT_WIDTH;
  let y = y0;
  const codeCell = cell(xr, y, wr, RIGHT.code);
  items.push(cellText(codeCell, data.meta.code || '', 5));
  y += RIGHT.code;
  items.push(line(xr, y, xr + wr, y, 'thick'));
  items.push(...boxText(cell(xr, y, wr, RIGHT.object), data.meta.object || '', 3.5, measure));
  y += RIGHT.object;
  items.push(line(xr, y, xr + wr, y, 'thick'));

  const xStage = xr + RIGHT_COLS.name;
  const xSheet = xStage + RIGHT_COLS.stage;
  const xSheets = xSheet + RIGHT_COLS.sheet;
  items.push(...boxText(cell(xr, y, RIGHT_COLS.name, RIGHT.building), data.meta.building || '', 3.5, measure));
  for (const x of [xStage, xSheet, xSheets]) items.push(line(x, y, x, y + RIGHT.building, 'thick'));
  items.push(line(xStage, y + ROW, xr + wr, y + ROW, 'thin'));
  items.push(cellText(cell(xStage, y, RIGHT_COLS.stage, ROW), 'Стадия', 2.5));
  items.push(cellText(cell(xSheet, y, RIGHT_COLS.sheet, ROW), 'Лист', 2.5));
  items.push(cellText(cell(xSheets, y, RIGHT_COLS.sheets, ROW), 'Листов', 2.5));
  const valueRow = (x: number, w: number) => cell(x, y + ROW, w, RIGHT.building - ROW);
  items.push(cellText(valueRow(xStage, RIGHT_COLS.stage), data.meta.stage || '', 3.5));
  items.push(cellText(valueRow(xSheet, RIGHT_COLS.sheet), String(data.sheet), 3.5));
  if (data.sheets) items.push(cellText(valueRow(xSheets, RIGHT_COLS.sheets), String(data.sheets), 3.5));
  y += RIGHT.building;
  items.push(line(xr, y, xr + wr, y, 'thick'));
  items.push(line(xStage, y, xStage, y + RIGHT.title, 'thick'));
  items.push(...boxText(cell(xr, y, RIGHT_COLS.name, RIGHT.title), data.sheetTitle, 3.5, measure));
  items.push(...boxText(cell(xStage, y, wr - RIGHT_COLS.name, RIGHT.title), data.meta.organization || '', 3.5, measure));

  return [...items, ...additionalGraphs(width, height), ...formatLabel(width, height, data.format)];
}

const cell = (x: number, y: number, width: number, height: number): Rect => ({ x, y, width, height });

/**
 * Дополнительные графы в поле подшивки слева от рамки (снизу вверх):
 * «Инв. № подл.» 25 мм, «Подп. и дата» 35 мм, «Взам. инв. №» 25 мм;
 * колонки 5 мм (наименование) и 7 мм (значение).
 */
function additionalGraphs(width: number, height: number): Prim[] {
  const f = frameRect(width, height);
  const x1 = f.x - 12;
  const x2 = f.x - 7;
  const items: Prim[] = [];
  let bottom = f.y + f.height;
  for (const [label, h] of [
    ['Инв. № подл.', 25],
    ['Подп. и дата', 35],
    ['Взам. инв. №', 25],
  ] as Array<[string, number]>) {
    const top = bottom - h;
    items.push(rectPath({ x: x1, y: top, width: 12, height: h }, 'thick'));
    items.push(line(x2, top, x2, bottom, 'thick'));
    items.push({ kind: 'text', x: x1 + 3.6, y: bottom - h / 2, text: label, size: 2.5, align: 'center', vertical: true, maxWidth: h - 2 });
    bottom = top;
  }
  return items;
}

/** Обозначение формата под рамкой справа. */
function formatLabel(width: number, height: number, format: SheetFormat): Prim[] {
  const f = frameRect(width, height);
  return [{ kind: 'text', x: f.x + f.width - 5, y: height - 1.2, text: `Формат ${format}`, size: 2.5, align: 'right' }];
}

/** Рамка листа (основная линия). */
export function frame(width: number, height: number): Prim[] {
  return [rectPath(frameRect(width, height), 'thick')];
}
