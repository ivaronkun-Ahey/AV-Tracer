import { Device, ProjectDoc, Rack } from '../types/device.types';
import { rackUnits } from '../data/racks';
import { Prim, SHEET_FORMATS, SheetFormat, contentRect, line, rectPath, sheetSize } from './sheet';

/**
 * Схема расположения оборудования в шкафах 19″: фасады шкафов в масштабе 1:10
 * с нумерацией юнитов, оборудование — с позиционными обозначениями. Шкафы стоят
 * на листе слева направо; не поместившиеся переносятся на следующий лист.
 */

const SCALE = 10;
/** Высота юнита 44,45 мм и ширина 19″ панели 482,6 мм — в масштабе листа. */
const U_MM = 44.45 / SCALE;
const PANEL_W = 482.6 / SCALE;
/** Стойки шкафа (условно). */
const POST = 3;
const RACK_W = PANEL_W + POST * 2;
/** Место слева под номера юнитов и промежуток между шкафами. */
const GAP = 16;
const HEAD = 14;
const NOTE = 8;
const TEXT = 2.5;

export const RACK_SHEET_NOTE = `М 1:${SCALE}. Высота оборудования в юнитах — по каталогу AV-Tracer (ориентировочно).`;

const rackHeight = (r: Rack) => r.units * U_MM + POST * 2;

function drawRack(rack: Rack, devices: Device[], roomName: string | undefined, x: number, y: number): Prim[] {
  const items: Prim[] = [
    { kind: 'text', x: x + RACK_W / 2, y: y + 4, text: rack.name, size: 3.5, bold: true, align: 'center', maxWidth: RACK_W + GAP - 4 },
    {
      kind: 'text',
      x: x + RACK_W / 2,
      y: y + 9.5,
      text: [`${rack.units}U`, roomName].filter(Boolean).join(' · '),
      size: TEXT,
      align: 'center',
      maxWidth: RACK_W + GAP - 4,
    },
  ];
  const top = y + HEAD;
  const inner = { x: x + POST, y: top + POST, width: PANEL_W, height: rack.units * U_MM };
  items.push(rectPath({ x, y: top, width: RACK_W, height: rackHeight(rack) }, 'thick'), rectPath(inner, 'thin'));

  const mine = devices.filter((d) => d.rack?.rack === rack.id);
  const occupied = new Set<number>();
  for (const d of mine) for (let u = d.rack!.u; u < d.rack!.u + (rackUnits(d) ?? 1); u++) occupied.add(u);
  /** Верх юнита u на листе. */
  const unitTop = (u: number) => inner.y + (rack.units - u) * U_MM;

  for (let u = 1; u <= rack.units; u++) {
    items.push({ kind: 'text', x: x - 1.5, y: unitTop(u) + (U_MM + TEXT) / 2, text: String(u), size: TEXT, align: 'right' });
    // Деления юнитов — только на свободных местах
    if (u < rack.units && !(occupied.has(u) && occupied.has(u + 1))) {
      items.push(
        line(inner.x, unitTop(u), inner.x + 2, unitTop(u)),
        line(inner.x + PANEL_W - 2, unitTop(u), inner.x + PANEL_W, unitTop(u))
      );
    }
  }

  for (const d of mine) {
    const h = rackUnits(d) ?? 1;
    const r = { x: inner.x, y: unitTop(d.rack!.u + h - 1), width: PANEL_W, height: h * U_MM };
    items.push(rectPath(r, 'thick'));
    const maker = d.manufacturer === 'Типовое' ? '' : `${d.manufacturer} `;
    const textX = r.x + 1.5;
    const maxWidth = PANEL_W - 3;
    if (h >= 2) {
      items.push(
        { kind: 'text', x: textX, y: r.y + r.height / 2 - 0.6, text: d.tag ?? '', size: TEXT, bold: true, maxWidth },
        { kind: 'text', x: textX, y: r.y + r.height / 2 + TEXT + 0.6, text: `${maker}${d.model}`, size: TEXT, maxWidth }
      );
    } else {
      items.push({
        kind: 'text',
        x: textX,
        y: r.y + (r.height + TEXT) / 2,
        text: `${d.tag ?? ''} ${maker}${d.model}`.trim(),
        size: TEXT,
        maxWidth,
      });
    }
  }
  return items;
}

export interface RackPage {
  format: SheetFormat;
  items: Prim[];
}

/** Листы со шкафами; формат «auto» — наименьший, на котором помещаются все шкафы (или самый высокий из них). */
export function rackPages(
  { devices, rooms, racks = [] }: ProjectDoc,
  format: SheetFormat | 'auto'
): { pages: RackPage[]; notes: string[] } {
  if (racks.length === 0) return { pages: [], notes: [] };
  const colW = RACK_W + GAP;
  const tallest = Math.max(...racks.map(rackHeight)) + HEAD + NOTE;
  const fit = (f: SheetFormat) => {
    const { width, height } = sheetSize(f);
    const area = contentRect(width, height);
    return { f, area, perSheet: Math.max(1, Math.floor(area.width / colW)), tall: tallest <= area.height };
  };
  const options = (format === 'auto' ? SHEET_FORMATS : [format]).map(fit);
  const chosen = options.find((o) => o.tall && o.perSheet >= racks.length) ?? options.find((o) => o.tall) ?? options[options.length - 1];
  const notes = chosen.tall
    ? []
    : [`«Схема расположения оборудования»: самый высокий шкаф не помещается на формате ${chosen.f} в масштабе 1:${SCALE}`];

  const pages: RackPage[] = [];
  for (let i = 0; i < racks.length; i += chosen.perSheet) {
    const chunk = racks.slice(i, i + chosen.perSheet);
    const { area } = chosen;
    const items: Prim[] = [];
    chunk.forEach((rack, j) => {
      const room = rooms.find((r) => r.id === rack.room)?.name;
      items.push(...drawRack(rack, devices, room, area.x + GAP + j * colW, area.y));
    });
    const bottom = area.y + HEAD + Math.max(...chunk.map(rackHeight));
    items.push({ kind: 'text', x: area.x + GAP, y: bottom + 6, text: RACK_SHEET_NOTE, size: TEXT, maxWidth: area.width - GAP });
    pages.push({ format: chosen.f, items });
  }
  return { pages, notes };
}
