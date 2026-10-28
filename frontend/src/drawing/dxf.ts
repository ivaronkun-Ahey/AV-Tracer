import { LineStyle, Prim, Pt, Sheet } from './sheet';
import { TextKit } from './textkit';
import { arrowHead } from './pdf';

/**
 * Листы чертежа в DXF R12 (AC1009) — открывается в AutoCAD, nanoCAD, LibreCAD
 * и других САПР. Единицы — миллиметры; листы стоят в пространстве модели
 * рядом слева направо. Толщины линий в R12 не задаются — линии разложены по
 * слоям: AV_THICK (основная, 0,6 мм), AV_THIN (тонкая, 0,25 мм), AV_TEXT;
 * толщины назначаются слоям в САПР. Типы линий — DASHED и DASHDOT по ГОСТ 2.303.
 * Текст — в кодовой странице 1251 ($DWGCODEPAGE ANSI_1251), символы вне её —
 * кодами \U+XXXX.
 */

const GAP_BETWEEN_SHEETS = 40;
/** PT Sans Narrow уже Arial: коэффициент ширины стиля текста. */
const WIDTH_FACTOR = 0.82;

const LTYPE: Record<Exclude<LineStyle, 'solid'>, string> = {
  dashed: 'DASHED',
  dashdot: 'DASHDOT',
};

let cp1251: Map<string, number> | undefined;
/** Верхняя половина кодовой страницы 1251: символ → байт (таблицу даёт TextDecoder). */
function cp1251Table(): Map<string, number> {
  if (!cp1251) {
    const chars = [...new TextDecoder('windows-1251').decode(Uint8Array.from({ length: 128 }, (_, i) => 128 + i))];
    cp1251 = new Map();
    chars.forEach((ch, i) => {
      const code = ch.codePointAt(0)!;
      if (code !== 0xfffd && (code < 0x80 || code > 0x9f)) cp1251!.set(ch, 128 + i);
    });
  }
  return cp1251;
}

/** Текст DXF: ASCII и символы кодовой страницы 1251 как есть, прочие — \U+XXXX. */
export function dxfText(s: string): string {
  const table = cp1251Table();
  return [...s]
    .map((ch) => {
      const code = ch.codePointAt(0)!;
      if (code < 32) return ' ';
      if (code < 127 || table.has(ch)) return ch;
      return `\\U+${code.toString(16).toUpperCase().padStart(4, '0')}`;
    })
    .join('');
}

/** Байты файла в кодовой странице 1251 (текст уже подготовлен dxfText). */
export function encodeDxf(text: string): Uint8Array {
  const table = cp1251Table();
  const chars = [...text];
  const out = new Uint8Array(chars.length);
  chars.forEach((ch, i) => {
    const code = ch.codePointAt(0)!;
    out[i] = code < 128 ? code : (table.get(ch) ?? 0x3f);
  });
  return out;
}

/** Целочисленные коды групп (флаги, счётчики, цвета) пишутся без дробной части. */
const isIntegerCode = (code: number) => (code >= 60 && code <= 79) || (code >= 90 && code <= 99) || (code >= 170 && code <= 179);

class Writer {
  private out: string[] = [];
  pair(code: number, value: string | number) {
    const text = typeof value === 'string' ? value : isIntegerCode(code) ? String(Math.round(value)) : fmt(value);
    this.out.push(String(code), text);
  }
  text() {
    return this.out.join('\r\n') + '\r\n';
  }
}

const fmt = (v: number) => (Number.isInteger(v) ? v.toFixed(1) : String(Math.round(v * 10000) / 10000));

export function sheetsToDxf(sheets: Sheet[], kit: TextKit): string {
  const w = new Writer();
  const totalWidth = sheets.reduce((a, s) => a + s.width, 0) + GAP_BETWEEN_SHEETS * Math.max(0, sheets.length - 1);
  const maxHeight = Math.max(0, ...sheets.map((s) => s.height));

  // --- Заголовок ---
  w.pair(0, 'SECTION');
  w.pair(2, 'HEADER');
  w.pair(9, '$ACADVER');
  w.pair(1, 'AC1009');
  w.pair(9, '$DWGCODEPAGE');
  w.pair(3, 'ANSI_1251');
  w.pair(9, '$INSBASE');
  [10, 20, 30].forEach((c) => w.pair(c, 0));
  w.pair(9, '$EXTMIN');
  [10, 20, 30].forEach((c) => w.pair(c, 0));
  w.pair(9, '$EXTMAX');
  w.pair(10, totalWidth);
  w.pair(20, maxHeight);
  w.pair(30, 0);
  w.pair(9, '$LIMMIN');
  w.pair(10, 0);
  w.pair(20, 0);
  w.pair(9, '$LIMMAX');
  w.pair(10, totalWidth);
  w.pair(20, maxHeight);
  w.pair(0, 'ENDSEC');

  // --- Таблицы: типы линий, слои, стиль текста ---
  w.pair(0, 'SECTION');
  w.pair(2, 'TABLES');
  const ltypes: Array<[string, string, number[]]> = [
    ['CONTINUOUS', 'Solid line', []],
    ['DASHED', 'Dashed __ __ __', [3, -1.5]],
    ['DASHDOT', 'Dash dot __ . __', [7, -1.5, 0, -1.5]],
  ];
  w.pair(0, 'TABLE');
  w.pair(2, 'LTYPE');
  w.pair(70, ltypes.length);
  for (const [name, description, pattern] of ltypes) {
    w.pair(0, 'LTYPE');
    w.pair(2, name);
    w.pair(70, 0);
    w.pair(3, description);
    w.pair(72, 65);
    w.pair(73, pattern.length);
    w.pair(
      40,
      pattern.reduce((a, v) => a + Math.abs(v), 0)
    );
    pattern.forEach((v) => w.pair(49, v));
  }
  w.pair(0, 'ENDTAB');
  const layers: Array<[string, number]> = [
    ['0', 7],
    ['AV_THICK', 7],
    ['AV_THIN', 7],
    ['AV_TEXT', 7],
  ];
  w.pair(0, 'TABLE');
  w.pair(2, 'LAYER');
  w.pair(70, layers.length);
  for (const [name, color] of layers) {
    w.pair(0, 'LAYER');
    w.pair(2, name);
    w.pair(70, 0);
    w.pair(62, color);
    w.pair(6, 'CONTINUOUS');
  }
  w.pair(0, 'ENDTAB');
  w.pair(0, 'TABLE');
  w.pair(2, 'STYLE');
  w.pair(70, 1);
  w.pair(0, 'STYLE');
  w.pair(2, 'AVTRACER');
  w.pair(70, 0);
  w.pair(40, 0);
  w.pair(41, WIDTH_FACTOR);
  w.pair(50, 0);
  w.pair(71, 0);
  w.pair(42, 2.5);
  w.pair(3, 'arial.ttf');
  w.pair(4, '');
  w.pair(0, 'ENDTAB');
  w.pair(0, 'ENDSEC');

  // --- Объекты: листы слева направо ---
  w.pair(0, 'SECTION');
  w.pair(2, 'ENTITIES');
  let offset = 0;
  for (const sheet of sheets) {
    const at = (p: Pt) => ({ x: offset + p.x, y: sheet.height - p.y });
    for (const p of sheet.items) entity(w, p, at, kit);
    offset += sheet.width + GAP_BETWEEN_SHEETS;
  }
  w.pair(0, 'ENDSEC');
  w.pair(0, 'EOF');
  return w.text();
}

function entity(w: Writer, p: Prim, at: (p: Pt) => Pt, kit: TextKit) {
  if (p.kind === 'path') {
    if (p.weight === 'none' || p.points.length < 2) return; // подложки под подписями в САПР не нужны
    const layer = p.weight === 'thick' ? 'AV_THICK' : 'AV_THIN';
    const pts = p.closed ? [...p.points, p.points[0]] : p.points;
    for (let i = 1; i < pts.length; i++) {
      const a = at(pts[i - 1]);
      const b = at(pts[i]);
      w.pair(0, 'LINE');
      w.pair(8, layer);
      if (p.style && p.style !== 'solid') w.pair(6, LTYPE[p.style]);
      w.pair(10, a.x);
      w.pair(20, a.y);
      w.pair(30, 0);
      w.pair(11, b.x);
      w.pair(21, b.y);
      w.pair(31, 0);
    }
    if (p.arrow) {
      const [t, l, r] = arrowHead(p.points[p.points.length - 2], p.points[p.points.length - 1]).map(at);
      w.pair(0, 'SOLID');
      w.pair(8, layer);
      [
        [10, 20, t],
        [11, 21, l],
        [12, 22, r],
        [13, 23, r],
      ].forEach(([cx, cy, q]) => {
        w.pair(cx as number, (q as Pt).x);
        w.pair(cy as number, (q as Pt).y);
      });
    }
    return;
  }
  if (p.kind === 'circle') {
    const c = at(p);
    w.pair(0, 'CIRCLE');
    w.pair(8, p.weight === 'thick' ? 'AV_THICK' : 'AV_THIN');
    w.pair(10, c.x);
    w.pair(20, c.y);
    w.pair(30, 0);
    w.pair(40, p.r);
    return;
  }
  const fitted = kit.fit(p.text, p.size, p.maxWidth, p.bold);
  if (!fitted.text) return;
  const q = at(p);
  const justify = p.align === 'center' ? 1 : p.align === 'right' ? 2 : 0;
  w.pair(0, 'TEXT');
  w.pair(8, 'AV_TEXT');
  w.pair(7, 'AVTRACER');
  w.pair(10, q.x);
  w.pair(20, q.y);
  w.pair(30, 0);
  w.pair(40, fitted.size);
  w.pair(1, dxfText(fitted.text));
  if (p.vertical) w.pair(50, 90);
  w.pair(41, WIDTH_FACTOR);
  if (justify) {
    w.pair(72, justify);
    w.pair(11, q.x);
    w.pair(21, q.y);
    w.pair(31, 0);
  }
}
