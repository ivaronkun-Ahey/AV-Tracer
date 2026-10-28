import { Connection, Device } from '../types/device.types';
import { findEquipment } from './equipment';

/**
 * Версия формата файла проекта. Файл без поля schemaVersion — версия 1
 * (всё, что сохранялось до появления миграций).
 */
export const SCHEMA_VERSION = 4;

export interface MigrationResult {
  devices: Device[];
  connections: Connection[];
  /** Что изменено — показывается пользователю при открытии. */
  notes: string[];
}

/**
 * 1 → 2 (по ревью 2026-10-26):
 *  - фантомное питание подаёт вход микшера, а не микрофон: убираем phantom_power
 *    у устройств, которым питание требуется (микрофоны, активные DI);
 *  - requires_poe — требование, оно в specs, а не в настраиваемых параметрах;
 *  - Yorkville YX15P была ошибочно описана как пассивная АС со Speakon. В старых
 *    проектах она стоит за усилителем, поэтому заменяем её пассивной EV EVF-1122S
 *    с тем же портом speakon_in — схема и кабели сохраняются.
 */
function v1to2(devices: Device[], notes: string[]): Device[] {
  let phantomCleaned = 0;
  let replaced = 0;
  const evf = findEquipment('ev-evf1122');
  const result = devices.map((d) => {
    let next = d;
    if ((d.type === 'microphone' || d.specs?.requires_phantom) && 'phantom_power' in d.properties) {
      const properties = { ...d.properties };
      delete properties.phantom_power;
      next = { ...next, properties };
      phantomCleaned += 1;
    }
    if ('requires_poe' in next.properties) {
      const properties = { ...next.properties };
      delete properties.requires_poe;
      next = { ...next, properties, specs: { ...next.specs, requires_poe: true } };
    }
    const legacyYx15p =
      next.manufacturer === 'Yorkville' &&
      next.model === 'YX15P' &&
      next.properties.active === false &&
      next.ports.some((p) => p.id === 'speakon_in');
    if (legacyYx15p && evf) {
      next = {
        ...next,
        manufacturer: evf.manufacturer,
        model: evf.model,
        full_name: evf.full_name,
        ports: evf.ports.map((p) => ({ ...p })),
        properties: { ...evf.default_properties },
      };
      replaced += 1;
    }
    return next;
  });
  if (phantomCleaned > 0) {
    notes.push(`фантомное питание теперь включается на микшере/интерфейсе (обновлено устройств: ${phantomCleaned})`);
  }
  if (replaced > 0) {
    notes.push(
      `Yorkville YX15P заменена на пассивную EV EVF-1122S (${replaced} шт.): в прежнем каталоге YX15P ошибочно была пассивной, на самом деле это активная АС`
    );
  }
  return result;
}

/*
 * 2 → 3: появились помещения (rooms, device.room). Поля необязательные —
 * старый проект открывается без изменений, все устройства вне помещений.
 * Версия повышена, чтобы прежние версии приложения не открывали такой файл
 * молча, теряя помещения.
 */

/*
 * 3 → 4: шкафы 19″ (racks, device.rack). Как и помещения — поля необязательные,
 * старый проект открывается без изменений.
 */

/** Приводит проект версии `from` к текущей версии формата. */
export function migrateProject(from: number, devices: Device[], connections: Connection[]): MigrationResult {
  const notes: string[] = [];
  let ds = devices;
  if (from < 2) ds = v1to2(ds, notes);
  return { devices: ds, connections, notes };
}
