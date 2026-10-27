import { z } from 'zod';
import {
  CABLE_TYPES,
  DEVICE_CATEGORIES,
  PORT_DIRECTIONS,
  SIGNAL_TYPES,
  Connection,
  Device,
} from '../types/device.types';
import { propMapSchema, describeZodError, PARSE_OPTIONS } from './propSchema';
import { withTemplateDefaults } from './equipment';
import { withCableLabels } from './cableLabels';
import { withDeviceTags } from './deviceTags';
import { migrateProject, SCHEMA_VERSION } from './migrations';

/**
 * Схема файла проекта. Проверяет и открытые пользователем файлы, и автосейв:
 * повреждённый, чужой или слишком большой JSON не должен ронять отрисовку холста.
 */

/** Ограничения размера проекта — защита от зависания на огромных файлах. */
export const PROJECT_LIMITS = {
  fileBytes: 5 * 1024 * 1024,
  devices: 2000,
  connections: 10000,
  portsPerDevice: 512,
};

const text = (max: number) => z.string().max(max, `строка длиннее ${max} символов`);

const portSchema = z.object({
  id: text(100),
  type: z.enum(CABLE_TYPES),
  direction: z.enum(PORT_DIRECTIONS),
  signal_type: z.enum(SIGNAL_TYPES),
  label: text(100).optional(),
});

const deviceSchema = z.object({
  id: text(200),
  tag: text(32).optional(),
  type: text(100),
  category: z.enum(DEVICE_CATEGORIES),
  manufacturer: text(200),
  model: text(200),
  full_name: text(500).default(''),
  position: z.object({ x: z.number(), y: z.number() }),
  ports: z.array(portSchema).max(PROJECT_LIMITS.portsPerDevice),
  properties: propMapSchema.default({}),
  specs: propMapSchema.optional(),
  icon_url: text(2000).optional(),
  image_url: text(2000).optional(),
});

const endpointSchema = z.object({ device: text(200), port: text(100) });

const connectionSchema = z.object({
  id: text(200),
  from: endpointSchema,
  to: endpointSchema,
  cable_type: z.enum(CABLE_TYPES),
  cable_length: z.number().nonnegative().default(10),
  label: text(32).optional(),
});

const projectDocSchema = z.object({
  schemaVersion: z.number().int().min(1).optional(),
  devices: z.array(deviceSchema).max(PROJECT_LIMITS.devices, `больше ${PROJECT_LIMITS.devices} устройств`),
  connections: z.array(connectionSchema).max(PROJECT_LIMITS.connections, `больше ${PROJECT_LIMITS.connections} соединений`),
});

export type ParsedProject =
  | {
      ok: true;
      devices: Device[];
      connections: Connection[];
      droppedConnections: number;
      /** Что изменено при обновлении старого формата. */
      notes: string[];
    }
  | { ok: false; error: string };

function firstDuplicate(values: string[]): string | undefined {
  const seen = new Set<string>();
  for (const v of values) {
    if (seen.has(v)) return v;
    seen.add(v);
  }
  return undefined;
}

/** Уникальность идентификаторов: устройств, соединений, портов внутри устройства, обозначений. */
function identityError(devices: Device[], connections: Connection[]): string | null {
  const dupDevice = firstDuplicate(devices.map((d) => d.id));
  if (dupDevice) return `повторяется идентификатор устройства «${dupDevice}»`;
  const dupConnection = firstDuplicate(connections.map((c) => c.id));
  if (dupConnection) return `повторяется идентификатор соединения «${dupConnection}»`;
  for (const d of devices) {
    const dupPort = firstDuplicate(d.ports.map((p) => p.id));
    if (dupPort) return `у устройства «${d.model}» повторяется порт «${dupPort}»`;
  }
  const dupTag = firstDuplicate(devices.flatMap((d) => (d.tag ? [d.tag] : [])));
  if (dupTag) return `повторяется обозначение устройства «${dupTag}»`;
  return null;
}

export function parseProjectDoc(raw: unknown): ParsedProject {
  const parsed = projectDocSchema.safeParse(raw, PARSE_OPTIONS);
  if (!parsed.success) return { ok: false, error: describeZodError(parsed.error) };
  const version = parsed.data.schemaVersion ?? 1;
  if (version > SCHEMA_VERSION) {
    return { ok: false, error: `файл создан более новой версией AV-Tracer (формат ${version}, поддерживается до ${SCHEMA_VERSION})` };
  }
  const identity = identityError(parsed.data.devices, parsed.data.connections);
  if (identity) return { ok: false, error: identity };

  const migrated = migrateProject(version, parsed.data.devices, parsed.data.connections);
  const devices = withDeviceTags(migrated.devices.map(withTemplateDefaults));
  // Соединения, ссылающиеся на несуществующие устройства или порты, отбрасываем
  const hasPort = (deviceId: string, portId: string) =>
    devices.some((d) => d.id === deviceId && d.ports.some((p) => p.id === portId));
  const valid = migrated.connections.filter((c) => hasPort(c.from.device, c.from.port) && hasPort(c.to.device, c.to.port));
  return {
    ok: true,
    devices,
    connections: withCableLabels(devices, valid),
    droppedConnections: migrated.connections.length - valid.length,
    notes: migrated.notes,
  };
}

/** Документ для сохранения в файл и автосейв — всегда с версией формата. */
export function serializeProject(devices: Device[], connections: Connection[]) {
  return { schemaVersion: SCHEMA_VERSION, devices, connections };
}
