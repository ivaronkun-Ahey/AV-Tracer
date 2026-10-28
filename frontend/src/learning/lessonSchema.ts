import { z } from 'zod';
import { Connection, Device, ProjectDoc, PropMap } from '../types/device.types';
import { createDevice, findEquipment } from '../data/equipment';
import { propMapSchema, describeZodError, PARSE_OPTIONS } from '../data/propSchema';
import { withCableLabels } from '../data/cableLabels';
import { withDeviceTags } from '../data/deviceTags';

/**
 * Учебные задания (src/data/lessons.json). Стартовая схема и эталонное решение
 * описываются коротко — через карточки каталога и «устройство.порт»; критерии
 * проверки считаются той же симуляцией, что и в редакторе (checks.ts).
 */

const selectorSchema = z
  .object({ type: z.string().optional(), model: z.string().optional() })
  .refine((s) => s.type || s.model, 'селектор: нужен type или model');

const checkSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('reaches'),
    text: z.string().min(1),
    domain: z.enum(['audio', 'video']),
    from: selectorSchema,
    to: selectorSchema,
    /** Каждое подходящее устройство-приёмник должно получать сигнал. */
    all: z.boolean().optional(),
    /** Суммарная длина кабелей по пути, не меньше, м — расстояние в задании. */
    minLength: z.number().positive().optional(),
  }),
  z.object({ type: z.literal('no_errors'), text: z.string().min(1) }),
  z.object({ type: z.literal('no_issue'), text: z.string().min(1), issues: z.array(z.string()).min(1) }),
  z.object({
    type: z.literal('uses'),
    text: z.string().min(1),
    select: selectorSchema,
    min: z.number().int().nonnegative().optional(),
    max: z.number().int().nonnegative().optional(),
  }),
]);

const deviceSpecSchema = z.object({
  id: z.string().min(1),
  eq: z.string().min(1),
  x: z.number(),
  y: z.number(),
  props: propMapSchema.optional(),
  room: z.string().optional(),
});

const connectionSpecSchema = z.object({
  /** «устройство.порт» */
  from: z.string().regex(/^[^.]+\..+$/),
  to: z.string().regex(/^[^.]+\..+$/),
  length: z.number().nonnegative().optional(),
});

const docSpecSchema = z.object({
  rooms: z.array(z.object({ id: z.string(), name: z.string(), color: z.string() })).default([]),
  devices: z.array(deviceSpecSchema).default([]),
  connections: z.array(connectionSpecSchema).default([]),
});

const lessonSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1),
  kind: z.enum(['build', 'troubleshoot']),
  level: z.number().int().min(1).max(3),
  goal: z.string().min(1),
  theory: z.string().min(1),
  hints: z.array(z.string()).min(1),
  /** В заданиях «найди неисправность» кнопка «Исправить» скрыта. */
  allowFixes: z.boolean().default(true),
  /** Оборудование задания (карточки каталога); без списка — вся библиотека. */
  palette: z.array(z.string()).optional(),
  start: docSpecSchema,
  solution: docSpecSchema,
  checks: z.array(checkSchema).min(1),
});

const lessonsFileSchema = z.object({ $comment: z.string().optional(), lessons: z.array(lessonSchema).min(1) });

export type Selector = z.infer<typeof selectorSchema>;
export type LessonCheck = z.infer<typeof checkSchema>;
export type DocSpec = z.infer<typeof docSpecSchema>;
export type Lesson = z.infer<typeof lessonSchema>;

export function parseLessons(raw: unknown): Lesson[] {
  const parsed = lessonsFileSchema.safeParse(raw, PARSE_OPTIONS);
  if (!parsed.success) throw new Error(`Ошибка в заданиях: ${describeZodError(parsed.error)}`);
  const ids = new Set<string>();
  for (const l of parsed.data.lessons) {
    if (ids.has(l.id)) throw new Error(`Ошибка в заданиях: повторяется id «${l.id}»`);
    ids.add(l.id);
    for (const eq of l.palette ?? []) {
      if (!findEquipment(eq)) throw new Error(`Ошибка в задании «${l.id}»: нет в каталоге «${eq}»`);
    }
  }
  return parsed.data.lessons;
}

/** Схема из короткой записи: устройства из каталога, кабели «устройство.порт». */
export function buildDoc(spec: DocSpec, lessonId = ''): ProjectDoc {
  const devices: Device[] = spec.devices.map((d) => {
    const tpl = findEquipment(d.eq);
    if (!tpl) throw new Error(`задание «${lessonId}»: нет в каталоге «${d.eq}»`);
    const device = createDevice(tpl, d.id, { x: d.x, y: d.y });
    if (d.props) device.properties = { ...device.properties, ...(d.props as PropMap) };
    if (d.room) device.room = d.room;
    return device;
  });
  const end = (ref: string) => {
    const dot = ref.indexOf('.');
    const device = ref.slice(0, dot);
    const port = ref.slice(dot + 1);
    const p = devices.find((d) => d.id === device)?.ports.find((x) => x.id === port);
    if (!p) throw new Error(`задание «${lessonId}»: нет порта «${ref}»`);
    return { device, port, type: p.type };
  };
  const connections: Connection[] = spec.connections.map((c, i) => {
    const from = end(c.from);
    const to = end(c.to);
    return {
      id: `lesson_${lessonId}_${i + 1}`,
      from: { device: from.device, port: from.port },
      to: { device: to.device, port: to.port },
      cable_type: to.type,
      cable_length: c.length ?? 10,
    };
  });
  const tagged = withDeviceTags(devices);
  return { devices: tagged, connections: withCableLabels(tagged, connections), rooms: spec.rooms };
}
