import { z } from 'zod';
import {
  CABLE_TYPES,
  DEVICE_CATEGORIES,
  PORT_DIRECTIONS,
  SIGNAL_TYPES,
  Connection,
  Device,
  ProjectDoc,
  ProjectMeta,
  Rack,
  Room,
} from '../types/device.types';
import { propMapSchema, describeZodError, PARSE_OPTIONS } from './propSchema';
import { withTemplateDefaults } from './equipment';
import { withCableLabels } from './cableLabels';
import { withDeviceTags } from './deviceTags';
import { migrateProject, SCHEMA_VERSION } from './migrations';
import { MAX_RACK_UNITS, validateRackPlaces } from './racks';
import { ROOM_SIZE_LIMITS, validatePlanPlaces } from './plan';

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
  rooms: 200,
  racks: 200,
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
  room: text(100).optional(),
  rack: z.object({ rack: text(100), u: z.number().int().min(1) }).optional(),
  plan: z.object({ x: z.number(), y: z.number(), rotation: z.number().optional() }).optional(),
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

const roomSchema = z.object({
  id: text(100),
  name: text(64).min(1, 'пустое название помещения'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'цвет помещения в формате #rrggbb'),
  size: z
    .object({
      width: z.number().min(ROOM_SIZE_LIMITS.min).max(ROOM_SIZE_LIMITS.max),
      length: z.number().min(ROOM_SIZE_LIMITS.min).max(ROOM_SIZE_LIMITS.max),
    })
    .optional(),
});

const rackSchema = z.object({
  id: text(100),
  name: text(64).min(1, 'пустое название шкафа'),
  units: z.number().int().min(1).max(MAX_RACK_UNITS, `шкаф выше ${MAX_RACK_UNITS}U`),
  room: text(100).optional(),
});

const metaField = text(200).optional();
const metaSchema = z.object({
  code: metaField,
  object: metaField,
  building: metaField,
  stage: text(10).optional(),
  organization: metaField,
  developer: metaField,
  checker: metaField,
  normControl: metaField,
  chiefEngineer: metaField,
});

const projectDocSchema = z.object({
  schemaVersion: z.number().int().min(1).optional(),
  meta: metaSchema.optional(),
  rooms: z.array(roomSchema).max(PROJECT_LIMITS.rooms, `больше ${PROJECT_LIMITS.rooms} помещений`).default([]),
  racks: z.array(rackSchema).max(PROJECT_LIMITS.racks, `больше ${PROJECT_LIMITS.racks} шкафов`).default([]),
  devices: z.array(deviceSchema).max(PROJECT_LIMITS.devices, `больше ${PROJECT_LIMITS.devices} устройств`),
  connections: z.array(connectionSchema).max(PROJECT_LIMITS.connections, `больше ${PROJECT_LIMITS.connections} соединений`),
});

export type ParsedProject =
  | {
      ok: true;
      devices: Device[];
      connections: Connection[];
      rooms: Room[];
      racks: Rack[];
      meta: ProjectMeta;
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

/** Уникальность идентификаторов: устройств, соединений, портов внутри устройства, обозначений, помещений. */
function identityError(devices: Device[], connections: Connection[], rooms: Room[], racks: Rack[]): string | null {
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
  const dupRoom = firstDuplicate(rooms.map((r) => r.id));
  if (dupRoom) return `повторяется идентификатор помещения «${dupRoom}»`;
  const dupRack = firstDuplicate(racks.map((r) => r.id));
  if (dupRack) return `повторяется идентификатор шкафа «${dupRack}»`;
  return null;
}

export function parseProjectDoc(raw: unknown): ParsedProject {
  const parsed = projectDocSchema.safeParse(raw, PARSE_OPTIONS);
  if (!parsed.success) return { ok: false, error: describeZodError(parsed.error) };
  const version = parsed.data.schemaVersion ?? 1;
  if (version > SCHEMA_VERSION) {
    return { ok: false, error: `файл создан более новой версией AV-Tracer (формат ${version}, поддерживается до ${SCHEMA_VERSION})` };
  }
  const rooms = parsed.data.rooms;
  const identity = identityError(parsed.data.devices, parsed.data.connections, rooms, parsed.data.racks);
  if (identity) return { ok: false, error: identity };

  const migrated = migrateProject(version, parsed.data.devices, parsed.data.connections);
  // Ссылка на несуществующее помещение снимается: устройство остаётся вне помещений
  const roomIds = new Set(rooms.map((r) => r.id));
  let unlinked = 0;
  const placed = migrated.devices.map((d) => {
    if (d.room === undefined || roomIds.has(d.room)) return d;
    unlinked += 1;
    const rest = { ...d };
    delete rest.room;
    return rest;
  });
  const notes = unlinked > 0 ? [...migrated.notes, `устройств со ссылкой на несуществующее помещение: ${unlinked} — помещение снято`] : migrated.notes;
  // Шкаф в несуществующем помещении — без помещения
  const racks = parsed.data.racks.map((r) => {
    if (r.room === undefined || roomIds.has(r.room)) return r;
    const rest = { ...r };
    delete rest.room;
    return rest;
  });
  // Высота в юнитах — из каталога (withTemplateDefaults), поэтому места проверяются после неё
  const racked = validateRackPlaces(placed.map(withTemplateDefaults), racks);
  if (racked.removed > 0) notes.push(`устройств с недопустимым местом в шкафу: ${racked.removed} — место снято`);
  const planned = validatePlanPlaces(racked.devices, rooms);
  if (planned.removed > 0) notes.push(`устройств на плане без помещения с размерами: ${planned.removed} — место на плане снято`);
  const devices = withDeviceTags(planned.devices);
  // Соединения, ссылающиеся на несуществующие устройства или порты, отбрасываем
  const hasPort = (deviceId: string, portId: string) =>
    devices.some((d) => d.id === deviceId && d.ports.some((p) => p.id === portId));
  const valid = migrated.connections.filter((c) => hasPort(c.from.device, c.from.port) && hasPort(c.to.device, c.to.port));
  return {
    ok: true,
    devices,
    connections: withCableLabels(devices, valid),
    rooms,
    racks,
    meta: parsed.data.meta ?? {},
    droppedConnections: migrated.connections.length - valid.length,
    notes,
  };
}

/** Документ для сохранения в файл и автосейв — всегда с версией формата. */
export function serializeProject({ devices, connections, rooms, racks, meta }: ProjectDoc) {
  return {
    schemaVersion: SCHEMA_VERSION,
    ...(meta && Object.keys(meta).length ? { meta } : {}),
    rooms,
    racks: racks ?? [],
    devices,
    connections,
  };
}
