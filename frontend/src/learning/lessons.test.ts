import { describe, it, expect } from 'vitest';
import { LESSONS } from './lessons';
import { DocSpec, buildDoc, parseLessons } from './lessonSchema';
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

/** Правдоподобные, но неверные решения: обход нужного оборудования не засчитывается (обзор 28.10, N1). */
describe('обходные решения не проходят', () => {
  const lessonOf = (id: string) => LESSONS.find((l) => l.id === id)!;
  const failed = (id: string, spec: DocSpec) =>
    evaluateLesson(lessonOf(id), buildDoc(spec, id))
      .results.filter((r) => !r.ok)
      .map((r) => [r.text, r.detail ?? '']);
  const solution = (id: string) => lessonOf(id).solution;

  it('AV-over-IP: прямой HDMI камера → дисплей, коммутатор стоит без кабелей', () => {
    const s = solution('av-over-ip');
    const spec: DocSpec = {
      ...s,
      devices: s.devices.filter((d) => ['cam', 'sw', 'tv'].includes(d.id)),
      connections: [{ from: 'cam.hdmi_out', to: 'tv.hdmi_in_1', length: 3 }],
    };
    const bad = failed('av-over-ip', spec);
    expect(bad).toHaveLength(1);
    expect(bad[0][0]).toContain('по сети');
    expect(bad[0][1]).toContain('но не через AV-over-IP кодер → Сетевой коммутатор → AV-over-IP декодер');
  });

  it('AV-over-IP: кодер соединён с декодером напрямую, мимо коммутатора', () => {
    const s = solution('av-over-ip');
    const spec: DocSpec = {
      ...s,
      connections: [
        { from: 'cam.hdmi_out', to: 'enc.hdmi_in', length: 3 },
        { from: 'enc.network_out', to: 'dec.network_in', length: 60 },
        { from: 'dec.hdmi_out', to: 'tv.hdmi_in_1', length: 2 },
      ],
    };
    expect(failed('av-over-ip', spec).map(([t]) => t)).toEqual(['Видео идёт по сети: кодер → сетевой коммутатор → декодер']);
  });

  it('звук из HDMI: колонка от аудиовыхода 3,5 мм ноутбука, деэмбеддер не подключён', () => {
    const s = solution('hdmi-sound');
    const spec: DocSpec = {
      ...s,
      connections: [
        { from: 'pc.hdmi_out', to: 'proj.hdmi_in_1', length: 15 },
        { from: 'pc.trs_out', to: 'mix.trs_in_7', length: 3 },
        { from: 'mix.xlr_out_l', to: 'spk.xlr_in', length: 10 },
      ],
    };
    expect(failed('hdmi-sound', spec).map(([t]) => t)).toEqual(['Звук взят из HDMI деэмбеддером']);
  });

  it('удлинитель: передатчик и приёмник на схеме, а проектор — по прямому HDMI 30 м', () => {
    const s = solution('long-run');
    const spec: DocSpec = { ...s, connections: [{ from: 'pc.hdmi_out', to: 'proj.hdmi_in_1', length: 30 }] };
    expect(failed('long-run', spec).map(([t]) => t)).toEqual([
      'Изображение идёт через удлинитель HDBaseT (передатчик и приёмник)',
      'Ни один кабель не длиннее допустимого',
    ]);
  });

  it('видеокоммутатор: ноутбук переткнули прямо в проектор вместо выбора входа', () => {
    const s = solution('fix-switcher');
    const spec: DocSpec = {
      ...s,
      connections: [
        { from: 'cam.hdmi_out', to: 'sw.hdmi_in_1', length: 10 },
        { from: 'pc.hdmi_out', to: 'proj.hdmi_in_1', length: 5 },
      ],
    };
    expect(failed('fix-switcher', spec).map(([t]) => t)).toEqual(['Изображение ноутбука доходит до проектора через видеокоммутатор']);
  });

  it('Dante: массив напрямую в процессор — без коммутатора нет питания PoE', () => {
    const s = solution('dante-ceiling');
    const spec: DocSpec = {
      ...s,
      connections: [
        { from: 'arr.dante_out', to: 'dsp.dante_in', length: 20 },
        { from: 'dsp.xlr_out_1', to: 'spk.xlr_in', length: 15 },
      ],
    };
    expect(failed('dante-ceiling', spec).map(([t]) => t)).toEqual(['Массив получает питание PoE']);
  });

  it('усилитель: две колонки на схеме, но подключена одна', () => {
    const s = solution('stereo-amp');
    const spec: DocSpec = { ...s, connections: s.connections.slice(0, -1) };
    expect(failed('stereo-amp', spec).length).toBeGreaterThan(0);
  });
});

/** Обзор 28.10, N4: файл заданий проверяется целиком до сохранения, а не при запуске задания. */
describe('проверка задания при загрузке', () => {
  const avip = LESSONS.find((l) => l.id === 'av-over-ip')!;
  const load = (patch: Partial<typeof avip>) => () => parseLessons({ lessons: [{ ...avip, ...patch }] });

  it('кабель к несуществующему порту — ошибка с названием задания и ссылкой', () => {
    const start = { ...avip.solution, connections: [{ ...avip.solution.connections[0], from: 'cam.missing_port' }, ...avip.solution.connections.slice(1)] };
    expect(load({ start })).toThrow(`Ошибка в задании «${avip.title}»: стартовая схема: нет порта «cam.missing_port»`);
  });

  it('кабель к несуществующему устройству, повтор id устройства, помещение без описания', () => {
    const s = avip.solution;
    expect(load({ solution: { ...s, connections: [{ from: 'ghost.hdmi_out', to: 'tv.hdmi_in_1' }] } })).toThrow('нет устройства «ghost»');
    expect(load({ solution: { ...s, devices: [...s.devices, { ...s.devices[0] }] } })).toThrow('повторяется идентификатор устройства «cam»');
    expect(load({ solution: { ...s, devices: [{ ...s.devices[0], room: 'nowhere' }, ...s.devices.slice(1)] } })).toThrow('нет помещения «nowhere»');
    expect(load({ solution: { ...s, devices: [{ ...s.devices[0], id: 'constructor' }, ...s.devices.slice(1)] } })).toThrow('служебное имя «constructor»');
  });

  it('эталонное решение не решает задание — отклоняется; стартовая схема уже решает — тоже', () => {
    const unsolved = { ...avip.solution, connections: avip.solution.connections.slice(1) };
    expect(load({ solution: unsolved })).toThrow('эталонное решение не проходит проверку');
    expect(load({ start: avip.solution })).toThrow('стартовая схема уже проходит все проверки');
  });

  it('оборудование решения не из библиотеки задания — отклоняется', () => {
    expect(load({ palette: avip.palette!.filter((eq) => eq !== 'netgear-gs728tp') })).toThrow('«netgear-gs728tp» нет в библиотеке задания');
  });

  it('принятое задание запускается: обе схемы собираются', () => {
    const [ok] = parseLessons({ lessons: [avip] });
    expect(() => buildDoc(ok.start, ok.id)).not.toThrow();
    expect(() => buildDoc(ok.solution, ok.id)).not.toThrow();
  });
});
