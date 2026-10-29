import { Device, ProjectDoc, Room } from '../types/device.types';
import { validSize } from '../data/plan';
import { Prim, SHEET_FORMATS, SheetFormat, contentRect, line, rectPath, sheetSize } from './sheet';

/**
 * План расположения оборудования: помещение в масштабе (ряд 1:20…1:1000),
 * стены, размеры в миллиметрах, оборудование — условными кружками с
 * позиционными обозначениями, направление колонок и камер — штрихом.
 * Лист на каждое помещение, где задан размер и расставлено оборудование.
 */

const SCALES = [20, 50, 100, 200, 500, 1000];
const TEXT = 2.5;
/** Поле под заголовок помещения, размерные линии и примечание, мм. */
const MARGIN = { left: 14, top: 18, right: 6, bottom: 12 };
const MARK_R = 2;

export const planNote = (scale: number) => `М 1:${scale}. Размеры — в миллиметрах. Обозначения — позиционные, по спецификации.`;

/** Размерная линия с засечками (как на строительных чертежах) и числом над ней. */
function dimension(x1: number, y1: number, x2: number, y2: number, value: string, vertical: boolean): Prim[] {
  const tick = 1.5;
  const items: Prim[] = [line(x1, y1, x2, y2)];
  for (const [x, y] of [
    [x1, y1],
    [x2, y2],
  ]) {
    items.push(line(x - tick, y + tick, x + tick, y - tick));
  }
  if (vertical) items.push({ kind: 'text', x: x1 - 1.5, y: (y1 + y2) / 2, text: value, size: TEXT, align: 'center', vertical: true });
  else items.push({ kind: 'text', x: (x1 + x2) / 2, y: y1 - 1.5, text: value, size: TEXT, align: 'center' });
  return items;
}

function drawRoom(room: Room, devices: Device[], scale: number, x0: number, y0: number): Prim[] {
  const size = room.size!;
  const mm = (m: number) => (m * 1000) / scale;
  const w = mm(size.width);
  const h = mm(size.length);
  const left = x0 + MARGIN.left;
  const top = y0 + MARGIN.top;
  const items: Prim[] = [
    { kind: 'text', x: left, y: y0 + 4, text: room.name, size: 3.5, bold: true, maxWidth: Math.max(60, w) },
    rectPath({ x: left, y: top, width: w, height: h }, 'thick'),
    ...dimension(left, top - 6, left + w, top - 6, String(Math.round(size.width * 1000)), false),
    ...dimension(left - 6, top, left - 6, top + h, String(Math.round(size.length * 1000)), true),
  ];
  for (const d of devices) {
    if (!d.plan || d.room !== room.id) continue;
    const cx = left + mm(d.plan.x);
    const cy = top + mm(d.plan.y);
    items.push({ kind: 'circle', x: cx, y: cy, r: MARK_R, weight: 'thin', fill: '#ffffff' });
    // Направление колонок и камер
    if (['speaker', 'camera', 'video_bar', 'projector'].includes(d.type) && !/потолоч/i.test(d.model)) {
      const rad = ((d.plan.rotation ?? 0) * Math.PI) / 180;
      items.push({
        kind: 'path',
        points: [
          { x: cx + Math.sin(rad) * MARK_R, y: cy + Math.cos(rad) * MARK_R },
          { x: cx + Math.sin(rad) * MARK_R * 2.6, y: cy + Math.cos(rad) * MARK_R * 2.6 },
        ],
        weight: 'thin',
        arrow: true,
      });
    }
    items.push({ kind: 'text', x: cx + MARK_R + 1, y: cy - MARK_R, text: d.tag ?? d.model, size: TEXT });
  }
  items.push({ kind: 'text', x: left, y: top + h + 8, text: planNote(scale), size: TEXT, maxWidth: Math.max(120, w) });
  return items;
}

export interface PlanPage {
  format: SheetFormat;
  items: Prim[];
  room: string;
}

/** Листы планов; формат «auto» — наименьший, где помещение помещается в масштабе не мельче 1:100 (иначе — как получится на А1). */
export function planPages({ devices, rooms }: ProjectDoc, format: SheetFormat | 'auto'): { pages: PlanPage[]; notes: string[] } {
  const pages: PlanPage[] = [];
  const notes: string[] = [];
  for (const room of rooms) {
    if (!validSize(room.size) || !devices.some((d) => d.room === room.id && d.plan)) continue;
    const size = room.size;
    const fits = (f: SheetFormat, scale: number) => {
      const { width, height } = sheetSize(f);
      const area = contentRect(width, height);
      return (
        (size.width * 1000) / scale + MARGIN.left + MARGIN.right <= area.width &&
        (size.length * 1000) / scale + MARGIN.top + MARGIN.bottom <= area.height
      );
    };
    const formats = format === 'auto' ? SHEET_FORMATS : [format];
    let chosen: { f: SheetFormat; scale: number } | null = null;
    for (const f of formats) {
      const scale = SCALES.find((s) => s <= 100 && fits(f, s));
      if (scale) {
        chosen = { f, scale };
        break;
      }
    }
    if (!chosen) {
      const f = formats[formats.length - 1];
      const scale = SCALES.find((s) => fits(f, s)) ?? SCALES[SCALES.length - 1];
      chosen = { f, scale };
      if (!fits(f, scale)) notes.push(`«План ${room.name}»: помещение не помещается на формате ${f} даже в масштабе 1:${scale}`);
    }
    const { width, height } = sheetSize(chosen.f);
    const area = contentRect(width, height);
    pages.push({ format: chosen.f, room: room.name, items: drawRoom(room, devices, chosen.scale, area.x, area.y) });
  }
  return { pages, notes };
}
