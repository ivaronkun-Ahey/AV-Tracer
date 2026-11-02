/**
 * Модель листа чертежа: примитивы в миллиметрах от левого верхнего угла листа.
 * Чертёж собирается из модели схемы (вектор), а не из снимка экрана; один и тот
 * же лист выводится в PDF (pdf.ts), позже — в DXF и SVG.
 */

export type LineWeight = 'thick' | 'thin' | 'none';
/** Тип линии по ГОСТ 2.303: сплошная, штриховая, штрихпунктирная тонкая. */
export type LineStyle = 'solid' | 'dashed' | 'dashdot';

export interface Pt {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type Prim =
  | {
      kind: 'path';
      points: Pt[];
      closed?: boolean;
      weight: LineWeight;
      style?: LineStyle;
      /** Заливка (#rrggbb); без неё — только контур. */
      fill?: string;
      /** Стрелка на последней точке (направление сигнала). */
      arrow?: boolean;
    }
  | {
      kind: 'text';
      /** Для align=left — левый край, center — середина, right — правый край. */
      x: number;
      /** Линия основания прописных букв. */
      y: number;
      text: string;
      /** Высота прописных букв, мм (размер шрифта по ГОСТ 2.304). */
      size: number;
      align?: 'left' | 'center' | 'right';
      bold?: boolean;
      /** Не шире, мм: длинный текст уменьшается, затем обрезается многоточием. */
      maxWidth?: number;
      /** Поворот на 90° против часовой (текст снизу вверх) — дополнительные графы. */
      vertical?: boolean;
    }
  | { kind: 'circle'; x: number; y: number; r: number; weight: LineWeight; fill?: string };

export type SheetFormat = 'A4' | 'A3' | 'A2' | 'A1';
export const SHEET_FORMATS: SheetFormat[] = ['A4', 'A3', 'A2', 'A1'];

/** Размеры форматов по ГОСТ 2.301, мм (короткая × длинная сторона). */
const FORMAT_SIZES: Record<SheetFormat, [number, number]> = {
  A4: [210, 297],
  A3: [297, 420],
  A2: [420, 594],
  A1: [594, 841],
};

/** Схемы и таблицы выводятся на листах альбомной ориентации. */
export function sheetSize(format: SheetFormat): { width: number; height: number } {
  const [short, long] = FORMAT_SIZES[format];
  return { width: long, height: short };
}

/** Рамка: 20 мм слева (поле подшивки), по 5 мм с остальных сторон. */
export const FRAME_MARGIN = { left: 20, top: 5, right: 5, bottom: 5 };
/** Основная надпись по форме 3 — в правом нижнем углу рамки. */
export const TITLE_BLOCK = { width: 185, height: 55 };
/** Отступ изображения от рамки и от основной надписи. */
const GAP = 5;

export function frameRect(width: number, height: number): Rect {
  return {
    x: FRAME_MARGIN.left,
    y: FRAME_MARGIN.top,
    width: width - FRAME_MARGIN.left - FRAME_MARGIN.right,
    height: height - FRAME_MARGIN.top - FRAME_MARGIN.bottom,
  };
}

/** Поле для изображения: внутри рамки, над основной надписью. */
export function contentRect(width: number, height: number): Rect {
  const f = frameRect(width, height);
  return { x: f.x + GAP, y: f.y + GAP, width: f.width - GAP * 2, height: f.height - TITLE_BLOCK.height - GAP * 2 };
}

export interface Sheet {
  format: SheetFormat;
  width: number;
  height: number;
  /** Наименование изображения на листе (в основную надпись). */
  title: string;
  items: Prim[];
}

/** Масштаб и сдвиг примитивов (из единиц схемы в миллиметры листа). */
export function transformPrims(prims: Prim[], scale: number, dx: number, dy: number): Prim[] {
  const pt = (p: Pt): Pt => ({ x: p.x * scale + dx, y: p.y * scale + dy });
  return prims.map((p) => {
    switch (p.kind) {
      case 'path':
        return { ...p, points: p.points.map(pt) };
      case 'text':
        return {
          ...p,
          ...pt(p),
          size: p.size * scale,
          ...(p.maxWidth !== undefined ? { maxWidth: p.maxWidth * scale } : {}),
        };
      case 'circle':
        return { ...p, ...pt(p), r: p.r * scale };
    }
  });
}

/** Габариты примитивов (тексты — по точке привязки и оценке ширины). */
export function primsBounds(prims: Prim[]): Rect | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const add = (x: number, y: number) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };
  for (const p of prims) {
    if (p.kind === 'path') p.points.forEach((q) => add(q.x, q.y));
    else if (p.kind === 'circle') {
      add(p.x - p.r, p.y - p.r);
      add(p.x + p.r, p.y + p.r);
    } else {
      const w = p.maxWidth ?? p.text.length * p.size * 0.55;
      const left = p.align === 'center' ? p.x - w / 2 : p.align === 'right' ? p.x - w : p.x;
      add(left, p.y - p.size);
      add(left + w, p.y + p.size * 0.3);
    }
  }
  return minX === Infinity ? null : { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export const rectPath = (r: Rect, weight: LineWeight, style: LineStyle = 'solid', fill?: string): Prim => ({
  kind: 'path',
  points: [
    { x: r.x, y: r.y },
    { x: r.x + r.width, y: r.y },
    { x: r.x + r.width, y: r.y + r.height },
    { x: r.x, y: r.y + r.height },
  ],
  closed: true,
  weight,
  style,
  ...(fill ? { fill } : {}),
});

export const line = (x1: number, y1: number, x2: number, y2: number, weight: LineWeight = 'thin', style?: LineStyle): Prim => ({
  kind: 'path',
  points: [
    { x: x1, y: y1 },
    { x: x2, y: y2 },
  ],
  weight,
  ...(style ? { style } : {}),
});

/** Текст по центру ячейки (по вертикали — по высоте прописных). */
export function cellText(
  r: Rect,
  text: string,
  size: number,
  opts: { align?: 'left' | 'center' | 'right'; bold?: boolean; pad?: number } = {}
): Prim {
  const pad = opts.pad ?? 1;
  const align = opts.align ?? 'center';
  const x = align === 'left' ? r.x + pad : align === 'right' ? r.x + r.width - pad : r.x + r.width / 2;
  return {
    kind: 'text',
    x,
    y: r.y + r.height / 2 + size / 2,
    text,
    size,
    align,
    bold: opts.bold,
    maxWidth: r.width - pad * 2,
  };
}

/** Ширина текста на листе, мм (по шрифту, которым он будет выведен). */
export type TextMeasure = (text: string, sizeMm: number, bold?: boolean) => number;

/** Перенос по словам под ширину колонки; слишком длинное слово режется. */
export function wrapText(text: string, width: number, size: number, measure: TextMeasure): string[] {
  if (!text) return [''];
  const lines: string[] = [];
  let current = '';
  for (const word of text.split(/\s+/)) {
    const candidate = current ? `${current} ${word}` : word;
    if (measure(candidate, size) <= width) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    let rest = word;
    while (measure(rest, size) > width && rest.length > 1) {
      let cut = rest.length - 1;
      while (cut > 1 && measure(rest.slice(0, cut), size) > width) cut -= 1;
      lines.push(rest.slice(0, cut));
      rest = rest.slice(cut);
    }
    current = rest;
  }
  if (current) lines.push(current);
  return lines;
}
