import { Connection, Device, PlanPlace, Room, RoomSize } from '../types/device.types';

/**
 * План помещения: размеры помещения в метрах, место устройства на плане —
 * координаты от левого верхнего угла помещения (м) и направление (°: 0 — вниз
 * по плану, 90 — вправо). Длина кабеля по плану — по стенам и потолку
 * (сумма проекций) с запасом на опуски и разделку.
 */

export const ROOM_SIZE_LIMITS = { min: 1, max: 500 };
/** Запас на опуски с потолка/к полу и разделку, м. */
export const CABLE_SLACK_M = 2;

export const validSize = (s: RoomSize | undefined): s is RoomSize =>
  !!s &&
  Number.isFinite(s.width) &&
  Number.isFinite(s.length) &&
  s.width >= ROOM_SIZE_LIMITS.min &&
  s.length >= ROOM_SIZE_LIMITS.min &&
  s.width <= ROOM_SIZE_LIMITS.max &&
  s.length <= ROOM_SIZE_LIMITS.max;

const round2 = (v: number) => Math.round(v * 100) / 100;

/** Место в пределах помещения (с точностью до сантиметра). */
export function clampPlace(p: PlanPlace, size: RoomSize): PlanPlace {
  const clamp = (v: number, max: number) => round2(Math.min(max, Math.max(0, Number.isFinite(v) ? v : 0)));
  const rotation = ((Math.round(p.rotation ?? 0) % 360) + 360) % 360;
  return { x: clamp(p.x, size.width), y: clamp(p.y, size.length), ...(rotation ? { rotation } : {}) };
}

/** Свободное место для нового устройства: центр помещения или ближайший узел сетки 1 м не ближе 1 м к другим. */
export function freeSpot(size: RoomSize, taken: PlanPlace[]): PlanPlace {
  const cx = size.width / 2;
  const cy = size.length / 2;
  const free = (x: number, y: number) => taken.every((p) => Math.hypot(p.x - x, p.y - y) >= 1);
  const limit = Math.ceil(Math.max(size.width, size.length));
  for (let ring = 0; ring <= limit; ring++) {
    for (let dx = -ring; dx <= ring; dx++) {
      for (let dy = -ring; dy <= ring; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && x <= size.width && y >= 0 && y <= size.length && free(x, y)) return clampPlace({ x, y }, size);
      }
    }
  }
  return clampPlace({ x: cx, y: cy }, size);
}

/** Длина кабеля между двумя местами на плане одного помещения, м (целые метры, в большую сторону). */
export function planCableLength(a: PlanPlace, b: PlanPlace): number {
  return Math.ceil(Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + CABLE_SLACK_M);
}

/**
 * Длины кабелей по плану: только для кабелей, оба конца которых стоят на плане
 * одного и того же помещения (между помещениями расстояние неизвестно).
 */
export function cableLengthsFromPlan(devices: Device[], connections: Connection[]): Record<string, number> {
  const byId = new Map(devices.map((d) => [d.id, d]));
  const result: Record<string, number> = {};
  for (const c of connections) {
    const a = byId.get(c.from.device);
    const b = byId.get(c.to.device);
    if (!a?.plan || !b?.plan || !a.room || a.room !== b.room) continue;
    result[c.id] = planCableLength(a.plan, b.plan);
  }
  return result;
}

/** Места из файла проекта: без помещения или без размеров помещения место снимается, иначе — в пределах помещения. */
export function validatePlanPlaces(devices: Device[], rooms: Room[]): { devices: Device[]; removed: number } {
  const sizes = new Map(rooms.filter((r) => validSize(r.size)).map((r) => [r.id, r.size!]));
  let removed = 0;
  const result = devices.map((d) => {
    if (!d.plan) return d;
    const size = d.room ? sizes.get(d.room) : undefined;
    if (size) return { ...d, plan: clampPlace(d.plan, size) };
    removed += 1;
    const rest = { ...d };
    delete rest.plan;
    return rest;
  });
  return { devices: result, removed };
}
