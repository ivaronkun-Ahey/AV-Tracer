import { describe, it, expect, beforeAll } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { EXAMPLE_PROJECTS } from '../data/examples';
import { withCableLabels } from '../data/cableLabels';
import { withDeviceTags } from '../data/deviceTags';
import { ProjectDoc } from '../types/device.types';
import { Sheet, rectPath } from './sheet';
import { TextKit, createTextKit } from './textkit';
import { dxfText, encodeDxf, sheetsToDxf } from './dxf';
import { sheetToSvg } from './svg';
import { buildDrawingDxf, buildDrawingSvg } from './drawingSet';
import { testFonts } from './testFonts';

const concert = (): ProjectDoc => {
  const p = EXAMPLE_PROJECTS.find((e) => e.id === 'concert')!.build();
  const devices = withDeviceTags(p.devices);
  return {
    devices,
    connections: withCableLabels(devices, p.connections),
    rooms: p.rooms ?? [],
    meta: { code: '2026-01-СС' },
  };
};

const sheet = (title: string): Sheet => ({
  format: 'A4',
  width: 297,
  height: 210,
  title,
  items: [
    rectPath({ x: 10, y: 10, width: 100, height: 50 }, 'thick', 'dashdot'),
    {
      kind: 'path',
      points: [
        { x: 10, y: 100 },
        { x: 60, y: 100 },
      ],
      weight: 'thin',
      style: 'dashed',
      arrow: true,
    },
    { kind: 'circle', x: 50, y: 150, r: 2, weight: 'thin' },
    {
      kind: 'text',
      x: 60,
      y: 30,
      text: 'Пульт & «FOH» → <AMP>',
      size: 3.5,
      align: 'center',
      maxWidth: 80,
    },
    {
      kind: 'text',
      x: 5,
      y: 200,
      text: 'Инв. № подл.',
      size: 2.5,
      vertical: true,
    },
    rectPath({ x: 0, y: 0, width: 5, height: 5 }, 'none', 'solid', '#ffffff'),
  ],
});

/** Пары «код — значение» файла DXF. */
const pairs = (dxf: string) => {
  const lines = dxf.split('\r\n').slice(0, -1);
  const out: Array<[number, string]> = [];
  for (let i = 0; i < lines.length; i += 2) out.push([Number(lines[i]), lines[i + 1]]);
  return { lines, out };
};

/** Значения групп одного объекта, начиная с n-го вхождения типа. */
const entity = (list: Array<[number, string]>, type: string, n = 0) => {
  const starts = list.flatMap(([c, v], i) => (c === 0 && v === type ? [i] : []));
  const from = starts[n];
  const to = list.findIndex(([c], i) => i > from && c === 0);
  return new Map(list.slice(from + 1, to).map(([c, v]) => [c, v]));
};

let kit: TextKit;
beforeAll(async () => {
  kit = await createTextKit(testFonts());
});

describe('DXF', () => {
  it('текст: кириллица и символы кодовой страницы 1251 — как есть, прочее — \\U+XXXX', () => {
    expect(dxfText('Пульт №1 «FOH»')).toBe('Пульт №1 «FOH»');
    expect(dxfText('A→B')).toBe('A\\U+2192B');
    expect(dxfText('a\nb')).toBe('a b');
    expect([...encodeDxf('Жё№»')]).toEqual([0xc6, 0xb8, 0xb9, 0xbb]);
    expect(new TextDecoder('windows-1251').decode(encodeDxf(dxfText('Схема структурная')))).toBe('Схема структурная');
  });

  it('R12: заголовок, таблицы, коды групп, слои и типы линий, листы рядом', () => {
    const dxf = sheetsToDxf([sheet('Первый'), sheet('Второй')], kit);
    const { lines, out } = pairs(dxf);
    expect(lines.length % 2).toBe(0);
    expect(out[0]).toEqual([0, 'SECTION']);
    expect(out[out.length - 1]).toEqual([0, 'EOF']);
    expect(dxf).toContain('$ACADVER\r\n1\r\nAC1009');
    expect(dxf).toContain('$DWGCODEPAGE\r\n3\r\nANSI_1251');
    // Целочисленные коды (флаги, счётчики, цвета) — без дробной части
    for (const [code, value] of out) {
      expect(Number.isInteger(code)).toBe(true);
      if (code >= 60 && code <= 79) expect(value).toMatch(/^-?\d+$/);
    }

    // Замкнутый контур = 4 отрезка, линия со стрелкой = 1 отрезок; подложка без линии не выводится
    const lineCount = out.filter(([c, v]) => c === 0 && v === 'LINE').length;
    expect(lineCount).toBe(2 * 5);
    const frame = entity(out, 'LINE', 0);
    expect(frame.get(8)).toBe('AV_THICK');
    expect(frame.get(6)).toBe('DASHDOT');
    // Ось Y направлена вверх: y = высота листа − y на листе
    expect(Number(frame.get(20))).toBeCloseTo(200);
    const dashed = entity(out, 'LINE', 4);
    expect(dashed.get(8)).toBe('AV_THIN');
    expect(dashed.get(6)).toBe('DASHED');
    expect(out.filter(([c, v]) => c === 0 && v === 'SOLID')).toHaveLength(2);
    expect(Number(entity(out, 'CIRCLE').get(40))).toBeCloseTo(2);

    const centered = entity(out, 'TEXT', 0);
    expect(centered.get(8)).toBe('AV_TEXT');
    expect(centered.get(72)).toBe('1');
    expect(centered.get(1)).toBe('Пульт & «FOH» -> <AMP>'); // стрелки нет в шрифте — замена «->»
    expect(Number(entity(out, 'TEXT', 1).get(50))).toBe(90);

    // Второй лист — правее первого на ширину листа и промежуток 40 мм
    const second = entity(out, 'LINE', 5);
    expect(Number(second.get(10)) - Number(frame.get(10))).toBeCloseTo(297 + 40);
    expect(dxf).toContain('$EXTMAX\r\n10\r\n634.0\r\n20\r\n210.0');
  });

  it('комплект: все листы в одном файле, текст в кодировке 1251', async () => {
    const result = await buildDrawingDxf(
      concert(),
      {
        kinds: ['structural', 'spec'],
        format: 'auto',
        date: new Date('2026-10-28'),
      },
      testFonts()
    );
    expect(result.sheets).toBe(2);
    const text = new TextDecoder('windows-1251').decode(result.bytes);
    expect(text).toContain('Схема структурная');
    expect(text).toContain('2026-01-СС');
    expect(text.endsWith('0\r\nEOF\r\n')).toBe(true);
  });
});

describe('SVG', () => {
  it('лист в миллиметрах, экранирование, пунктир, поворот, длина подогнанного текста', () => {
    const svg = sheetToSvg(sheet('Схема'), kit, 'Шифр — Схема & план');
    expect(svg).toContain('width="297mm" height="210mm" viewBox="0 0 297 210"');
    expect(svg).toContain('<title>Шифр — Схема &amp; план</title>');
    expect(svg).toContain('Пульт &amp; «FOH» -&gt; &lt;AMP&gt;');
    expect(svg).not.toMatch(/&(?!amp;|lt;|gt;|quot;)/);
    expect(svg).toContain('stroke-dasharray="7 1.5 1 1.5"');
    expect(svg).toContain('stroke-dasharray="3 1.5"');
    expect(svg).toContain('text-anchor="middle"');
    expect(svg).toMatch(/textLength="[\d.]+" lengthAdjust="spacingAndGlyphs"/);
    expect(svg).toContain('transform="rotate(-90 5 200)"');
    expect(svg.match(/<text /g)).toHaveLength(2);
    expect(svg.match(/<\/text>/g)).toHaveLength(2);
  });

  it('один лист — файл SVG, несколько — ZIP с латинскими именами', async () => {
    const one = await buildDrawingSvg(concert(), { kinds: ['structural'], format: 'auto' }, testFonts());
    expect(one.zip).toBe(false);
    expect(new TextDecoder().decode(one.bytes)).toMatch(/^<\?xml/);

    const all = await buildDrawingSvg(concert(), { kinds: ['structural', 'cables', 'spec'], format: 'auto' }, testFonts());
    expect(all.zip).toBe(true);
    const files = unzipSync(all.bytes);
    expect(Object.keys(files)).toEqual([
      '01-skhema-strukturnaya.svg',
      '02-kabelnyy-zhurnal.svg',
      '03-spetsifikatsiya-oborudovaniya-izdeliy-i-materialov.svg',
    ]);
    expect(strFromU8(files['02-kabelnyy-zhurnal.svg'])).toContain('Кабельный журнал');
  });
});
