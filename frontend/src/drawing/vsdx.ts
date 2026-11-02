import { zipSync, strToU8 } from 'fflate';
import { LineStyle, LineWeight, Pt, Sheet } from './sheet';
import { CAP_HEIGHT, TextKit, emPt, fitForSubstitute, textWidth } from './textkit';
import { WEIGHT_MM, arrowHead } from './pdf';

/**
 * Листы чертежа в VSDX (Visio 2013 и новее; открывается также в LibreOffice
 * Draw): лист чертежа — страница документа в натуральную величину, линии,
 * окружности и подписи — отдельные фигуры. Внутренние единицы Visio — дюймы,
 * в интерфейсе показываются миллиметры. Стрелки — залитые треугольники, как
 * в PDF и SVG.
 */

const NS = 'http://schemas.microsoft.com/office/visio/2012/main';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const REL = 'http://schemas.microsoft.com/visio/2010/relationships';
/**
 * Шрифт — Arial Narrow: он есть везде, где установлен Visio (поставляется с
 * Microsoft Office), а PT Sans Narrow обычно нет. Arial Narrow на 4–12 % шире
 * PT Sans Narrow, по метрикам которого размещается текст, поэтому строка, близкая
 * к ширине графы, уменьшается до 89 % её.
 */
const FONT = 'Arial Narrow';
const FIT = 0.89;
/** Отношение ширины Arial Narrow к PT Sans Narrow (с запасом) — для блока текста. */
const SUBSTITUTE_WIDTH = 1.12;
/** Межстрочный интервал Visio по умолчанию — 120 % кегля. */
const LINE_SPACING = 1.2;

const LINE_PATTERN: Record<LineStyle, number> = { solid: 1, dashed: 2, dashdot: 4 };

const inch = (mm: number) => mm / 25.4;
const n = (v: number) => String(Math.round(v * 1e6) / 1e6);
const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[ch]!);
const cell = (name: string, value: number | string, unit?: string) =>
  `<Cell N='${name}' V='${typeof value === 'number' ? n(value) : esc(value)}'${unit ? ` U='${unit}'` : ''}/>`;
const mm = (name: string, valueMm: number) => cell(name, inch(valueMm), 'MM');

export interface VsdxInfo {
  title: string;
  author?: string;
}

/** Фигура по контуру: геометрия в своей системе координат (начало — левый нижний угол). */
function pathShape(
  id: number,
  points: Pt[],
  closed: boolean,
  sheetHeight: number,
  weight: LineWeight,
  style?: LineStyle,
  fill?: string
): string {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const w = maxX - minX;
  const h = maxY - minY;
  const pts = closed ? [...points, points[0]] : points;
  const rows = pts
    .map((p, i) => `<Row T='${i ? 'LineTo' : 'MoveTo'}' IX='${i + 1}'>${mm('X', p.x - minX)}${mm('Y', maxY - p.y)}</Row>`)
    .join('');
  return (
    `<Shape ID='${id}' Type='Shape' LineStyle='0' FillStyle='0' TextStyle='0'>` +
    mm('PinX', minX + w / 2) +
    mm('PinY', sheetHeight - (minY + h / 2)) +
    mm('Width', w) +
    mm('Height', h) +
    mm('LocPinX', w / 2) +
    mm('LocPinY', h / 2) +
    lineCells(weight, style) +
    (fill ? cell('FillForegnd', fill) + cell('FillPattern', 1) : cell('FillPattern', 0)) +
    `<Section N='Geometry' IX='0'>${cell('NoFill', fill ? 0 : 1)}${cell('NoLine', WEIGHT_MM[weight] > 0 ? 0 : 1)}${rows}</Section>` +
    `</Shape>`
  );
}

function lineCells(weight: LineWeight, style: LineStyle = 'solid'): string {
  const w = WEIGHT_MM[weight];
  if (w <= 0) return cell('LinePattern', 0);
  return mm('LineWeight', w) + cell('LineColor', '#000000') + cell('LinePattern', LINE_PATTERN[style]);
}

function shapes(sheet: Sheet, kit: TextKit): string[] {
  const out: string[] = [];
  let id = 1;
  for (const p of sheet.items) {
    if (p.kind === 'path') {
      if (p.points.length < 2) continue;
      out.push(pathShape(id++, p.points, !!p.closed, sheet.height, p.weight, p.style, p.fill));
      if (p.arrow) {
        const head = arrowHead(p.points[p.points.length - 2], p.points[p.points.length - 1]);
        out.push(pathShape(id++, head, true, sheet.height, 'none', 'solid', '#000000'));
      }
      continue;
    }
    if (p.kind === 'circle') {
      const d = p.r * 2;
      out.push(
        `<Shape ID='${id++}' Type='Shape' LineStyle='0' FillStyle='0' TextStyle='0'>` +
          mm('PinX', p.x) +
          mm('PinY', sheet.height - p.y) +
          mm('Width', d) +
          mm('Height', d) +
          mm('LocPinX', p.r) +
          mm('LocPinY', p.r) +
          lineCells(p.weight) +
          (p.fill ? cell('FillForegnd', p.fill) + cell('FillPattern', 1) : cell('FillPattern', 0)) +
          `<Section N='Geometry' IX='0'>${cell('NoFill', p.fill ? 0 : 1)}<Row T='Ellipse' IX='1'>${mm('X', p.r)}${mm('Y', p.r)}${mm(
            'A',
            d
          )}${mm('B', p.r)}${mm('C', p.r)}${mm('D', d)}</Row></Section>` +
          `</Shape>`
      );
      continue;
    }
    const fitted = fitForSubstitute(kit, p.text, p.size, p.maxWidth, p.bold, FIT);
    if (!fitted.text) continue;
    // Visio переносит текст по ширине блока — блок шире строки с запасом;
    // выравнивание внутри блока сохраняет положение строки
    const width = textWidth(kit, fitted.text, fitted.size, p.bold) * SUBSTITUTE_WIDTH * 1.25 + 2;
    const height = (fitted.size / CAP_HEIGHT) * LINE_SPACING;
    const locX = p.align === 'center' ? width / 2 : p.align === 'right' ? width : 0;
    // Точка привязки — на линии основания; середина прописных совпадает с серединой блока
    const locY = height / 2 - fitted.size / 2;
    out.push(
      `<Shape ID='${id++}' Type='Shape' LineStyle='0' FillStyle='0' TextStyle='0'>` +
        mm('PinX', p.x) +
        mm('PinY', sheet.height - p.y) +
        mm('Width', width) +
        mm('Height', height) +
        mm('LocPinX', locX) +
        mm('LocPinY', locY) +
        (p.vertical ? cell('Angle', Math.PI / 2, 'DEG') : '') +
        cell('LinePattern', 0) +
        cell('FillPattern', 0) +
        mm('LeftMargin', 0) +
        mm('RightMargin', 0) +
        mm('TopMargin', 0) +
        mm('BottomMargin', 0) +
        cell('VerticalAlign', 1) +
        `<Section N='Character'><Row IX='0'>${cell('Font', FONT)}${cell('Color', '#000000')}${cell('Style', p.bold ? 1 : 0)}${cell(
          'Size',
          emPt(fitted.size) / 72,
          'PT'
        )}</Row></Section>` +
        `<Section N='Paragraph'><Row IX='0'>${cell('HorzAlign', p.align === 'center' ? 1 : p.align === 'right' ? 2 : 0)}${cell(
          'SpLine',
          -LINE_SPACING
        )}</Row></Section>` +
        `<Text>${esc(fitted.text)}</Text>` +
        `</Shape>`
    );
  }
  return out;
}

const xml = (body: string) => `<?xml version='1.0' encoding='utf-8' standalone='yes'?>\n${body}`;

const STYLE_SHEET =
  `<StyleSheet ID='0' NameU='No Style' IsCustomNameU='1' Name='No Style' IsCustomName='1'>` +
  [
    cell('EnableLineProps', 1),
    cell('EnableFillProps', 1),
    cell('EnableTextProps', 1),
    cell('HideForApply', 0),
    cell('LineWeight', inch(0.25), 'MM'),
    cell('LineColor', '#000000'),
    cell('LinePattern', 1),
    cell('Rounding', 0),
    cell('BeginArrow', 0),
    cell('EndArrow', 0),
    cell('LineCap', 0),
    cell('FillForegnd', '#ffffff'),
    cell('FillBkgnd', '#ffffff'),
    cell('FillPattern', 1),
    cell('ShdwPattern', 0),
    cell('LeftMargin', 0),
    cell('RightMargin', 0),
    cell('TopMargin', 0),
    cell('BottomMargin', 0),
    cell('VerticalAlign', 1),
    cell('TextBkgnd', 0),
    cell('TextDirection', 0),
  ].join('') +
  `<Section N='Character'><Row IX='0'>${cell('Font', FONT)}${cell('Color', '#000000')}${cell('Style', 0)}${cell(
    'Size',
    emPt(2.5) / 72,
    'PT'
  )}</Row></Section>` +
  `<Section N='Paragraph'><Row IX='0'>${cell('HorzAlign', 1)}${cell('SpLine', -LINE_SPACING)}</Row></Section>` +
  `</StyleSheet>`;

/** Пакет VSDX (OPC/ZIP): документ, список страниц, страница на лист, свойства. */
export function sheetsToVsdx(sheets: Sheet[], kit: TextKit, info: VsdxInfo): Uint8Array {
  const files: Record<string, string> = {};
  files['[Content_Types].xml'] = xml(
    `<Types xmlns='http://schemas.openxmlformats.org/package/2006/content-types'>` +
      `<Default Extension='rels' ContentType='application/vnd.openxmlformats-package.relationships+xml'/>` +
      `<Default Extension='xml' ContentType='application/xml'/>` +
      `<Override PartName='/visio/document.xml' ContentType='application/vnd.ms-visio.drawing.main+xml'/>` +
      `<Override PartName='/visio/pages/pages.xml' ContentType='application/vnd.ms-visio.pages+xml'/>` +
      sheets
        .map((_, i) => `<Override PartName='/visio/pages/page${i + 1}.xml' ContentType='application/vnd.ms-visio.page+xml'/>`)
        .join('') +
      `<Override PartName='/docProps/core.xml' ContentType='application/vnd.openxmlformats-package.core-properties+xml'/>` +
      `<Override PartName='/docProps/app.xml' ContentType='application/vnd.openxmlformats-officedocument.extended-properties+xml'/>` +
      `</Types>`
  );
  files['_rels/.rels'] = xml(
    `<Relationships xmlns='http://schemas.openxmlformats.org/package/2006/relationships'>` +
      `<Relationship Id='rId1' Type='${REL}/document' Target='visio/document.xml'/>` +
      `<Relationship Id='rId2' Type='http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties' Target='docProps/core.xml'/>` +
      `<Relationship Id='rId3' Type='http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties' Target='docProps/app.xml'/>` +
      `</Relationships>`
  );
  files['docProps/core.xml'] = xml(
    `<cp:coreProperties xmlns:cp='http://schemas.openxmlformats.org/package/2006/metadata/core-properties' xmlns:dc='http://purl.org/dc/elements/1.1/'>` +
      `<dc:title>${esc(info.title)}</dc:title>` +
      (info.author ? `<dc:creator>${esc(info.author)}</dc:creator>` : '') +
      `<dc:language>ru-RU</dc:language>` +
      `</cp:coreProperties>`
  );
  files['docProps/app.xml'] = xml(
    `<Properties xmlns='http://schemas.openxmlformats.org/officeDocument/2006/extended-properties'><Application>AV-Tracer</Application></Properties>`
  );
  files['visio/_rels/document.xml.rels'] = xml(
    `<Relationships xmlns='http://schemas.openxmlformats.org/package/2006/relationships'>` +
      `<Relationship Id='rId1' Type='${REL}/pages' Target='pages/pages.xml'/>` +
      `</Relationships>`
  );
  files['visio/document.xml'] = xml(
    `<VisioDocument xmlns='${NS}' xmlns:r='${NS_R}' xml:space='preserve'>` +
      `<DocumentSettings TopPage='0' DefaultTextStyle='0' DefaultLineStyle='0' DefaultFillStyle='0' DefaultGuideStyle='0'>` +
      `<GlueSettings>9</GlueSettings><SnapSettings>65847</SnapSettings><SnapExtensions>34</SnapExtensions><DynamicGridEnabled>0</DynamicGridEnabled>` +
      `<ProtectStyles>0</ProtectStyles><ProtectShapes>0</ProtectShapes><ProtectMasters>0</ProtectMasters><ProtectBkgnds>0</ProtectBkgnds>` +
      `</DocumentSettings>` +
      `<Colors><ColorEntry IX='0' RGB='#000000'/><ColorEntry IX='1' RGB='#FFFFFF'/></Colors>` +
      `<FaceNames><FaceName NameU='${FONT}'/></FaceNames>` +
      `<StyleSheets>${STYLE_SHEET}</StyleSheets>` +
      `</VisioDocument>`
  );
  files['visio/pages/_rels/pages.xml.rels'] = xml(
    `<Relationships xmlns='http://schemas.openxmlformats.org/package/2006/relationships'>` +
      sheets.map((_, i) => `<Relationship Id='rId${i + 1}' Type='${REL}/page' Target='page${i + 1}.xml'/>`).join('') +
      `</Relationships>`
  );
  files['visio/pages/pages.xml'] = xml(
    `<Pages xmlns='${NS}' xmlns:r='${NS_R}' xml:space='preserve'>` +
      sheets
        .map(
          (s, i) =>
            `<Page ID='${i}' NameU='Page-${i + 1}' Name='${esc(`${i + 1}. ${s.title}`)}' IsCustomName='1' IsCustomNameU='1' ViewScale='-1'>` +
            `<PageSheet LineStyle='0' FillStyle='0' TextStyle='0'>` +
            mm('PageWidth', s.width) +
            mm('PageHeight', s.height) +
            cell('PageScale', inch(1), 'MM') +
            cell('DrawingScale', inch(1), 'MM') +
            cell('DrawingSizeType', 3) +
            cell('DrawingScaleType', 0) +
            cell('PrintPageOrientation', s.width > s.height ? 2 : 1) +
            `</PageSheet>` +
            `<Rel r:id='rId${i + 1}'/>` +
            `</Page>`
        )
        .join('') +
      `</Pages>`
  );
  sheets.forEach((s, i) => {
    files[`visio/pages/page${i + 1}.xml`] = xml(
      `<PageContents xmlns='${NS}' xmlns:r='${NS_R}' xml:space='preserve'><Shapes>${shapes(s, kit).join('')}</Shapes></PageContents>`
    );
  });
  return zipSync(Object.fromEntries(Object.entries(files).map(([name, text]) => [name, strToU8(text)])));
}
