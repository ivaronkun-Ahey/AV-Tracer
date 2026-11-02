import type { ElkNode } from 'elkjs/lib/elk-api';
import { Device, ProjectDoc } from '../types/device.types';
import { arrangeRooms } from '../features/autoLayout';
import { GRID } from '../components/deviceGeometry';
import { BLOCK, BlockLink, SchemeContent } from './schemes';
import { Prim, SHEET_FORMATS, SheetFormat, contentRect, primsBounds, sheetSize, transformPrims } from './sheet';

type Positions = Record<string, { x: number; y: number }>;

/** Наименьшая высота текста на листе, мм (ГОСТ 2.304: 2,5 мм и больше). */
export const MIN_SHEET_TEXT = 2.5;
/** Крупнее не увеличиваем: маленькая схема не растягивается на весь лист. */
const MAX_SCALE = 0.45;

/**
 * Раскладка блоков структурной/функциональной схемы: ход сигнала слева
 * направо (ELK layered), помещения — горизонтальными полосами, как на холсте.
 */
export async function layoutBlocks({ devices }: ProjectDoc, links: BlockLink[]): Promise<Positions> {
  if (devices.length === 0) return {};
  const { default: ELK } = await import('elkjs/lib/elk.bundled.js');
  const elk = new ELK();
  const ids = new Set(devices.map((d) => d.id));
  const graph: ElkNode = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.layered.spacing.nodeNodeBetweenLayers': '110',
      'elk.spacing.nodeNode': '36',
      'elk.spacing.componentComponent': '60',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      'elk.separateConnectedComponents': 'true',
    },
    children: devices.map((d) => ({ id: d.id, width: BLOCK.width, height: BLOCK.height })),
    edges: links
      .filter((l) => ids.has(l.from) && ids.has(l.to))
      .map((l, i) => ({ id: `e${i}`, sources: [l.from], targets: [l.to] })),
  };
  const result = await elk.layout(graph);
  const flat: Positions = {};
  for (const child of result.children ?? []) {
    flat[child.id] = { x: Math.round((child.x ?? 0) / GRID) * GRID, y: Math.round((child.y ?? 0) / GRID) * GRID };
  }
  return arrangeRooms(devices as Device[], flat, () => BLOCK);
}

export interface Placed {
  items: Prim[];
  format: SheetFormat;
  /** Высота самого мелкого текста на листе, мм. */
  minTextMm: number;
}

/**
 * Перенос схемы на лист: масштаб — чтобы схема поместилась в поле над
 * основной надписью. Формат «auto» — наименьший, на котором самый мелкий текст
 * не меньше 2,5 мм (если не помещается и на A1 — A1 с более мелким текстом).
 */
export function placeOnSheet(content: SchemeContent, format: SheetFormat | 'auto'): Placed {
  const bounds = primsBounds(content.prims) ?? { x: 0, y: 0, width: 1, height: 1 };
  const fit = (f: SheetFormat) => {
    const { width, height } = sheetSize(f);
    const area = contentRect(width, height);
    const scale = Math.min(MAX_SCALE, area.width / bounds.width, area.height / bounds.height);
    return { f, area, scale };
  };
  const candidates = format === 'auto' ? SHEET_FORMATS : [format];
  const chosen =
    candidates.map(fit).find((c) => c.scale * content.minText >= MIN_SHEET_TEXT) ?? fit(candidates[candidates.length - 1]);
  const { area, scale } = chosen;
  // По центру поля изображения
  const dx = area.x + (area.width - bounds.width * scale) / 2 - bounds.x * scale;
  const dy = area.y + (area.height - bounds.height * scale) / 2 - bounds.y * scale;
  return { items: transformPrims(content.prims, scale, dx, dy), format: chosen.f, minTextMm: content.minText * scale };
}
