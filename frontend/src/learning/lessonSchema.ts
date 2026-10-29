import { z } from 'zod';
import { Connection, Device, ProjectDoc, PropMap } from '../types/device.types';
import { createDevice, findEquipment } from '../data/equipment';
import { propMapSchema, describeZodError, identifierSchema, PARSE_OPTIONS } from '../data/propSchema';
import { PROJECT_LIMITS, identityError } from '../data/projectSchema';
import { withCableLabels } from '../data/cableLabels';
import { withDeviceTags } from '../data/deviceTags';
import { evaluateLesson } from './checks';

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
    /**
     * Через какие устройства сигнал проходит по пути к приёмнику, по порядку.
     * Устройство, которое стоит на схеме, но не участвует в тракте, условие не выполняет.
     */
    via: z.array(selectorSchema).min(1).optional(),
  }),
  z.object({ type: z.literal('no_errors'), text: z.string().min(1) }),
  z.object({ type: z.literal('no_issue'), text: z.string().min(1), issues: z.array(z.string()).min(1) }),
  /** Состав оборудования на схеме — без учёта того, проходит ли через него сигнал (для этого — reaches.via). */
  z.object({
    type: z.literal('uses'),
    text: z.string().min(1),
    select: selectorSchema,
    min: z.number().int().nonnegative().optional(),
    max: z.number().int().nonnegative().optional(),
  }),
]);

const deviceSpecSchema = z.object({
  /** Без точки: кабель записывается как «устройство.порт». */
  id: identifierSchema(200).refine((v) => !v.includes('.'), 'в id устройства не должно быть точки'),
  eq: z.string().min(1),
  x: z.number(),
  y: z.number(),
  props: propMapSchema.optional(),
  room: identifierSchema(100).optional(),
});

const connectionSpecSchema = z.object({
  /** «устройство.порт» */
  from: z.string().regex(/^[^.]+\..+$/),
  to: z.string().regex(/^[^.]+\..+$/),
  length: z.number().nonnegative().optional(),
});

const docSpecSchema = z.object({
  rooms: z
    .array(z.object({ id: identifierSchema(100), name: z.string().min(1).max(64), color: z.string().regex(/^#[0-9a-fA-F]{6}$/) }))
    .max(PROJECT_LIMITS.rooms, `больше ${PROJECT_LIMITS.rooms} помещений`)
    .default([]),
  devices: z.array(deviceSpecSchema).max(PROJECT_LIMITS.devices, `больше ${PROJECT_LIMITS.devices} устройств`).default([]),
  connections: z
    .array(connectionSpecSchema)
    .max(PROJECT_LIMITS.connections, `больше ${PROJECT_LIMITS.connections} соединений`)
    .default([]),
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

const DOCS = [
  ['start', 'стартовая схема'],
  ['solution', 'эталонное решение'],
] as const;

/**
 * Полная проверка задания — одна для встроенных, загруженных из файла, сохранённых
 * в браузере и созданных в редакторе: оборудование есть в каталоге, обе схемы
 * собираются (устройства, порты, помещения, уникальные id, пределы размера),
 * эталонное решение проходит все проверки, а стартовая схема — нет.
 */
function validateLesson(l: Lesson) {
  const fail = (what: string): never => {
    throw new Error(`Ошибка в задании «${l.title}»: ${what}`);
  };
  for (const eq of [...(l.palette ?? []), ...l.start.devices.map((d) => d.eq), ...l.solution.devices.map((d) => d.eq)]) {
    if (!findEquipment(eq)) fail(`нет в каталоге «${eq}»`);
  }
  const docs = {} as Record<'start' | 'solution', ProjectDoc>;
  for (const [key, name] of DOCS) {
    const spec = l[key];
    const rooms = new Set(spec.rooms.map((r) => r.id));
    const unplaced = spec.devices.find((d) => d.room !== undefined && !rooms.has(d.room));
    if (unplaced) fail(`${name}: у устройства «${unplaced.id}» нет помещения «${unplaced.room}»`);
    try {
      docs[key] = buildDoc(spec);
    } catch (e) {
      fail(`${name}: ${(e as Error).message}`);
    }
    const identity = identityError(docs[key].devices, docs[key].connections, docs[key].rooms, []);
    if (identity) fail(`${name}: ${identity}`);
    if (l.palette) {
      const outside = spec.devices.find((d) => !l.palette!.includes(d.eq));
      if (outside) fail(`${name}: «${outside.eq}» нет в библиотеке задания (palette)`);
    }
  }
  const failed = evaluateLesson(l, docs.solution).results.filter((r) => !r.ok);
  if (failed.length) {
    fail(failed.map((r) => `эталонное решение не проходит проверку «${r.text}»${r.detail ? `: ${r.detail}` : ''}`).join('; '));
  }
  if (evaluateLesson(l, docs.start).solved) {
    fail('стартовая схема уже проходит все проверки — ученику нечего делать; внесите неисправность или уберите часть схемы');
  }
}

export function parseLessons(raw: unknown): Lesson[] {
  const parsed = lessonsFileSchema.safeParse(raw, PARSE_OPTIONS);
  if (!parsed.success) throw new Error(`Ошибка в заданиях: ${describeZodError(parsed.error)}`);
  const ids = new Set<string>();
  for (const l of parsed.data.lessons) {
    if (ids.has(l.id)) throw new Error(`Ошибка в заданиях: повторяется id «${l.id}»`);
    ids.add(l.id);
    validateLesson(l);
  }
  return parsed.data.lessons;
}

/** Одно задание (из редактора преподавателя или сохранённое в браузере). */
export function parseLesson(raw: unknown): Lesson {
  const parsed = lessonSchema.safeParse(raw, PARSE_OPTIONS);
  if (!parsed.success) throw new Error(`Ошибка в задании: ${describeZodError(parsed.error)}`);
  validateLesson(parsed.data);
  return parsed.data;
}

/** Файл заданий — того же формата, что src/data/lessons.json. */
export const lessonsFile = (lessons: Lesson[]) => ({ $comment: 'Учебные задания AV-Tracer', lessons });

/** Схема из короткой записи: устройства из каталога, кабели «устройство.порт». */
export function buildDoc(spec: DocSpec, lessonId = ''): ProjectDoc {
  const devices: Device[] = spec.devices.map((d) => {
    const tpl = findEquipment(d.eq);
    if (!tpl) throw new Error(`нет в каталоге «${d.eq}»`);
    const device = createDevice(tpl, d.id, { x: d.x, y: d.y });
    if (d.props) device.properties = { ...device.properties, ...(d.props as PropMap) };
    if (d.room) device.room = d.room;
    return device;
  });
  const end = (ref: string) => {
    const dot = ref.indexOf('.');
    const device = ref.slice(0, dot);
    const port = ref.slice(dot + 1);
    const d = devices.find((x) => x.id === device);
    if (!d) throw new Error(`кабель «${ref}»: нет устройства «${device}»`);
    const p = d.ports.find((x) => x.id === port);
    if (!p) throw new Error(`нет порта «${ref}»`);
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
