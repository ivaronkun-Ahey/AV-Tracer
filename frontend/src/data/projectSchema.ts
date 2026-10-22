import { z } from 'zod';
import {
  CABLE_TYPES,
  DEVICE_CATEGORIES,
  PORT_DIRECTIONS,
  SIGNAL_TYPES,
  Connection,
  Device,
  PropValue,
} from '../types/device.types';
import { withTemplateDefaults } from './equipment';

/**
 * Схема файла проекта. Проверяет и открытые пользователем файлы, и автосейв:
 * повреждённый или чужой JSON не должен ронять отрисовку холста.
 */
const propValue: z.ZodType<PropValue> = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.union([z.string(), z.number()])),
]);

const portSchema = z.object({
  id: z.string(),
  type: z.enum(CABLE_TYPES),
  direction: z.enum(PORT_DIRECTIONS),
  signal_type: z.enum(SIGNAL_TYPES),
  label: z.string().optional(),
});

const deviceSchema = z.object({
  id: z.string(),
  type: z.string(),
  category: z.enum(DEVICE_CATEGORIES),
  manufacturer: z.string(),
  model: z.string(),
  full_name: z.string().default(''),
  position: z.object({ x: z.number(), y: z.number() }),
  ports: z.array(portSchema),
  properties: z.record(propValue).default({}),
  specs: z.record(propValue).optional(),
  icon_url: z.string().optional(),
  image_url: z.string().optional(),
});

const endpointSchema = z.object({ device: z.string(), port: z.string() });

const connectionSchema = z.object({
  id: z.string(),
  from: endpointSchema,
  to: endpointSchema,
  cable_type: z.enum(CABLE_TYPES),
  cable_length: z.number().nonnegative().default(10),
});

const projectDocSchema = z.object({
  devices: z.array(deviceSchema),
  connections: z.array(connectionSchema),
});

function describeIssue(issue: z.ZodIssue): string {
  if (issue.code === 'invalid_type') {
    return issue.received === 'undefined' ? 'нет обязательного поля' : `неверный тип: ${issue.received}`;
  }
  if (issue.code === 'invalid_enum_value') return `недопустимое значение «${String(issue.received)}»`;
  return issue.message;
}

export type ParsedProject =
  | { ok: true; devices: Device[]; connections: Connection[]; droppedConnections: number }
  | { ok: false; error: string };

export function parseProjectDoc(raw: unknown): ParsedProject {
  const parsed = projectDocSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue.path.length ? ` (${issue.path.join('.')})` : '';
    return { ok: false, error: `${describeIssue(issue)}${where}` };
  }
  const { devices, connections } = parsed.data;
  // Соединения, ссылающиеся на несуществующие устройства или порты, отбрасываем
  const hasPort = (deviceId: string, portId: string) =>
    devices.some((d) => d.id === deviceId && d.ports.some((p) => p.id === portId));
  const valid = connections.filter((c) => hasPort(c.from.device, c.from.port) && hasPort(c.to.device, c.to.port));
  return {
    ok: true,
    devices: devices.map(withTemplateDefaults),
    connections: valid,
    droppedConnections: connections.length - valid.length,
  };
}
