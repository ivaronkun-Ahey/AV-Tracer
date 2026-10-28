import type { PDFFont, PDFPage } from 'pdf-lib';
import { LineStyle, LineWeight, Prim, Pt, Sheet, TextMeasure } from './sheet';

/**
 * Вывод листов чертежа в PDF (pdf-lib, загружается только при экспорте).
 * Шрифт — PT Sans Narrow (ParaType, SIL OFL 1.1), встраивается подмножеством
 * глифов; размеры текста на листах заданы высотой прописных букв по ГОСТ 2.304.
 */

const PT_PER_MM = 72 / 25.4;
/** Высота прописных букв PT Sans Narrow относительно кегля. */
const CAP_HEIGHT = 0.7;
/** Меньше не уменьшаем: текст обрезается многоточием. */
const MIN_TEXT_MM = 1.8;
/** Толщина линий по ГОСТ 2.303: основная S и тонкая (S/2…S/3), мм. */
const WEIGHT_MM: Record<LineWeight, number> = { thick: 0.6, thin: 0.25, none: 0 };
const DASH_MM: Record<Exclude<LineStyle, 'solid'>, number[]> = { dashed: [3, 1.5], dashdot: [7, 1.5, 1, 1.5] };
const ARROW = { length: 2.5, halfWidth: 0.9 };

export interface DrawingFonts {
  regular: ArrayBuffer | Uint8Array;
  bold: ArrayBuffer | Uint8Array;
}

export type { TextMeasure };

/** Замены символов, которых нет в шрифте (стрелки); прочие отсутствующие — «?». */
const FALLBACK: Record<string, string> = { '→': '->', '←': '<-', '↔': '<->', '⌀': 'ø' };

export interface PdfInfo {
  title: string;
  author?: string;
}

/** Шрифты из каталога public/fonts (в браузере). */
export async function fetchDrawingFonts(base = import.meta.env.BASE_URL): Promise<DrawingFonts> {
  const load = async (name: string) => {
    const res = await fetch(`${base}fonts/${name}`);
    if (!res.ok) throw new Error(`не удалось загрузить шрифт ${name}`);
    return res.arrayBuffer();
  };
  const [regular, bold] = await Promise.all([load('PTSansNarrow-Regular.ttf'), load('PTSansNarrow-Bold.ttf')]);
  return { regular, bold };
}

/**
 * Собирает PDF: build получает функцию измерения текста (те же шрифты, что и
 * в документе) и возвращает листы.
 */
export async function renderPdf(
  build: (measure: TextMeasure) => Sheet[],
  fonts: DrawingFonts,
  info: PdfInfo
): Promise<Uint8Array> {
  const { PDFDocument } = await import('pdf-lib');
  const fontkit = (await import('@pdf-lib/fontkit')).default;
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const regular = await doc.embedFont(fonts.regular, { subset: true });
  const bold = await doc.embedFont(fonts.bold, { subset: true });
  const fontOf = (isBold?: boolean) => (isBold ? bold : regular);
  const supported = new Set([...regular.getCharacterSet(), ...bold.getCharacterSet()]);
  const clean = (text: string) =>
    [...text].map((ch) => (supported.has(ch.codePointAt(0)!) ? ch : FALLBACK[ch] ?? '?')).join('');
  const measure: TextMeasure = (text, size, isBold) => fontOf(isBold).widthOfTextAtSize(clean(text), emPt(size)) / PT_PER_MM;

  const sheets = build(measure);
  const { rgb, degrees } = await import('pdf-lib');
  const black = rgb(0, 0, 0);
  const color = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
  };

  for (const sheet of sheets) {
    const page = doc.addPage([sheet.width * PT_PER_MM, sheet.height * PT_PER_MM]);
    const H = sheet.height * PT_PER_MM;
    for (const item of sheet.items) drawPrim(page, H, item);
  }

  function drawPrim(page: PDFPage, H: number, p: Prim) {
    if (p.kind === 'path') {
      if (p.points.length < 2) return;
      const d = svgPath(p.points, p.closed);
      const stroke = WEIGHT_MM[p.weight];
      page.drawSvgPath(d, {
        x: 0,
        y: H,
        ...(stroke > 0 ? { borderWidth: stroke * PT_PER_MM, borderColor: black } : { borderWidth: 0 }),
        ...(p.fill ? { color: color(p.fill) } : {}),
        ...(p.style && p.style !== 'solid' && stroke > 0 ? { borderDashArray: DASH_MM[p.style].map((v) => v * PT_PER_MM) } : {}),
      });
      if (p.arrow) {
        const head = arrowHead(p.points[p.points.length - 2], p.points[p.points.length - 1]);
        page.drawSvgPath(svgPath(head, true), { x: 0, y: H, color: black, borderWidth: 0 });
      }
      return;
    }
    if (p.kind === 'circle') {
      const stroke = WEIGHT_MM[p.weight];
      page.drawCircle({
        x: p.x * PT_PER_MM,
        y: H - p.y * PT_PER_MM,
        size: p.r * PT_PER_MM,
        ...(stroke > 0 ? { borderWidth: stroke * PT_PER_MM, borderColor: black } : {}),
        ...(p.fill ? { color: color(p.fill) } : {}),
      });
      return;
    }
    const font = fontOf(p.bold);
    const fitted = fitText(font, clean(p.text), p.size, p.maxWidth);
    if (!fitted.text) return;
    const size = emPt(fitted.size);
    const width = font.widthOfTextAtSize(fitted.text, size) / PT_PER_MM;
    const shift = p.align === 'center' ? width / 2 : p.align === 'right' ? width : 0;
    if (p.vertical) {
      // Снизу вверх: базовая линия вертикальна, выравнивание — вдоль неё
      page.drawText(fitted.text, { x: p.x * PT_PER_MM, y: H - (p.y + shift) * PT_PER_MM, size, font, color: black, rotate: degrees(90) });
    } else {
      page.drawText(fitted.text, { x: (p.x - shift) * PT_PER_MM, y: H - p.y * PT_PER_MM, size, font, color: black });
    }
  }

  doc.setTitle(info.title);
  if (info.author) doc.setAuthor(info.author);
  doc.setCreator('AV-Tracer');
  doc.setProducer('AV-Tracer (pdf-lib)');
  doc.setLanguage('ru-RU');
  return doc.save();
}

const emPt = (capMm: number) => (capMm / CAP_HEIGHT) * PT_PER_MM;

function svgPath(points: Pt[], closed?: boolean): string {
  const f = (v: number) => (v * PT_PER_MM).toFixed(2);
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${f(p.x)} ${f(p.y)}`).join(' ') + (closed ? ' Z' : '');
}

function arrowHead(from: Pt, to: Pt): Pt[] {
  const len = Math.hypot(to.x - from.x, to.y - from.y) || 1;
  const ux = (to.x - from.x) / len;
  const uy = (to.y - from.y) / len;
  const bx = to.x - ux * ARROW.length;
  const by = to.y - uy * ARROW.length;
  return [
    to,
    { x: bx - uy * ARROW.halfWidth, y: by + ux * ARROW.halfWidth },
    { x: bx + uy * ARROW.halfWidth, y: by - ux * ARROW.halfWidth },
  ];
}

/** Уменьшает текст под ширину (не меньше MIN_TEXT_MM), затем обрезает многоточием. */
export function fitText(font: PDFFont, text: string, sizeMm: number, maxWidthMm?: number): { text: string; size: number } {
  if (!maxWidthMm || maxWidthMm <= 0) return { text, size: sizeMm };
  const width = (t: string, s: number) => font.widthOfTextAtSize(t, emPt(s)) / PT_PER_MM;
  const w = width(text, sizeMm);
  if (w <= maxWidthMm) return { text, size: sizeMm };
  const size = Math.max(MIN_TEXT_MM, Math.min(sizeMm, (sizeMm * maxWidthMm) / w));
  if (width(text, size) <= maxWidthMm) return { text, size };
  let cut = text;
  while (cut.length > 1 && width(`${cut}…`, size) > maxWidthMm) cut = cut.slice(0, -1);
  return { text: cut.length > 1 ? `${cut.trimEnd()}…` : '', size };
}
