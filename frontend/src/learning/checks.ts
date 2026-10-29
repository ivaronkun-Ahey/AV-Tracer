import { Connection, Device, ProjectDoc, SignalFlow, SimulationResult } from '../types/device.types';
import { runSimulation } from '../sim/engine';
import { DEVICE_TYPE_LABELS } from '../data/labels';
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

export const selectorLabel = (s: Selector) => s.model ?? DEVICE_TYPE_LABELS[s.type!] ?? s.type!;

/** Устройства между источником и приёмником (индекс upTo) проходят условия via по порядку. */
function passesVia(flow: SignalFlow, upTo: number, via: Selector[], byId: Record<string, Device>): boolean {
  let next = 0;
  for (let i = 1; i < upTo && next < via.length; i++) {
    const d = byId[flow.path[i]];
    if (d && matches(d, via[next])) next++;
  }
  return next === via.length;
}

/** Симуляция остановила перебор ветвей: отсутствие ошибок и сигнала не доказано. */
const INCOMPLETE = 'схема слишком разветвлённая: симуляция просмотрела не все пути сигнала, и это условие проверить нельзя — упростите схему';

/** Суммарная длина кабелей по пути сигнала до устройства с индексом upTo (по портам входа в каждое устройство). */
export function pathLength(flow: SignalFlow, connections: Connection[], upTo = flow.path.length - 1): number {
  let total = 0;
  for (let i = 1; i <= upTo; i++) {
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
  const byId: Record<string, Device> = Object.create(null);
  for (const d of doc.devices) byId[d.id] = d;
  switch (check.type) {
    case 'no_errors':
      if (sim.errors.length > 0) {
        return { text: check.text, ok: false, detail: `ошибок: ${sim.errors.length} — запустите симуляцию и посмотрите, какие` };
      }
      return sim.incomplete ? { text: check.text, ok: false, detail: INCOMPLETE } : { text: check.text, ok: true };
    case 'no_issue': {
      const found = [...sim.errors, ...sim.warnings].filter((i) => check.issues.includes(i.type));
      if (found.length > 0) return { text: check.text, ok: false, detail: found[0].message };
      return sim.incomplete ? { text: check.text, ok: false, detail: INCOMPLETE } : { text: check.text, ok: true };
    }
    case 'uses': {
      const n = doc.devices.filter((d) => matches(d, check.select)).length;
      const ok = n >= (check.min ?? 1) && (check.max === undefined || n <= check.max);
      return ok ? { text: check.text, ok } : { text: check.text, ok, detail: `сейчас на схеме: ${n}` };
    }
    case 'reaches': {
      const sinks = doc.devices.filter((d) => matches(d, check.to));
      if (sinks.length === 0) return { text: check.text, ok: false, detail: 'на схеме нет нужного приёмника' };
      // Приёмник может стоять и в середине цепочки: колонки по сквозному выходу, громкоговорители линии 100 В
      const flowsTo = (sink: Device) =>
        sim.signal_flows.filter(
          (f) =>
            f.type === check.domain &&
            f.status !== 'error' &&
            f.path.indexOf(sink.id) > 0 &&
            byId[f.source] &&
            matches(byId[f.source], check.from)
        );
      const routed = (sink: Device) =>
        flowsTo(sink).filter((f) => !check.via || passesVia(f, f.path.indexOf(sink.id), check.via, byId));
      const ok = (sink: Device) =>
        routed(sink).some(
          (f) => check.minLength === undefined || pathLength(f, doc.connections, f.path.indexOf(sink.id)) >= check.minLength
        );
      const reached = sinks.filter(ok);
      const pass = check.all ? reached.length === sinks.length : reached.length > 0;
      // Найденный тракт достоверен и при неполном анализе, а «не доходит» — нет
      if (pass) return { text: check.text, ok: true };
      if (sim.incomplete) return { text: check.text, ok: false, detail: INCOMPLETE };
      const missing = sinks.find((s) => !ok(s))!;
      let detail = `сигнал не доходит до «${missing.model}»`;
      if (flowsTo(missing).length > 0 && routed(missing).length === 0) {
        detail = `сигнал доходит до «${missing.model}», но не через ${check.via!.map(selectorLabel).join(' → ')}`;
      } else if (routed(missing).length > 0) {
        detail = `сигнал доходит до «${missing.model}», но длина трассы меньше ${check.minLength} м — задайте длину кабелей`;
      }
      return { text: check.text, ok: false, detail };
    }
  }
}

/** Проверка задания: все критерии по результату симуляции текущей схемы. */
export function evaluateLesson(lesson: Pick<Lesson, 'checks'>, doc: ProjectDoc): LessonEvaluation {
  const sim = runSimulation(doc.devices, doc.connections);
  const results = lesson.checks.map((c) => evaluateCheck(c, doc, sim));
  return { results, solved: results.every((r) => r.ok) };
}
