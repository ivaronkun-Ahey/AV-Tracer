import { z } from 'zod';
import {
  CABLE_TYPES,
  DEVICE_CATEGORIES,
  PORT_DIRECTIONS,
  ROUTING_MODES,
  SIGNAL_TYPES,
  CableType,
  DeviceCategory,
  EquipmentTemplate,
  Port,
  PortDirection,
  SignalType,
} from '../types/device.types';
import { propMapSchema, describeZodError, PARSE_OPTIONS } from './propSchema';

/**
 * Загрузка библиотеки оборудования из catalog.json. В файле порт задаётся
 * идентификатором, а разъём, направление и сигнал определяются по префиксу.
 * Запись «xlr_in*16» — 16 портов xlr_in_1…xlr_in_16, «hdmi_in*2@5» — hdmi_in_5, hdmi_in_6.
 * Нестандартный порт описывается объектом { id, type, direction, signal_type }.
 */

const PORT_RULES: Array<[RegExp, CableType, PortDirection, SignalType]> = [
  [/^xlr_in/, 'xlr', 'input', 'analog_audio'],
  [/^xlr_(out|thru)/, 'xlr', 'output', 'analog_audio'],
  [/^trs_in/, 'trs', 'input', 'analog_audio'],
  [/^trs_out/, 'trs', 'output', 'analog_audio'],
  [/^rca_in/, 'rca', 'input', 'analog_audio'],
  [/^rca_out/, 'rca', 'output', 'analog_audio'],
  [/^speakon_in/, 'speakon', 'input', 'analog_audio'],
  [/^speakon_out/, 'speakon', 'output', 'analog_audio'],
  [/^hdmi_in/, 'hdmi', 'input', 'hdmi'],
  [/^hdmi_out/, 'hdmi', 'output', 'hdmi'],
  [/^sdi_in/, 'bnc', 'input', 'sdi'],
  [/^sdi_out/, 'bnc', 'output', 'sdi'],
  [/^hdbt_in/, 'cat6', 'input', 'hdbaset'],
  [/^hdbt_out/, 'cat6', 'output', 'hdbaset'],
  [/^dante_in/, 'cat6', 'input', 'digital_audio'],
  [/^dante_out/, 'cat6', 'output', 'digital_audio'],
  [/^network_in/, 'cat6', 'input', 'network'],
  [/^(network|ip)_out/, 'cat6', 'output', 'network'],
  [/^eth/, 'cat6', 'bidirectional', 'network'],
  [/^usb_in/, 'usb', 'input', 'usb'],
  [/^usb_out/, 'usb', 'output', 'usb'],
];

export function portFromId(id: string): Port {
  const rule = PORT_RULES.find(([re]) => re.test(id));
  if (!rule) throw new Error(`не удаётся определить тип порта по идентификатору «${id}»`);
  return { id, type: rule[1], direction: rule[2], signal_type: rule[3] };
}

/** Разворачивает короткую запись порта в список портов. */
export function expandPortSpec(spec: string | Port): Port[] {
  if (typeof spec !== 'string') return [spec];
  const m = /^([a-z0-9_]+)\*(\d+)(?:@(\d+))?$/.exec(spec);
  if (!m) return [portFromId(spec)];
  const [, prefix, count, start = '1'] = m;
  return Array.from({ length: Number(count) }, (_, i) => portFromId(`${prefix}_${Number(start) + i}`));
}

const portObjectSchema = z.object({
  id: z.string(),
  type: z.enum(CABLE_TYPES),
  direction: z.enum(PORT_DIRECTIONS),
  signal_type: z.enum(SIGNAL_TYPES),
  label: z.string().optional(),
});

const templateSchema = z.object({
  _id: z.string().regex(/^[a-z0-9-]+$/, 'идентификатор: строчные латинские буквы, цифры и дефис'),
  type: z.string(),
  category: z.enum(DEVICE_CATEGORIES).optional(),
  manufacturer: z.string().min(1),
  model: z.string().min(1),
  full_name: z.string().min(1),
  ports: z.array(z.union([z.string(), portObjectSchema])).min(1),
  default_properties: propMapSchema.default({}),
  specs: propMapSchema.optional(),
  routing: z.enum(ROUTING_MODES).optional(),
  source: z
    .object({
      url: z.string().url(),
      verified: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'дата сверки в формате ГГГГ-ММ-ДД'),
      notes: z.string().optional(),
    })
    .optional(),
});

const catalogSchema = z.object({
  $comment: z.string().optional(),
  categories: z.array(
    z.object({
      category: z.enum(DEVICE_CATEGORIES),
      name: z.string(),
      icon: z.string(),
      subcategories: z.array(z.object({ name: z.string(), items: z.array(templateSchema) })),
    })
  ),
});

export interface EquipmentSubcategory {
  name: string;
  items: EquipmentTemplate[];
}

export interface EquipmentCategory {
  category: DeviceCategory;
  name: string;
  icon: string;
  subcategories: EquipmentSubcategory[];
}

/** Проверяет каталог и разворачивает порты; при ошибке — исключение с путём до поля. */
export function parseCatalog(raw: unknown): EquipmentCategory[] {
  const parsed = catalogSchema.safeParse(raw, PARSE_OPTIONS);
  if (!parsed.success) throw new Error(`Ошибка в каталоге оборудования: ${describeZodError(parsed.error)}`);
  const seen = new Set<string>();
  return parsed.data.categories.map((cat) => ({
    category: cat.category,
    name: cat.name,
    icon: cat.icon,
    subcategories: cat.subcategories.map((sub) => ({
      name: sub.name,
      items: sub.items.map((item) => {
        if (seen.has(item._id)) throw new Error(`Ошибка в каталоге оборудования: повторяется _id «${item._id}»`);
        seen.add(item._id);
        let ports: Port[];
        try {
          ports = item.ports.flatMap(expandPortSpec);
        } catch (e) {
          throw new Error(`Ошибка в каталоге оборудования (${item._id}): ${(e as Error).message}`);
        }
        const ids = ports.map((p) => p.id);
        const dup = ids.find((id, i) => ids.indexOf(id) !== i);
        if (dup) throw new Error(`Ошибка в каталоге оборудования (${item._id}): повторяется порт «${dup}»`);
        const template: EquipmentTemplate = {
          _id: item._id,
          type: item.type,
          category: item.category ?? cat.category,
          manufacturer: item.manufacturer,
          model: item.model,
          full_name: item.full_name,
          ports,
          default_properties: item.default_properties,
          ...(item.specs ? { specs: item.specs } : {}),
          ...(item.routing ? { routing: item.routing } : {}),
          ...(item.source ? { source: item.source } : {}),
        };
        return template;
      }),
    })),
  }));
}
