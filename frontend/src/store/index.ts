import { configureStore } from '@reduxjs/toolkit';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import canvasReducer, { initialCanvasState } from '../features/canvasSlice';
import { parseProjectDoc } from '../data/projectSchema';

const STORAGE_KEY = 'av-tracer:autosave';

function loadPersisted() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = parseProjectDoc(JSON.parse(raw));
    if (parsed.ok) return { devices: parsed.devices, connections: parsed.connections };
  } catch {
    /* поврежденный автосейв игнорируем */
  }
  return undefined;
}

const persisted = loadPersisted();

export const store = configureStore({
  reducer: {
    canvas: canvasReducer,
  },
  preloadedState: persisted ? { canvas: { ...initialCanvasState, ...persisted } } : undefined,
});

// Автосохранение схемы в localStorage (с лёгким троттлингом).
let saveTimer: ReturnType<typeof setTimeout> | null = null;
store.subscribe(() => {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const { devices, connections } = store.getState().canvas;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ devices, connections }));
    } catch {
      /* localStorage недоступен — молча пропускаем */
    }
  }, 400);
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
