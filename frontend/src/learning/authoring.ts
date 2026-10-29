import { Device, ProjectDoc, PropMap } from '../types/device.types';
import { getAllEquipment } from '../data/equipment';
import { DEVICE_TYPE_LABELS } from '../data/labels';
import { runSimulation } from '../sim/engine';
import { translit } from '../drawing/translit';
import { DocSpec, Lesson, LessonCheck, buildDoc, parseLesson } from './lessonSchema';
import { isReservedId } from '../data/propSchema';

/**
 * Задания преподавателя: схема с холста → короткая запись задания
 * (карточки каталога и «устройство.порт»), предложенные проверки по симуляции
 * эталонного решения, сборка и проверка задания перед сохранением.
 */

export type StartMode = 'empty' | 'devices' | 'captured';

export interface LessonDraft {
  /** id сохранённого задания, которое редактируется. */
  id?: string;
  title: string;
  kind: 'build' | 'troubleshoot';
  level: 1 | 2 | 3;
  goal: string;
  theory: string;
  /** Подсказки — по одной на строку. */
  hints: string;
  solution?: DocSpec;
  startMode: StartMode;
  start?: DocSpec;
  /** Библиотека в задании — только оборудование задания. */
  limitPalette: boolean;
  checks: Array<LessonCheck & { enabled: boolean }>;
}

export const emptyDraft = (): LessonDraft => ({
  title: '',
  kind: 'build',
  level: 1,
  goal: '',
  theory: '',
  hints: '',
  startMode: 'empty',
  limitPalette: true,
  checks: [],
});

const typeLabel = (type: string) => DEVICE_TYPE_LABELS[type] ?? type;

const templateOf = (d: Device) => getAllEquipment().find((e) => e.manufacturer === d.manufacturer && e.model === d.model);

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Схема с холста в запись задания; устройства не из каталога записать нельзя. */
export function docToSpec(doc: ProjectDoc): DocSpec {
  const ids = new Map<string, string>();
  const used = new Set<string>();
  const devices = doc.devices.map((d, i) => {
    const tpl = templateOf(d);
    if (!tpl) throw new Error(`«${d.full_name || d.model}» нет в каталоге — такое устройство нельзя использовать в задании`);
    // Короткие читаемые id по обозначению: MIC-01 → mic-01
    let id = (d.tag ?? `d${i + 1}`).toLowerCase().replace(/[^a-z0-9-]+/g, '-') || `d${i + 1}`;
    while (used.has(id) || isReservedId(id)) id = `${id}-${i + 1}`;
    used.add(id);
    ids.set(d.id, id);
    const props: PropMap = {};
    for (const [key, value] of Object.entries(d.properties)) {
      if (!same(value, tpl.default_properties[key])) props[key] = value;
    }
    return {
      id,
      eq: tpl._id,
      x: Math.round(d.position.x),
      y: Math.round(d.position.y),
      ...(Object.keys(props).length ? { props } : {}),
      ...(d.room ? { room: d.room } : {}),
    };
  });
  const connections = doc.connections.map((c) => ({
    from: `${ids.get(c.from.device)}.${c.from.port}`,
    to: `${ids.get(c.to.device)}.${c.to.port}`,
    length: c.cable_length,
  }));
  return { rooms: doc.rooms.map((r) => ({ ...r })), devices, connections };
}

/** Устройства решения без кабелей — «соедините сами». */
export const withoutCables = (spec: DocSpec): DocSpec => ({ ...spec, connections: [] });

/**
 * Проверки по симуляции эталонного решения: какие сигналы до каких приёмников
 * доходят, нет ошибок, уровень звука в норме.
 */
export function suggestChecks(spec: DocSpec): LessonCheck[] {
  const doc = buildDoc(spec, 'draft');
  const sim = runSimulation(doc.devices, doc.connections);
  const byId: Record<string, Device> = Object.create(null);
  for (const d of doc.devices) byId[d.id] = d;
  const checks: LessonCheck[] = [];
  const seen = new Set<string>();
  for (const flow of sim.signal_flows) {
    if (flow.status === 'error') continue;
    const source = byId[flow.source];
    const sink = byId[flow.path[flow.path.length - 1]];
    if (!source || !sink || source === sink) continue;
    const key = `${flow.type}|${source.type}|${sink.type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    // «До всех», если каждый приёмник этого типа получает сигнал от источника этого типа
    const sinks = doc.devices.filter((d) => d.type === sink.type);
    const all =
      sinks.length > 1 &&
      sinks.every((s) =>
        sim.signal_flows.some(
          (f) => f.type === flow.type && f.status !== 'error' && f.path.indexOf(s.id) > 0 && byId[f.source]?.type === source.type
        )
      );
    const what = `${flow.type === 'audio' ? 'Звук' : 'Изображение'}: ${typeLabel(source.type)} → ${typeLabel(sink.type)}`;
    checks.push({
      type: 'reaches',
      text: `${what}${all ? ' (все)' : ''}`,
      domain: flow.type,
      from: { type: source.type },
      to: { type: sink.type },
      ...(all ? { all: true } : {}),
    });
    // Тракт решения: без него «дошло» засчитывается и в обход нужного оборудования
    // (прямой кабель мимо коммутатора, кодера, деэмбеддера)
    const between = flow.path
      .slice(1, -1)
      .map((id) => byId[id].type)
      .filter((t, i, list) => i === 0 || list[i - 1] !== t);
    if (between.length > 0) {
      checks.push({
        type: 'reaches',
        text: `${what} через ${between.map(typeLabel).join(' → ')}`,
        domain: flow.type,
        from: { type: source.type },
        to: { type: sink.type },
        via: between.map((type) => ({ type })),
      });
    }
  }
  const issues = [...sim.errors, ...sim.warnings].map((i) => i.type);
  if (sim.signal_flows.some((f) => f.type === 'audio') && !issues.some((t) => t === 'level_low' || t === 'level_high')) {
    checks.push({ type: 'no_issue', text: 'Уровень звука в норме', issues: ['level_low', 'level_high'] });
  }
  if (sim.errors.length === 0) checks.push({ type: 'no_errors', text: 'В схеме нет ошибок' });
  return checks;
}

const slug = (s: string) =>
  translit(s.toLowerCase())
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

/** Свободный id для нового задания: my-<название>, при совпадении — с номером. */
export function lessonId(title: string, taken: Set<string>): string {
  const base = `my-${slug(title) || 'zadanie'}`;
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  return id;
}

export interface BuildResult {
  lesson?: Lesson;
  errors: string[];
}

/** Задание из черновика; эталон должен проходить проверки, а стартовая схема — нет. */
export function buildLesson(draft: LessonDraft, taken: Set<string>): BuildResult {
  const errors: string[] = [];
  if (!draft.title.trim()) errors.push('укажите название');
  if (!draft.goal.trim()) errors.push('укажите цель задания');
  if (!draft.solution) errors.push('задайте эталонное решение — кнопка «Взять текущую схему»');
  else if (draft.solution.devices.length === 0) errors.push('эталонное решение пустое');
  if (draft.startMode === 'captured' && !draft.start) errors.push('задайте стартовую схему — кнопка «Взять текущую схему»');
  const checks = draft.checks
    .filter((c) => c.enabled)
    .map((c) => {
      const check: Partial<LessonDraft['checks'][number]> = { ...c };
      delete check.enabled;
      return check as LessonCheck;
    });
  if (checks.length === 0) errors.push('выберите хотя бы одну проверку');
  if (errors.length || !draft.solution) return { errors };

  const start =
    draft.startMode === 'empty'
      ? { rooms: draft.solution.rooms, devices: [], connections: [] }
      : draft.startMode === 'devices'
        ? withoutCables(draft.solution)
        : draft.start!;
  const hints = draft.hints
    .split('\n')
    .map((h) => h.trim())
    .filter(Boolean);
  const palette = [...new Set([...draft.solution.devices, ...start.devices].map((d) => d.eq))];
  const raw = {
    id: draft.id ?? lessonId(draft.title, taken),
    title: draft.title.trim(),
    kind: draft.kind,
    level: draft.level,
    goal: draft.goal.trim(),
    theory: draft.theory.trim() || draft.goal.trim(),
    hints: hints.length ? hints : ['Запустите «Симуляцию» и посмотрите, что не так.'],
    allowFixes: draft.kind === 'build',
    ...(draft.limitPalette ? { palette } : {}),
    start,
    solution: draft.solution,
    checks,
  };
  // Та же проверка, что и для файла заданий: эталон проходит проверки, старт — нет
  try {
    return { lesson: parseLesson(raw), errors: [] };
  } catch (e) {
    return { errors: [(e as Error).message.replace(/^Ошибка в задании( «[^»]*»)?: /, '')] };
  }
}

/** Черновик из сохранённого задания — для правки. */
export function draftFromLesson(lesson: Lesson): LessonDraft {
  const startMode: StartMode =
    lesson.start.devices.length === 0
      ? 'empty'
      : lesson.start.connections.length === 0 && same(lesson.start.devices, lesson.solution.devices)
        ? 'devices'
        : 'captured';
  return {
    id: lesson.id,
    title: lesson.title,
    kind: lesson.kind,
    level: lesson.level as 1 | 2 | 3,
    goal: lesson.goal,
    theory: lesson.theory,
    hints: lesson.hints.join('\n'),
    solution: lesson.solution,
    startMode,
    ...(startMode === 'captured' ? { start: lesson.start } : {}),
    limitPalette: !!lesson.palette,
    checks: lesson.checks.map((c) => ({ ...c, enabled: true })),
  };
}
