import type { PDFPage } from 'pdf-lib';
import { LineStyle, LineWeight, Prim, Pt, Sheet, TextMeasure } from './sheet';
import { DrawingFonts, PT_PER_MM, createTextKit, emPt, textWidth } from './textkit';

/**
 * Вывод листов чертежа в PDF (pdf-lib, загружается только при экспорте).
 * Шрифт — PT Sans Narrow (ParaType, SIL OFL 1.1), встраивается подмножеством
 * глифов; размеры текста на листах заданы высотой прописных букв по ГОСТ 2.304.
 */

/** Толщина линий по ГОСТ 2.303: основная S и тонкая (S/2…S/3), мм. */
export const WEIGHT_MM: Record<LineWeight, number> = {
  thick: 0.6,
  thin: 0.25,
  none: 0,
};
export const DASH_MM: Record<Exclude<LineStyle, 'solid'>, number[]> = {
  dashed: [3, 1.5],
  dashdot: [7, 1.5, 1, 1.5],
};
const ARROW = { length: 2.5, halfWidth: 0.9 };

export type { TextMeasure, DrawingFonts };
export { fetchDrawingFonts } from './textkit';

export interface PdfInfo {
  title: string;
  author?: string;
}

/**
 * Собирает PDF: build получает функцию измерения текста (те же шрифты, что и
 * в документе) и возвращает листы.
 */
export async function renderPdf(build: (measure: TextMeasure) => Sheet[], fonts: DrawingFonts, info: PdfInfo): Promise<Uint8Array> {
  const { PDFDocument, rgb, degrees } = await import('pdf-lib');
  const doc = await PDFDocument.create();
  const kit = await createTextKit(fonts, doc);
  const sheets = build(kit.measure);
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
        page.drawSvgPath(svgPath(head, true), {
          x: 0,
          y: H,
          color: black,
          borderWidth: 0,
        });
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
    const fitted = kit.fit(p.text, p.size, p.maxWidth, p.bold);
    if (!fitted.text) return;
    const font = kit.fontOf(p.bold);
    const size = emPt(fitted.size);
    const shift = alignShift(p.align, textWidth(kit, fitted.text, fitted.size, p.bold));
    if (p.vertical) {
      // Снизу вверх: базовая линия вертикальна, выравнивание — вдоль неё
      page.drawText(fitted.text, {
        x: p.x * PT_PER_MM,
        y: H - (p.y + shift) * PT_PER_MM,
        size,
        font,
        color: black,
        rotate: degrees(90),
      });
    } else {
      page.drawText(fitted.text, {
        x: (p.x - shift) * PT_PER_MM,
        y: H - p.y * PT_PER_MM,
        size,
        font,
        color: black,
      });
    }
  }

  doc.setTitle(info.title);
  if (info.author) doc.setAuthor(info.author);
  doc.setCreator('AV-Tracer');
  doc.setProducer('AV-Tracer (pdf-lib)');
  doc.setLanguage('ru-RU');
  return doc.save();
}

/** Сдвиг начала текста при выравнивании по центру или вправо, мм. */
export const alignShift = (align: 'left' | 'center' | 'right' | undefined, width: number) =>
  align === 'center' ? width / 2 : align === 'right' ? width : 0;

function svgPath(points: Pt[], closed?: boolean): string {
  const f = (v: number) => (v * PT_PER_MM).toFixed(2);
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${f(p.x)} ${f(p.y)}`).join(' ') + (closed ? ' Z' : '');
}

/** Наконечник стрелки (треугольник) на конце отрезка from → to, мм. */
export function arrowHead(from: Pt, to: Pt): Pt[] {
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
