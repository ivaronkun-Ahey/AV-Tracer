import { configureStore } from '@reduxjs/toolkit';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import canvasReducer, { initialCanvasState } from '../features/canvasSlice';
import { parseProjectDoc, serializeProject } from '../data/projectSchema';
import { setSaveStatus } from './saveStatus';

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
        rooms: parsed.rooms,
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

export const store = configureStore({
  reducer: {
    canvas: canvasReducer,
  },
  preloadedState: { canvas: { ...initialCanvasState, ...loadPrefs(), ...persisted } },
});

let lastSaved: {
  devices: unknown;
  connections: unknown;
  rooms: unknown;
  meta: unknown;
  snapToGrid: boolean;
  showCableLabels: boolean;
} | null = null;

function saveNow() {
  const { devices, connections, rooms, meta, snapToGrid, showCableLabels } = store.getState().canvas;
  lastSaved = { devices, connections, rooms, meta, snapToGrid, showCableLabels };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeProject({ devices, connections, rooms, meta })));
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
  const { devices, connections, rooms, meta, snapToGrid, showCableLabels } = store.getState().canvas;
  const changed =
    !lastSaved ||
    lastSaved.devices !== devices ||
    lastSaved.connections !== connections ||
    lastSaved.rooms !== rooms ||
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
