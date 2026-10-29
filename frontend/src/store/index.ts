import { configureStore } from '@reduxjs/toolkit';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import canvasReducer, { initialCanvasState, showToast } from '../features/canvasSlice';
import lessonReducer, { initialLessonState, LessonState } from '../features/lessonSlice';
import { parseProjectDoc, serializeProject } from '../data/projectSchema';
import { setSaveStatus } from './saveStatus';
import { Lesson, lessonsFile, parseLesson } from '../learning/lessonSchema';

const STORAGE_KEY = 'av-tracer:autosave';
const PREFS_KEY = 'av-tracer:prefs';
const LESSON_KEY = 'av-tracer:lesson';
const CUSTOM_LESSONS_KEY = 'av-tracer:custom-lessons';

/**
 * Свои задания преподавателя. Каждое проверяется отдельно: задание, ставшее
 * некорректным (например, карточку убрали из каталога), не мешает остальным.
 */
let droppedLessons: string[] = [];
function loadCustomLessons(): Lesson[] {
  try {
    const raw = JSON.parse(localStorage.getItem(CUSTOM_LESSONS_KEY) || '{}');
    if (!Array.isArray(raw.lessons)) return [];
    return raw.lessons.flatMap((l: unknown) => {
      try {
        return [parseLesson(l)];
      } catch (e) {
        droppedLessons.push((e as Error).message);
        return [];
      }
    });
  } catch {
    return [];
  }
}

/** Учебный режим (текущее задание и пройденные) — удобство конкретного браузера. */
function loadLesson(): LessonState {
  try {
    const raw = JSON.parse(localStorage.getItem(LESSON_KEY) || '{}');
    return {
      ...initialLessonState,
      activeId: typeof raw.activeId === 'string' ? raw.activeId : null,
      hintsShown: Number.isInteger(raw.hintsShown) ? raw.hintsShown : 0,
      solutionShown: raw.solutionShown === true,
      completed: Array.isArray(raw.completed) ? raw.completed.filter((x: unknown) => typeof x === 'string') : [],
      custom: loadCustomLessons(),
    };
  } catch {
    return { ...initialLessonState, custom: loadCustomLessons() };
  }
}

function loadPersisted() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = parseProjectDoc(JSON.parse(raw));
    if (parsed.ok) {
      return {
        devices: parsed.devices,
        connections: parsed.connections,
        rooms: parsed.rooms,
        racks: parsed.racks,
        meta: parsed.meta,
        // Автосейв старого формата обновлён — сообщаем, что изменилось
        ...(parsed.notes.length
          ? { toast: { message: `Схема обновлена: ${parsed.notes.join('; ')}`, severity: 'info' as const } }
          : {}),
      };
    }
  } catch {
    /* поврежденный автосейв игнорируем */
  }
  return undefined;
}

/** Настройки вида (привязка к сетке, подписи кабелей) переживают перезагрузку. */
function loadPrefs() {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
    return {
      snapToGrid: typeof raw.snapToGrid === 'boolean' ? raw.snapToGrid : initialCanvasState.snapToGrid,
      showCableLabels:
        typeof raw.showCableLabels === 'boolean' ? raw.showCableLabels : initialCanvasState.showCableLabels,
    };
  } catch {
    return {};
  }
}

const persisted = loadPersisted();
const lessonState = loadLesson();
// Сохранённое задание больше не проходит проверку (например, карточку убрали из каталога) — сообщаем
const lessonsToast = droppedLessons.length
  ? { toast: { message: `Свои задания не загружены (${droppedLessons.length}): ${droppedLessons[0]}`, severity: 'warning' as const } }
  : {};
droppedLessons = [];

export const store = configureStore({
  reducer: {
    canvas: canvasReducer,
    lesson: lessonReducer,
  },
  preloadedState: { canvas: { ...initialCanvasState, ...loadPrefs(), ...lessonsToast, ...persisted }, lesson: lessonState },
});

// Ошибку записи показываем после текущего действия, чтобы её не перекрыло его же сообщение («Загружено заданий…»)
const warn = (message: string, severity: 'warning' | 'error') => queueMicrotask(() => store.dispatch(showToast({ message, severity })));

let lastLesson = store.getState().lesson;
let progressWarned = false;
store.subscribe(() => {
  const lesson = store.getState().lesson;
  if (lesson === lastLesson) return;
  const customChanged = lesson.custom !== lastLesson.custom;
  lastLesson = lesson;
  try {
    const { activeId, hintsShown, solutionShown, completed } = lesson;
    localStorage.setItem(LESSON_KEY, JSON.stringify({ activeId, hintsShown, solutionShown, completed }));
  } catch {
    // Прогресс пишется часто — предупреждаем один раз
    if (!progressWarned) warn('Прогресс заданий не сохраняется: хранилище браузера переполнено или запрещено', 'warning');
    progressWarned = true;
  }
  if (!customChanged) return;
  try {
    if (lesson.custom.length) localStorage.setItem(CUSTOM_LESSONS_KEY, JSON.stringify(lessonsFile(lesson.custom)));
    else localStorage.removeItem(CUSTOM_LESSONS_KEY);
  } catch {
    warn('Свои задания не сохранены в браузере (нет места или хранилище запрещено) — скачайте их в файл, иначе после перезагрузки они пропадут', 'error');
  }
});

let lastSaved: {
  devices: unknown;
  connections: unknown;
  rooms: unknown;
  racks: unknown;
  meta: unknown;
  snapToGrid: boolean;
  showCableLabels: boolean;
} | null = null;

function saveNow() {
  const { devices, connections, rooms, racks, meta, snapToGrid, showCableLabels } = store.getState().canvas;
  lastSaved = { devices, connections, rooms, racks, meta, snapToGrid, showCableLabels };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeProject({ devices, connections, rooms, racks, meta })));
    localStorage.setItem(PREFS_KEY, JSON.stringify({ snapToGrid, showCableLabels }));
    setSaveStatus({ state: 'saved', at: Date.now() });
  } catch {
    // Нет места или хранилище запрещено — показываем это в строке состояния
    setSaveStatus({ state: 'error', at: Date.now() });
  }
}

// Обновлённый (мигрированный) автосейв записываем сразу, чтобы миграция не повторялась
if (persisted) saveNow();

// Автосохранение схемы в localStorage (с лёгким троттлингом) — только когда
// изменилась сама схема или настройки вида, а не выделение, зум и т. п.
let saveTimer: ReturnType<typeof setTimeout> | null = null;
store.subscribe(() => {
  const { devices, connections, rooms, racks, meta, snapToGrid, showCableLabels } = store.getState().canvas;
  const changed =
    !lastSaved ||
    lastSaved.devices !== devices ||
    lastSaved.connections !== connections ||
    lastSaved.rooms !== rooms ||
    lastSaved.racks !== racks ||
    lastSaved.meta !== meta ||
    lastSaved.snapToGrid !== snapToGrid ||
    lastSaved.showCableLabels !== showCableLabels;
  if (!changed || saveTimer) return;
  setSaveStatus({ state: 'pending' });
  saveTimer = setTimeout(() => {
    saveTimer = null;
    saveNow();
  }, 400);
});

// Вкладку закрывают или сворачивают — сохраняем не дожидаясь таймера
function flush() {
  if (!saveTimer) return;
  clearTimeout(saveTimer);
  saveTimer = null;
  saveNow();
}
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
}

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
