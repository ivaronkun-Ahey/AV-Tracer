import type { PDFDocument, PDFFont } from 'pdf-lib';
import type { TextMeasure } from './sheet';

/**
 * Метрики шрифта чертежа (PT Sans Narrow) для всех форматов вывода: ширина
 * текста, подгонка под ширину графы, замена отсутствующих в шрифте символов.
 * PDF, SVG и DXF размещают текст одинаково.
 */

export const PT_PER_MM = 72 / 25.4;
/** Высота прописных букв PT Sans Narrow относительно кегля. */
export const CAP_HEIGHT = 0.7;
/** Меньше не уменьшаем: текст обрезается многоточием. */
const MIN_TEXT_MM = 1.8;

/** Замены символов, которых нет в шрифте (стрелки); прочие отсутствующие — «?». */
const FALLBACK: Record<string, string> = {
  '→': '->',
  '←': '<-',
  '↔': '<->',
  '⌀': 'ø',
};

export interface DrawingFonts {
  regular: ArrayBuffer | Uint8Array;
  bold: ArrayBuffer | Uint8Array;
}

export interface TextKit {
  measure: TextMeasure;
  /** Текст и высота после подгонки под ширину (уменьшение, затем многоточие). */
  fit: (text: string, sizeMm: number, maxWidthMm?: number, bold?: boolean) => { text: string; size: number };
  fontOf: (bold?: boolean) => PDFFont;
}

/** Кегль шрифта в пунктах для высоты прописных в мм. */
export const emPt = (capMm: number) => (capMm / CAP_HEIGHT) * PT_PER_MM;

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

/** Шрифты встраиваются в документ PDF (для SVG и DXF — во вспомогательный, только ради метрик). */
export async function createTextKit(fonts: DrawingFonts, doc?: PDFDocument): Promise<TextKit> {
  const { PDFDocument } = await import('pdf-lib');
  const fontkit = (await import('@pdf-lib/fontkit')).default;
  const target = doc ?? (await PDFDocument.create());
  target.registerFontkit(fontkit);
  const regular = await target.embedFont(fonts.regular, { subset: true });
  const bold = await target.embedFont(fonts.bold, { subset: true });
  const fontOf = (isBold?: boolean) => (isBold ? bold : regular);
  const supported = new Set([...regular.getCharacterSet(), ...bold.getCharacterSet()]);
  const clean = (text: string) => [...text].map((ch) => (supported.has(ch.codePointAt(0)!) ? ch : (FALLBACK[ch] ?? '?'))).join('');
  const width = (text: string, size: number, isBold?: boolean) => fontOf(isBold).widthOfTextAtSize(text, emPt(size)) / PT_PER_MM;

  const fit: TextKit['fit'] = (raw, sizeMm, maxWidthMm, isBold) => {
    const text = clean(raw);
    if (!maxWidthMm || maxWidthMm <= 0) return { text, size: sizeMm };
    const w = width(text, sizeMm, isBold);
    if (w <= maxWidthMm) return { text, size: sizeMm };
    const size = Math.max(MIN_TEXT_MM, Math.min(sizeMm, (sizeMm * maxWidthMm) / w));
    if (width(text, size, isBold) <= maxWidthMm) return { text, size };
    let cut = text;
    while (cut.length > 1 && width(`${cut}…`, size, isBold) > maxWidthMm) cut = cut.slice(0, -1);
    return { text: cut.length > 1 ? `${cut.trimEnd()}…` : '', size };
  };

  return {
    measure: (text, size, isBold) => width(clean(text), size, isBold),
    fit,
    fontOf,
  };
}

/** Ширина уже подогнанного текста, мм. */
export const textWidth = (kit: TextKit, text: string, sizeMm: number, bold?: boolean) =>
  kit.fontOf(bold).widthOfTextAtSize(text, emPt(sizeMm)) / PT_PER_MM;

/**
 * Подгонка для вывода шрифтом шире PT Sans Narrow (DXF, VSDX): строка та же,
 * что в PDF, но кегль уменьшается, пока она занимает больше доли share ширины графы.
 */
export function fitForSubstitute(
  kit: TextKit,
  text: string,
  sizeMm: number,
  maxWidthMm: number | undefined,
  bold: boolean | undefined,
  share: number
) {
  const fitted = kit.fit(text, sizeMm, maxWidthMm, bold);
  if (!maxWidthMm || !fitted.text) return fitted;
  const width = textWidth(kit, fitted.text, fitted.size, bold);
  return width > maxWidthMm * share ? { text: fitted.text, size: (fitted.size * maxWidthMm * share) / width } : fitted;
}
