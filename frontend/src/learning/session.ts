import { AppDispatch, RootState } from '../store';
import { loadProject, requestFit, setSimulation, showToast } from '../features/canvasSlice';
import { exitLesson, markSolutionShown, setResults, startLesson } from '../features/lessonSlice';
import { downloadFile } from '../features/exportDocs';
import { ParsedProject, parseProjectDoc, serializeProject } from '../data/projectSchema';
import { runSimulation } from '../sim/engine';
import { ProjectDoc } from '../types/device.types';
import { Lesson, buildDoc } from './lessonSchema';
import { evaluateLesson } from './checks';

/** Своя схема пользователя на время задания — вернётся после выхода. */
const STASH_KEY = 'av-tracer:before-lesson';
const STASH_FILE = 'av-tracer-skhema-do-zadaniya.json';

/** Есть ли в схеме что терять: не только устройства, но и помещения, шкафы, данные штампа. */
export function hasContent({ devices, connections, rooms, racks, meta }: ProjectDoc): boolean {
  return (
    devices.length > 0 ||
    connections.length > 0 ||
    rooms.length > 0 ||
    (racks?.length ?? 0) > 0 ||
    Object.values(meta ?? {}).some((v) => v !== undefined && v !== '')
  );
}

function readStash(): string | null {
  try {
    return localStorage.getItem(STASH_KEY);
  } catch {
    return null;
  }
}

function dropStash() {
  try {
    localStorage.removeItem(STASH_KEY);
  } catch {
    /* хранилище недоступно — и копии в нём нет */
  }
}

/** Записывает схему и перечитывает: запись считается удачной, только если копия на месте. */
function stash(state: RootState): boolean {
  const { devices, connections, rooms, racks, meta } = state.canvas;
  const json = JSON.stringify(serializeProject({ devices, connections, rooms, racks, meta }));
  try {
    localStorage.setItem(STASH_KEY, json);
    return localStorage.getItem(STASH_KEY) === json;
  } catch {
    return false;
  }
}

export function hasStash(): boolean {
  return readStash() !== null;
}

/**
 * Вход в задание — по шагам, без потерь: сначала собирается схема задания,
 * затем сохраняется своя схема пользователя, и только после этого холст заменяется.
 * Не получилось — своя схема остаётся на холсте, пользователь видит причину.
 */
export function startLessonSession(dispatch: AppDispatch, state: RootState, lesson: Lesson): boolean {
  let doc: ProjectDoc;
  try {
    doc = buildDoc(lesson.start, lesson.id);
  } catch (e) {
    dispatch(showToast({ message: `Задание «${lesson.title}» не открыть: ${(e as Error).message}`, severity: 'error' }));
    return false;
  }
  // Свою схему сохраняем только при входе в учебный режим, а не при переходе между заданиями.
  // Пустую схему поверх уже сохранённой копии не пишем — та вернётся при выходе.
  const own = hasContent(state.canvas);
  if (!state.lesson.activeId && (own || !hasStash())) {
    const kept = stash(state);
    if (!kept && own) {
      dispatch(
        showToast({
          message:
            'Задание не начато: не удалось сохранить вашу схему в браузере (нет места или хранилище запрещено). Сохраните схему в файл и попробуйте снова.',
          severity: 'error',
        })
      );
      return false;
    }
  }
  dispatch(loadProject(doc));
  dispatch(startLesson(lesson.id));
  dispatch(requestFit());
  return true;
}

export function exitLessonSession(dispatch: AppDispatch) {
  dispatch(exitLesson());
  const raw = readStash();
  if (raw === null) return;
  let saved: ParsedProject;
  try {
    saved = parseProjectDoc(JSON.parse(raw));
  } catch {
    saved = { ok: false, error: 'копия повреждена' };
  }
  if (saved.ok) {
    dispatch(loadProject({ devices: saved.devices, connections: saved.connections, rooms: saved.rooms, racks: saved.racks, meta: saved.meta }));
    dispatch(requestFit());
    // Копия удаляется только после того, как схема вернулась на холст
    dropStash();
    dispatch(showToast({ message: 'Ваша схема возвращена', severity: 'info' }));
    return;
  }
  // Копию не прочитать (например, её формат строже проверяется в новой версии) — отдаём файлом
  let downloaded = false;
  try {
    downloadFile(STASH_FILE, raw, 'application/json');
    downloaded = true;
  } catch {
    /* скачивание недоступно — копия остаётся в браузере */
  }
  if (downloaded) dropStash();
  dispatch(
    showToast({
      message: `Не удалось вернуть вашу схему: ${saved.error}.${downloaded ? ` Копия скачана в файл ${STASH_FILE}.` : ''}`,
      severity: 'error',
    })
  );
}

export function checkLesson(dispatch: AppDispatch, state: RootState, lesson: Lesson) {
  const { devices, connections, rooms } = state.canvas;
  const evaluation = evaluateLesson(lesson, { devices, connections, rooms });
  dispatch(setResults(evaluation));
  return evaluation;
}

export function showLessonSolution(dispatch: AppDispatch, lesson: Lesson) {
  const doc = buildDoc(lesson.solution, lesson.id);
  dispatch(loadProject(doc));
  dispatch(markSolutionShown());
  dispatch(requestFit());
  dispatch(setSimulation(runSimulation(doc.devices, doc.connections)));
}
