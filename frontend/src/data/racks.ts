import { Device, Rack, RackPlace } from '../types/device.types';

/**
 * Шкафы 19″: высота устройства в юнитах берётся из каталога (specs.rack_units),
 * место устройства — нижний занятый юнит. Проверки места общие для редактора
 * и для открытия файла проекта.
 */

export const DEFAULT_RACK_UNITS = 42;
export const MAX_RACK_UNITS = 60;

/** Высота устройства в юнитах; undefined — устройство не ставится в шкаф 19″. */
export function rackUnits(device: Pick<Device, 'specs'>): number | undefined {
  const u = device.specs?.rack_units;
  return typeof u === 'number' && Number.isInteger(u) && u > 0 && u <= MAX_RACK_UNITS ? u : undefined;
}

/** Юниты, занятые устройством: [нижний, верхний]. */
export const span = (place: RackPlace, height: number): [number, number] => [place.u, place.u + height - 1];

/** Почему устройство нельзя поставить на это место (null — можно). */
export function placeProblem(devices: Device[], rack: Rack, device: Device, u: number): string | null {
  const height = rackUnits(device);
  if (!height) return `«${device.model}» не монтируется в шкаф 19″`;
  if (!Number.isInteger(u) || u < 1 || u + height - 1 > rack.units) {
    return `«${device.model}» (${height}U) не помещается: в шкафу «${rack.name}» юниты 1–${rack.units}`;
  }
  const [lo, hi] = span({ rack: rack.id, u }, height);
  for (const other of devices) {
    if (other.id === device.id || other.rack?.rack !== rack.id) continue;
    const [olo, ohi] = span(other.rack, rackUnits(other) ?? 1);
    if (lo <= ohi && olo <= hi) return `юниты ${lo}–${hi} заняты: там ${other.tag ?? other.model}`;
  }
  return null;
}

/** Самое верхнее свободное место под устройство (null — места нет). */
export function freePlace(devices: Device[], rack: Rack, device: Device): number | null {
  const height = rackUnits(device);
  if (!height) return null;
  for (let u = rack.units - height + 1; u >= 1; u--) {
    if (!placeProblem(devices, rack, device, u)) return u;
  }
  return null;
}

/** Шкафы для спецификации: одинаковой высоты — одной строкой. */
export function rackBom(racks: Rack[]): Array<{ units: number; qty: number; names: string[] }> {
  const groups = new Map<number, { units: number; qty: number; names: string[] }>();
  for (const r of racks) {
    const g = groups.get(r.units) ?? { units: r.units, qty: 0, names: [] };
    g.qty += 1;
    g.names.push(r.name);
    groups.set(r.units, g);
  }
  return [...groups.values()].sort((a, b) => b.units - a.units);
}

export const rackTitle = (units: number) => `Шкаф телекоммуникационный 19″, ${units}U`;

/** Занято юнитов в шкафу. */
export const usedUnits = (devices: Device[], rack: Rack) =>
  devices.reduce((sum, d) => sum + (d.rack?.rack === rack.id ? (rackUnits(d) ?? 0) : 0), 0);

/**
 * Места из файла проекта: ссылка на несуществующий шкаф, выход за высоту шкафа
 * или наложение на другое устройство — место снимается (устройство остаётся на схеме).
 */
export function validateRackPlaces(devices: Device[], racks: Rack[]): { devices: Device[]; removed: number } {
  const byId = new Map(racks.map((r) => [r.id, r]));
  const placed: Device[] = [];
  let removed = 0;
  const result = devices.map((d) => {
    if (!d.rack) return d;
    const rack = byId.get(d.rack.rack);
    if (rack && !placeProblem(placed, rack, d, d.rack.u)) {
      placed.push(d);
      return d;
    }
    removed += 1;
    const rest = { ...d };
    delete rest.rack;
    return rest;
  });
  return { devices: result, removed };
}
