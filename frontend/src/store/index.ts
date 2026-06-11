import { configureStore } from '@reduxjs/toolkit';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import canvasReducer from '../features/canvasSlice';
import type { Device, Connection } from '../types/device.types';

const STORAGE_KEY = 'av-tracer:autosave';

interface PersistedDoc {
  devices: Device[];
  connections: Connection[];
}

function loadPersisted(): PersistedDoc | undefined {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.devices) && Array.isArray(parsed.connections)) {
      return { devices: parsed.devices, connections: parsed.connections };
    }
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
  preloadedState: persisted
    ? { canvas: { ...defaultUiState(), devices: persisted.devices, connections: persisted.connections } }
    : undefined,
});

// Минимальные значения UI-полей для корректной гидратации стора из автосейва.
function defaultUiState() {
  return {
    selectedDeviceId: null,
    selectedConnectionId: null,
    connectionInProgress: null,
    zoom: 1,
    pan: { x: 0, y: 0 },
    past: [],
    future: [],
    simulation: null,
    showSimulation: false,
    toast: null,
  };
}

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
