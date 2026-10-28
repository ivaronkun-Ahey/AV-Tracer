import { describe, it, expect } from 'vitest';
import { EXAMPLE_PROJECTS } from '../data/examples';
import { withDeviceTags } from '../data/deviceTags';
import { withCableLabels } from '../data/cableLabels';
import { ProjectDoc } from '../types/device.types';
import { buildDoc } from './lessonSchema';
import { LessonDraft, buildLesson, docToSpec, draftFromLesson, emptyDraft, lessonId, suggestChecks } from './authoring';

const example = (id: string): ProjectDoc => {
  const p = EXAMPLE_PROJECTS.find((e) => e.id === id)!.build();
  const devices = withDeviceTags(p.devices);
  return { devices, connections: withCableLabels(devices, p.connections), rooms: p.rooms ?? [] };
};

const draftFor = (doc: ProjectDoc, patch: Partial<LessonDraft> = {}): LessonDraft => {
  const solution = docToSpec(doc);
  return {
    ...emptyDraft(),
    title: 'Озвучивание зала',
    goal: 'Соберите систему озвучивания',
    solution,
    checks: suggestChecks(solution).map((c) => ({ ...c, enabled: true })),
    ...patch,
  };
};

describe('задание из схемы', () => {
  it('схема → запись задания → схема: устройства, параметры, помещения и кабели сохраняются', () => {
    const doc = example('concert');
    doc.devices[1].properties = { ...doc.devices[1].properties, input_gain: 37 };
    const spec = docToSpec(doc);
    expect(spec.devices.map((d) => d.id)).toEqual(doc.devices.map((d) => d.tag!.toLowerCase()));
    expect(spec.devices[1].props).toEqual({ input_gain: 37 });
    // Параметры по умолчанию не записываются
    expect(spec.devices[0].props).toBeUndefined();
    const back = buildDoc(spec, 't');
    expect(back.devices.map((d) => d.model)).toEqual(doc.devices.map((d) => d.model));
    expect(back.devices.map((d) => d.room)).toEqual(doc.devices.map((d) => d.room));
    expect(back.devices[1].properties.input_gain).toBe(37);
    expect(back.connections).toHaveLength(doc.connections.length);
    expect(back.connections.map((c) => c.cable_length)).toEqual(doc.connections.map((c) => c.cable_length));
    expect(back.rooms).toEqual(doc.rooms);
  });

  it('устройство не из каталога записать нельзя', () => {
    const doc = example('basic-pa');
    doc.devices[0] = { ...doc.devices[0], model: 'Самодельный' };
    expect(() => docToSpec(doc)).toThrow('нет в каталоге');
  });

  it('проверки по симуляции решения: звук до колонок, уровень, нет ошибок', () => {
    const checks = suggestChecks(docToSpec(example('basic-pa')));
    expect(checks.map((c) => c.type)).toEqual(['reaches', 'no_issue', 'no_errors']);
    expect(checks[0]).toMatchObject({ domain: 'audio', from: { type: 'microphone' }, to: { type: 'speaker' } });
    const video = suggestChecks(docToSpec(example('presentation')));
    expect(video.some((c) => c.type === 'reaches' && c.domain === 'video')).toBe(true);
  });

  it('«соберите систему»: пустой старт, библиотека — оборудование решения, id по названию', () => {
    const result = buildLesson(draftFor(example('basic-pa')), new Set());
    expect(result.errors).toEqual([]);
    const lesson = result.lesson!;
    expect(lesson.id).toBe('my-ozvuchivanie-zala');
    expect(lesson.start.devices).toEqual([]);
    expect(lesson.allowFixes).toBe(true);
    expect(lesson.palette).toEqual([...new Set(lesson.solution.devices.map((d) => d.eq))]);
    expect(lesson.hints.length).toBeGreaterThan(0);
    expect(lessonId('Озвучивание зала', new Set([lesson.id]))).toBe('my-ozvuchivanie-zala-2');
  });

  it('«найдите неисправность»: старт — схема с неисправностью; старт без неисправности не принимается', () => {
    const working = example('basic-pa');
    const broken = example('basic-pa');
    broken.connections = broken.connections.slice(1);
    const ok = buildLesson(draftFor(working, { kind: 'troubleshoot', startMode: 'captured', start: docToSpec(broken) }), new Set());
    expect(ok.errors).toEqual([]);
    expect(ok.lesson!.allowFixes).toBe(false);

    const same = buildLesson(draftFor(working, { kind: 'troubleshoot', startMode: 'captured', start: docToSpec(working) }), new Set());
    expect(same.errors.join()).toContain('уже проходит все проверки');

    const missing = buildLesson(draftFor(working, { kind: 'troubleshoot', startMode: 'captured' }), new Set());
    expect(missing.errors.join()).toContain('стартовую схему');
  });

  it('эталон должен проходить выбранные проверки; пустые поля и проверки — понятные ошибки', () => {
    const broken = example('basic-pa');
    broken.connections = broken.connections.slice(1);
    const draft = draftFor(example('basic-pa'), { solution: docToSpec(broken) });
    expect(buildLesson(draft, new Set()).errors.join()).toContain('эталонное решение не проходит проверку');

    const empty = buildLesson({ ...emptyDraft() }, new Set());
    expect(empty.errors).toEqual(expect.arrayContaining(['укажите название', 'укажите цель задания']));
    const noChecks = buildLesson(draftFor(example('basic-pa'), { checks: [] }), new Set());
    expect(noChecks.errors).toContain('выберите хотя бы одну проверку');
  });

  it('правка: черновик из задания и обратно — то же задание', () => {
    const lesson = buildLesson(draftFor(example('basic-pa'), { startMode: 'devices' }), new Set()).lesson!;
    const draft = draftFromLesson(lesson);
    expect(draft.startMode).toBe('devices');
    expect(buildLesson(draft, new Set([lesson.id])).lesson).toEqual(lesson);
  });
});
