import { Device, EquipmentTemplate, PropMap } from '../types/device.types';
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

export interface Provenance {
  /** verified — сверено с документацией производителя; indicative — не сверено; generic — типовое учебное. */
  kind: 'verified' | 'indicative' | 'generic';
  label: string;
  /** Коротко — для таблиц спецификации. */
  short: string;
  url?: string;
}

/** Насколько можно доверять характеристикам устройства (по карточке каталога с тем же производителем и моделью). */
export function provenance(d: { manufacturer: string; model: string }): Provenance {
  if (d.manufacturer === 'Типовое') {
    return { kind: 'generic', label: 'Типовое учебное устройство: типичные характеристики, а не конкретная модель', short: 'типовое' };
  }
  const source = getAllEquipment().find((e) => e.manufacturer === d.manufacturer && e.model === d.model)?.source;
  if (source) {
    const date = source.verified.split('-').reverse().join('.');
    return { kind: 'verified', label: `Сверено с документацией производителя ${date}`, short: `сверено ${date}`, url: source.url };
  }
  return { kind: 'indicative', label: 'Характеристики ориентировочные: с документацией производителя не сверены', short: 'не сверено' };
}

/** Уникальный идентификатор нового устройства на схеме. */
export function newDeviceId(): string {
  return `device_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
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
  const tplSpecs: PropMap = { ...tpl.specs, ...(tpl.routing ? { routing: tpl.routing } : {}) };
  const missingProps = Object.keys(tpl.default_properties).filter((k) => !(k in device.properties));
  const missingSpecs = Object.keys(tplSpecs).filter((k) => !(k in (device.specs ?? {})));
  if (missingProps.length === 0 && missingSpecs.length === 0) return device;
  const properties = { ...device.properties };
  for (const k of missingProps) properties[k] = tpl.default_properties[k];
  // Правила коммутации и требования (фантом, PoE) берутся из каталога, если их нет в старом файле
  const specs = { ...device.specs };
  for (const k of missingSpecs) specs[k] = tplSpecs[k];
  return { ...device, properties, ...(Object.keys(specs).length ? { specs } : {}) };
}
