import { Device, EquipmentTemplate } from '../types/device.types';
import catalogJson from './catalog.json';
import { parseCatalog, EquipmentCategory } from './catalogSchema';

export type { EquipmentCategory, EquipmentSubcategory } from './catalogSchema';

/**
 * Библиотека профессионального AV-оборудования. Данные — в catalog.json
 * (порты в короткой записи, проверка схемой — catalogSchema.ts):
 *  - sensitivity у микрофонов — чувствительность, дБВ/Па (уровень при 94 дБ SPL);
 *  - input_gain у микшеров/DSP/интерфейсов — усиление предусилителя входа, дБ;
 *  - max_resolution у коммутаторов/кодеров — максимальное поддерживаемое разрешение.
 */
export const EQUIPMENT_LIBRARY: EquipmentCategory[] = parseCatalog(catalogJson);

export const getAllEquipment = (): EquipmentTemplate[] =>
  EQUIPMENT_LIBRARY.flatMap((category) => category.subcategories.flatMap((sub) => sub.items));

export function findEquipment(equipmentId: string): EquipmentTemplate | undefined {
  return getAllEquipment().find((e) => e._id === equipmentId);
}

/** Новый экземпляр устройства на холсте из библиотечной карточки. */
export function createDevice(tpl: EquipmentTemplate, id: string, position: { x: number; y: number }): Device {
  return {
    id,
    type: tpl.type,
    category: tpl.category,
    manufacturer: tpl.manufacturer,
    model: tpl.model,
    full_name: tpl.full_name,
    position,
    ports: tpl.ports.map((p) => ({ ...p })),
    properties: { ...tpl.default_properties },
    ...(tpl.specs || tpl.routing
      ? { specs: { ...tpl.specs, ...(tpl.routing ? { routing: tpl.routing } : {}) } }
      : {}),
  };
}

/**
 * Дополняет устройство из старого проекта параметрами, появившимися в каталоге
 * позже (например, усиление входа микшера), чтобы их можно было настроить.
 */
export function withTemplateDefaults(device: Device): Device {
  const tpl = getAllEquipment().find((e) => e.manufacturer === device.manufacturer && e.model === device.model);
  if (!tpl) return device;
  const missing = Object.keys(tpl.default_properties).filter((k) => !(k in device.properties));
  if (missing.length === 0) return device;
  const properties = { ...device.properties };
  for (const k of missing) properties[k] = tpl.default_properties[k];
  return { ...device, properties };
}
