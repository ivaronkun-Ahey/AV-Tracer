import { z } from 'zod';
import {
  CABLE_TYPES,
  DEVICE_CATEGORIES,
  PORT_DIRECTIONS,
  SIGNAL_TYPES,
  Connection,
  Device,
} from '../types/device.types';
import { propMapSchema, describeZodError } from './propSchema';
import { withTemplateDefaults } from './equipment';
import { withCableLabels } from './cableLabels';

/**
 * Схема файла проекта. Проверяет и открытые пользователем файлы, и автосейв:
 * повреждённый или чужой JSON не должен ронять отрисовку холста.
 */
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
  properties: propMapSchema.default({}),
  specs: propMapSchema.optional(),
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
  label: z.string().optional(),
});

const projectDocSchema = z.object({
  devices: z.array(deviceSchema),
  connections: z.array(connectionSchema),
});

export type ParsedProject =
  | { ok: true; devices: Device[]; connections: Connection[]; droppedConnections: number }
  | { ok: false; error: string };

export function parseProjectDoc(raw: unknown): ParsedProject {
  const parsed = projectDocSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: describeZodError(parsed.error) };
  const { devices, connections } = parsed.data;
  // Соединения, ссылающиеся на несуществующие устройства или порты, отбрасываем
  const hasPort = (deviceId: string, portId: string) =>
    devices.some((d) => d.id === deviceId && d.ports.some((p) => p.id === portId));
  const valid = connections.filter((c) => hasPort(c.from.device, c.from.port) && hasPort(c.to.device, c.to.port));
  return {
    ok: true,
    devices: devices.map(withTemplateDefaults),
    connections: withCableLabels(devices, valid),
    droppedConnections: connections.length - valid.length,
  };
}
