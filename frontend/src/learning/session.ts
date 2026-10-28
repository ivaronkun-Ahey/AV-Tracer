import { AppDispatch, RootState } from '../store';
import { loadProject, requestFit, setSimulation, showToast } from '../features/canvasSlice';
import { exitLesson, markSolutionShown, setResults, startLesson } from '../features/lessonSlice';
import { parseProjectDoc, serializeProject } from '../data/projectSchema';
import { runSimulation } from '../sim/engine';
import { Lesson, buildDoc } from './lessonSchema';
import { evaluateLesson } from './checks';

/** Своя схема пользователя на время задания — вернётся после выхода. */
const STASH_KEY = 'av-tracer:before-lesson';

function stash(state: RootState) {
  const { devices, connections, rooms, meta } = state.canvas;
  if (devices.length === 0) return;
  try {
    localStorage.setItem(STASH_KEY, JSON.stringify(serializeProject({ devices, connections, rooms, meta })));
  } catch {
    /* нет места — схема всё равно доступна через Ctrl+Z */
  }
}

function takeStash() {
  try {
    const raw = localStorage.getItem(STASH_KEY);
    localStorage.removeItem(STASH_KEY);
    if (!raw) return null;
    const parsed = parseProjectDoc(JSON.parse(raw));
    return parsed.ok ? parsed : null;
  } catch {
    return null;
  }
}

export function hasStash(): boolean {
  try {
    return localStorage.getItem(STASH_KEY) !== null;
  } catch {
    return false;
  }
}

export function startLessonSession(dispatch: AppDispatch, state: RootState, lesson: Lesson) {
  // Свою схему сохраняем только при входе в учебный режим, а не при переходе между заданиями
  if (!state.lesson.activeId) stash(state);
  dispatch(loadProject(buildDoc(lesson.start, lesson.id)));
  dispatch(startLesson(lesson.id));
  dispatch(requestFit());
}

export function exitLessonSession(dispatch: AppDispatch) {
  dispatch(exitLesson());
  const saved = takeStash();
  if (saved) {
    dispatch(loadProject({ devices: saved.devices, connections: saved.connections, rooms: saved.rooms, meta: saved.meta }));
    dispatch(requestFit());
    dispatch(showToast({ message: 'Ваша схема возвращена', severity: 'info' }));
  }
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
