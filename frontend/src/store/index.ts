import { configureStore } from '@reduxjs/toolkit';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import canvasReducer, { initialCanvasState } from '../features/canvasSlice';
import { parseProjectDoc, serializeProject } from '../data/projectSchema';

const STORAGE_KEY = 'av-tracer:autosave';
const PREFS_KEY = 'av-tracer:prefs';

function loadPersisted() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = parseProjectDoc(JSON.parse(raw));
    if (parsed.ok) {
      return {
        devices: parsed.devices,
        connections: parsed.connections,
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

export const store = configureStore({
  reducer: {
    canvas: canvasReducer,
  },
  preloadedState: { canvas: { ...initialCanvasState, ...loadPrefs(), ...persisted } },
});

function saveNow() {
  const { devices, connections, snapToGrid, showCableLabels } = store.getState().canvas;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeProject(devices, connections)));
    localStorage.setItem(PREFS_KEY, JSON.stringify({ snapToGrid, showCableLabels }));
  } catch {
    /* localStorage недоступен — молча пропускаем */
  }
}

// Обновлённый (мигрированный) автосейв записываем сразу, чтобы миграция не повторялась
if (persisted) saveNow();

// Автосохранение схемы в localStorage (с лёгким троттлингом).
let saveTimer: ReturnType<typeof setTimeout> | null = null;
store.subscribe(() => {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    saveNow();
  }, 400);
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
