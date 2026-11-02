import { Prim, Pt, Sheet } from './sheet';
import { CAP_HEIGHT, TextKit, textWidth } from './textkit';
import { DASH_MM, WEIGHT_MM, arrowHead } from './pdf';

/**
 * Лист чертежа в SVG: единицы — миллиметры (размер листа задан в мм), текст —
 * PT Sans Narrow с подстановкой Arial Narrow/Arial, если шрифт не установлен.
 * Подгонка текста под графы — по метрикам шрифта, как в PDF.
 */

const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);
const n = (v: number) => String(Math.round(v * 1000) / 1000);
const points = (pts: Pt[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${n(p.x)} ${n(p.y)}`).join(' ');

function prim(p: Prim, kit: TextKit): string {
  if (p.kind === 'path') {
    if (p.points.length < 2) return '';
    const stroke = WEIGHT_MM[p.weight];
    const dash = p.style && p.style !== 'solid' && stroke > 0 ? ` stroke-dasharray="${DASH_MM[p.style].join(' ')}"` : '';
    const line = `<path d="${points(p.points)}${p.closed ? ' Z' : ''}" fill="${p.fill ?? 'none'}" stroke="${stroke > 0 ? '#000' : 'none'}"${
      stroke > 0 ? ` stroke-width="${stroke}"` : ''
    }${dash} stroke-linejoin="round"/>`;
    if (!p.arrow) return line;
    const head = arrowHead(p.points[p.points.length - 2], p.points[p.points.length - 1]);
    return `${line}<path d="${points(head)} Z" fill="#000"/>`;
  }
  if (p.kind === 'circle') {
    const stroke = WEIGHT_MM[p.weight];
    return `<circle cx="${n(p.x)}" cy="${n(p.y)}" r="${n(p.r)}" fill="${p.fill ?? 'none'}" stroke="${stroke > 0 ? '#000' : 'none'}"${
      stroke > 0 ? ` stroke-width="${stroke}"` : ''
    }/>`;
  }
  const fitted = kit.fit(p.text, p.size, p.maxWidth, p.bold);
  if (!fitted.text) return '';
  const anchor = p.align === 'center' ? 'middle' : p.align === 'right' ? 'end' : 'start';
  // Подогнанный по метрикам текст фиксируем по длине — подстановочный шрифт не вылезет из графы
  const length = textWidth(kit, fitted.text, fitted.size, p.bold);
  const attrs = [
    `x="${n(p.x)}"`,
    `y="${n(p.y)}"`,
    `font-size="${n(fitted.size / CAP_HEIGHT)}"`,
    anchor !== 'start' ? `text-anchor="${anchor}"` : '',
    p.bold ? 'font-weight="bold"' : '',
    p.maxWidth ? `textLength="${n(length)}" lengthAdjust="spacingAndGlyphs"` : '',
    p.vertical ? `transform="rotate(-90 ${n(p.x)} ${n(p.y)})"` : '',
  ].filter(Boolean);
  return `<text ${attrs.join(' ')}>${esc(fitted.text)}</text>`;
}

export function sheetToSvg(sheet: Sheet, kit: TextKit, title = sheet.title): string {
  const body = sheet.items
    .map((p) => prim(p, kit))
    .filter(Boolean)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${sheet.width}mm" height="${sheet.height}mm" viewBox="0 0 ${sheet.width} ${sheet.height}">
<title>${esc(title)}</title>
<style>text{font-family:'PT Sans Narrow','Arial Narrow',Arial,sans-serif;fill:#000}</style>
<rect width="${sheet.width}" height="${sheet.height}" fill="#ffffff"/>
${body}
</svg>
`;
}
