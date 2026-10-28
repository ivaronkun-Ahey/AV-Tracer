import { describe, it, expect } from 'vitest';
import { LESSONS } from './lessons';
import { buildDoc, parseLessons } from './lessonSchema';
import { evaluateLesson } from './checks';
import { Device } from '../types/device.types';

describe('учебные задания', () => {
  it('файл заданий проходит проверку схемы; есть задания обоих типов', () => {
    expect(LESSONS.length).toBeGreaterThanOrEqual(10);
    expect(LESSONS.some((l) => l.kind === 'build')).toBe(true);
    expect(LESSONS.some((l) => l.kind === 'troubleshoot')).toBe(true);
  });

  for (const lesson of LESSONS) {
    describe(`«${lesson.title}»`, () => {
      it('стартовая схема ещё не решает задание', () => {
        expect(evaluateLesson(lesson, buildDoc(lesson.start, lesson.id)).solved).toBe(false);
      });

      it('эталонное решение проходит все проверки', () => {
        const ev = evaluateLesson(lesson, buildDoc(lesson.solution, lesson.id));
        expect(ev.results.filter((r) => !r.ok)).toEqual([]);
      });

      it('решение использует только оборудование задания', () => {
        if (!lesson.palette) return;
        const allowed = new Set(lesson.palette.map((eq) => eq));
        for (const d of lesson.solution.devices) expect(allowed.has(d.eq)).toBe(true);
      });
    });
  }

  it('поиск неисправностей — без кнопки «Исправить»', () => {
    for (const l of LESSONS.filter((x) => x.kind === 'troubleshoot')) expect(l.allowFixes).toBe(false);
  });
});

describe('проверки заданий', () => {
  const lesson = LESSONS.find((l) => l.id === 'long-run')!;

  it('прямой HDMI на 30 м: изображение доходит, но кабель длиннее нормы', () => {
    const doc = buildDoc(
      { ...lesson.start, connections: [{ from: 'pc.hdmi_out', to: 'proj.hdmi_in_1', length: 30 }] },
      lesson.id
    );
    const ev = evaluateLesson(lesson, doc);
    expect(ev.solved).toBe(false);
    expect(ev.results.find((r) => r.text.includes('не длиннее'))?.ok).toBe(false);
  });

  it('удлинитель есть, но длина трассы не задана — подсказка про длину', () => {
    const solution = buildDoc(lesson.solution, lesson.id);
    solution.connections = solution.connections.map((c) => ({ ...c, cable_length: 2 }));
    const reach = evaluateLesson(lesson, solution).results[0];
    expect(reach.ok).toBe(false);
    expect(reach.detail).toContain('длина трассы');
  });

  it('проверка «uses» сообщает, сколько устройств сейчас на схеме', () => {
    const ev = evaluateLesson({ checks: [{ type: 'uses', text: 't', select: { type: 'extender' }, min: 2 }] }, { devices: [] as Device[], connections: [], rooms: [] });
    expect(ev.results[0].detail).toContain('0');
  });

  it('ошибка в файле заданий называет место', () => {
    expect(() => parseLessons({ lessons: [{ id: 'x' }] })).toThrow('Ошибка в заданиях');
    const bad = { ...LESSONS[0], palette: ['no-such-device'] };
    expect(() => parseLessons({ lessons: [bad] })).toThrow('no-such-device');
  });
});
