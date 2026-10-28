import { Connection, Device, ProjectDoc, SignalFlow, SimulationResult } from '../types/device.types';
import { runSimulation } from '../sim/engine';
import { Lesson, LessonCheck, Selector } from './lessonSchema';

export interface CheckResult {
  text: string;
  ok: boolean;
  /** Что именно не так (для ученика). */
  detail?: string;
}

export interface LessonEvaluation {
  results: CheckResult[];
  solved: boolean;
}

const matches = (d: Device, s: Selector) => (!s.type || d.type === s.type) && (!s.model || d.model === s.model);

/** Суммарная длина кабелей по пути сигнала (по портам входа в каждое устройство). */
export function pathLength(flow: SignalFlow, connections: Connection[]): number {
  let total = 0;
  for (let i = 1; i < flow.path.length; i++) {
    const prev = flow.path[i - 1];
    const cur = flow.path[i];
    const entry = flow.entry_ports?.[i];
    const cable =
      connections.find((c) => c.from.device === prev && c.to.device === cur && (!entry || c.to.port === entry)) ??
      // Кабель между двумя сетевыми портами проходим в обе стороны
      connections.find((c) => c.to.device === prev && c.from.device === cur && (!entry || c.from.port === entry));
    total += cable?.cable_length ?? 0;
  }
  return total;
}

function evaluateCheck(check: LessonCheck, doc: ProjectDoc, sim: SimulationResult): CheckResult {
  const byId = Object.fromEntries(doc.devices.map((d) => [d.id, d]));
  switch (check.type) {
    case 'no_errors':
      return sim.errors.length === 0
        ? { text: check.text, ok: true }
        : { text: check.text, ok: false, detail: `ошибок: ${sim.errors.length} — запустите симуляцию и посмотрите, какие` };
    case 'no_issue': {
      const found = [...sim.errors, ...sim.warnings].filter((i) => check.issues.includes(i.type));
      return found.length === 0 ? { text: check.text, ok: true } : { text: check.text, ok: false, detail: found[0].message };
    }
    case 'uses': {
      const n = doc.devices.filter((d) => matches(d, check.select)).length;
      const ok = n >= (check.min ?? 1) && (check.max === undefined || n <= check.max);
      return ok ? { text: check.text, ok } : { text: check.text, ok, detail: `сейчас на схеме: ${n}` };
    }
    case 'reaches': {
      const sinks = doc.devices.filter((d) => matches(d, check.to));
      if (sinks.length === 0) return { text: check.text, ok: false, detail: 'на схеме нет нужного приёмника' };
      const flowsTo = (sink: Device) =>
        sim.signal_flows.filter(
          (f) =>
            f.type === check.domain &&
            f.status !== 'error' &&
            f.path[f.path.length - 1] === sink.id &&
            byId[f.source] &&
            matches(byId[f.source], check.from)
        );
      const ok = (sink: Device) =>
        flowsTo(sink).some((f) => check.minLength === undefined || pathLength(f, doc.connections) >= check.minLength);
      const reached = sinks.filter(ok);
      const pass = check.all ? reached.length === sinks.length : reached.length > 0;
      if (pass) return { text: check.text, ok: true };
      const missing = sinks.find((s) => !ok(s))!;
      const short = check.minLength !== undefined && flowsTo(missing).length > 0;
      return {
        text: check.text,
        ok: false,
        detail: short
          ? `сигнал доходит до «${missing.model}», но длина трассы меньше ${check.minLength} м — задайте длину кабелей`
          : `сигнал не доходит до «${missing.model}»`,
      };
    }
  }
}

/** Проверка задания: все критерии по результату симуляции текущей схемы. */
export function evaluateLesson(lesson: Pick<Lesson, 'checks'>, doc: ProjectDoc): LessonEvaluation {
  const sim = runSimulation(doc.devices, doc.connections);
  const results = lesson.checks.map((c) => evaluateCheck(c, doc, sim));
  return { results, solved: results.every((r) => r.ok) };
}
