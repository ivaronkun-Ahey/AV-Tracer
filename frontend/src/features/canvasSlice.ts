import { createSlice, PayloadAction, current } from '@reduxjs/toolkit';
import { Device, Connection, SimulationResult, CableType, PropValue } from '../types/device.types';
import { connectionProblem, PortRef } from './connectionRules';
import { nextDeviceTag, withDeviceTags } from '../data/deviceTags';
import { connectionPrefix, nextCableLabel, withCableLabels } from '../data/cableLabels';

interface CanvasDoc {
  devices: Device[];
  connections: Connection[];
}

interface CanvasState {
  devices: Device[];
  connections: Connection[];
  selectedDeviceId: string | null;
  selectedConnectionId: string | null;
  connectionInProgress: {
    fromDeviceId: string;
    fromPortId: string;
  } | null;
  zoom: number;
  pan: { x: number; y: number };
  /** Размер видимой области холста — новое устройство с клавиатуры ставится в её центр. */
  viewport: { width: number; height: number };
  // Настройки вида
  snapToGrid: boolean;
  showCableLabels: boolean;
  /** Счётчик запросов «вписать схему в экран» (холст реагирует на изменение). */
  fitRequest: number;
  // История для undo/redo
  past: CanvasDoc[];
  future: CanvasDoc[];
  /** Ключ последней правки: подряд идущие правки одного поля — один шаг отмены. */
  lastHistoryKey: string | null;
  // Результаты симуляции
  simulation: SimulationResult | null;
  showSimulation: boolean;
  // Всплывающее уведомление
  toast: { message: string; severity: 'info' | 'success' | 'warning' | 'error' } | null;
}

const HISTORY_LIMIT = 50;

export const initialCanvasState: CanvasState = {
  devices: [],
  connections: [],
  selectedDeviceId: null,
  selectedConnectionId: null,
  connectionInProgress: null,
  zoom: 1,
  pan: { x: 0, y: 0 },
  viewport: { width: 800, height: 600 },
  snapToGrid: true,
  showCableLabels: true,
  fitRequest: 0,
  past: [],
  future: [],
  lastHistoryKey: null,
  simulation: null,
  showSimulation: false,
  toast: null,
};

interface HistoryOptions {
  /** Правки с одинаковым ключом подряд (ввод числа по символам) склеиваются в один шаг. */
  key?: string;
  /** Перемещение устройства не меняет схему — результат симуляции остаётся актуальным. */
  keepSimulation?: boolean;
}

/** Снимок текущего документа кладётся в историю перед изменением. */
function pushHistory(state: CanvasState, opts: HistoryOptions = {}) {
  const coalesce = opts.key !== undefined && opts.key === state.lastHistoryKey;
  state.lastHistoryKey = opts.key ?? null;
  if (!opts.keepSimulation) {
    // Любое изменение схемы делает прежний результат симуляции неактуальным
    state.simulation = null;
  }
  if (coalesce) return;
  state.past.push({
    devices: JSON.parse(JSON.stringify(current(state).devices)),
    connections: JSON.parse(JSON.stringify(current(state).connections)),
  });
  if (state.past.length > HISTORY_LIMIT) state.past.shift();
  state.future = [];
}

/**
 * Добавляет кабель, если он допустим: концы существуют, направления верные,
 * сигналы совместимы, порты свободны. Редьюсер проверяет сам, даже если
 * интерфейс уже проверил. Возвращает false, если кабель не добавлен.
 */
function addCable(state: CanvasState, from: PortRef, to: PortRef, cableType: CableType): boolean {
  if (connectionProblem(state.devices, state.connections, from, to)) return false;
  pushHistory(state);
  const newConnection: Connection = {
    id: `conn_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
    from: { ...from },
    to: { ...to },
    cable_type: cableType,
    cable_length: 10,
  };
  newConnection.label = nextCableLabel(state.connections, connectionPrefix(state.devices, newConnection));
  state.connections.push(newConnection);
  return true;
}

const canvasSlice = createSlice({
  name: 'canvas',
  initialState: initialCanvasState,
  reducers: {
    addDevice: (state, action: PayloadAction<Device>) => {
      pushHistory(state);
      // Обозначение — следующее свободное: остальные устройства не перенумеровываются
      const taken = action.payload.tag && state.devices.some((d) => d.tag === action.payload.tag);
      const tag = action.payload.tag && !taken ? action.payload.tag : nextDeviceTag(state.devices, action.payload.type);
      state.devices.push({ ...action.payload, tag });
      state.selectedDeviceId = action.payload.id;
      state.selectedConnectionId = null;
    },

    removeDevice: (state, action: PayloadAction<string>) => {
      pushHistory(state);
      if (state.connectionInProgress?.fromDeviceId === action.payload) state.connectionInProgress = null;
      state.devices = state.devices.filter((d) => d.id !== action.payload);
      state.connections = state.connections.filter(
        (c) => c.from.device !== action.payload && c.to.device !== action.payload
      );
      if (state.selectedDeviceId === action.payload) {
        state.selectedDeviceId = null;
      }
    },

    updateDevicePosition: (
      state,
      action: PayloadAction<{ id: string; position: { x: number; y: number } }>
    ) => {
      pushHistory(state, { keepSimulation: true });
      const device = state.devices.find((d) => d.id === action.payload.id);
      if (device) {
        device.position = action.payload.position;
      }
    },

    /** Начало перетаскивания: один снимок в историю на всё перемещение. */
    beginDeviceDrag: (state, action: PayloadAction<string>) => {
      pushHistory(state, { keepSimulation: true });
      state.selectedDeviceId = action.payload;
      state.selectedConnectionId = null;
    },

    /** Новые позиции сразу для многих устройств (автораскладка) — один шаг отмены. */
    setDevicePositions: (state, action: PayloadAction<Record<string, { x: number; y: number }>>) => {
      pushHistory(state, { keepSimulation: true });
      for (const d of state.devices) {
        const p = action.payload[d.id];
        if (p) d.position = p;
      }
    },

    /** Сдвиг стрелками: серия нажатий для одного устройства — один шаг отмены. */
    nudgeDevice: (state, action: PayloadAction<{ id: string; dx: number; dy: number }>) => {
      const device = state.devices.find((d) => d.id === action.payload.id);
      if (!device) return;
      pushHistory(state, { key: `nudge:${device.id}`, keepSimulation: true });
      device.position = { x: device.position.x + action.payload.dx, y: device.position.y + action.payload.dy };
    },

    /** Позиция во время перетаскивания — без записи в историю, кабели следуют за устройством. */
    moveDevice: (state, action: PayloadAction<{ id: string; position: { x: number; y: number } }>) => {
      const device = state.devices.find((d) => d.id === action.payload.id);
      if (device) device.position = action.payload.position;
    },

    updateDeviceProperty: (
      state,
      action: PayloadAction<{ id: string; property: string; value: PropValue }>
    ) => {
      pushHistory(state, { key: `prop:${action.payload.id}:${action.payload.property}` });
      const device = state.devices.find((d) => d.id === action.payload.id);
      if (device) {
        device.properties[action.payload.property] = action.payload.value;
      }
    },

    /** Новое обозначение устройства; пустое или занятое другим устройством не принимается. */
    setDeviceTag: (state, action: PayloadAction<{ id: string; tag: string }>) => {
      const tag = action.payload.tag.trim().toUpperCase();
      const device = state.devices.find((d) => d.id === action.payload.id);
      if (!device || !tag || tag.length > 32 || device.tag === tag) return;
      if (state.devices.some((d) => d.id !== device.id && d.tag === tag)) return;
      pushHistory(state, { keepSimulation: true });
      device.tag = tag;
    },

    selectDevice: (state, action: PayloadAction<string>) => {
      state.selectedDeviceId = action.payload;
      state.selectedConnectionId = null;
      state.lastHistoryKey = null;
    },

    deselectAll: (state) => {
      state.selectedDeviceId = null;
      state.selectedConnectionId = null;
      state.connectionInProgress = null;
      state.lastHistoryKey = null;
    },

    selectConnection: (state, action: PayloadAction<string>) => {
      state.selectedConnectionId = action.payload;
      state.selectedDeviceId = null;
      state.lastHistoryKey = null;
    },

    startConnection: (
      state,
      action: PayloadAction<{ deviceId: string; portId: string }>
    ) => {
      state.connectionInProgress = {
        fromDeviceId: action.payload.deviceId,
        fromPortId: action.payload.portId,
      };
    },

    completeConnection: (
      state,
      action: PayloadAction<{ toDeviceId: string; toPortId: string; cableType: CableType }>
    ) => {
      const pending = state.connectionInProgress;
      if (!pending) return;
      addCable(
        state,
        { device: pending.fromDeviceId, port: pending.fromPortId },
        { device: action.payload.toDeviceId, port: action.payload.toPortId },
        action.payload.cableType
      );
      state.connectionInProgress = null;
    },

    /** Кабель между двумя портами без «начать/закончить» на холсте (из панели свойств). */
    connect: (state, action: PayloadAction<{ from: PortRef; to: PortRef; cableType: CableType }>) => {
      addCable(state, action.payload.from, action.payload.to, action.payload.cableType);
    },

    cancelConnection: (state) => {
      state.connectionInProgress = null;
    },

    removeConnection: (state, action: PayloadAction<string>) => {
      pushHistory(state);
      state.connections = state.connections.filter((c) => c.id !== action.payload);
      if (state.selectedConnectionId === action.payload) {
        state.selectedConnectionId = null;
      }
    },

    updateConnectionLength: (state, action: PayloadAction<{ id: string; length: number }>) => {
      pushHistory(state, { key: `len:${action.payload.id}` });
      const conn = state.connections.find((c) => c.id === action.payload.id);
      if (conn) conn.cable_length = Math.max(0, action.payload.length);
    },

    clearCanvas: (state) => {
      pushHistory(state);
      state.devices = [];
      state.connections = [];
      state.selectedDeviceId = null;
      state.selectedConnectionId = null;
      state.connectionInProgress = null;
    },

    loadProject: (
      state,
      action: PayloadAction<{ devices: Device[]; connections: Connection[] }>
    ) => {
      pushHistory(state);
      state.devices = withDeviceTags(action.payload.devices);
      state.connections = withCableLabels(action.payload.devices, action.payload.connections);
      state.selectedDeviceId = null;
      state.selectedConnectionId = null;
      state.connectionInProgress = null;
    },

    undo: (state) => {
      const previous = state.past.pop();
      if (!previous) return;
      state.future.unshift({
        devices: JSON.parse(JSON.stringify(current(state).devices)),
        connections: JSON.parse(JSON.stringify(current(state).connections)),
      });
      state.devices = previous.devices;
      state.connections = previous.connections;
      state.selectedDeviceId = null;
      state.selectedConnectionId = null;
      state.connectionInProgress = null;
      state.simulation = null;
      state.lastHistoryKey = null;
    },

    redo: (state) => {
      const next = state.future.shift();
      if (!next) return;
      state.past.push({
        devices: JSON.parse(JSON.stringify(current(state).devices)),
        connections: JSON.parse(JSON.stringify(current(state).connections)),
      });
      state.devices = next.devices;
      state.connections = next.connections;
      state.selectedDeviceId = null;
      state.selectedConnectionId = null;
      state.connectionInProgress = null;
      state.simulation = null;
      state.lastHistoryKey = null;
    },

    setZoom: (state, action: PayloadAction<number>) => {
      state.zoom = Math.max(0.2, Math.min(3, action.payload));
    },

    setPan: (state, action: PayloadAction<{ x: number; y: number }>) => {
      state.pan = action.payload;
    },

    setViewportSize: (state, action: PayloadAction<{ width: number; height: number }>) => {
      state.viewport = action.payload;
    },

    resetView: (state) => {
      state.zoom = 1;
      state.pan = { x: 0, y: 0 };
    },

    requestFit: (state) => {
      state.fitRequest += 1;
    },

    toggleSnapToGrid: (state) => {
      state.snapToGrid = !state.snapToGrid;
    },

    toggleCableLabels: (state) => {
      state.showCableLabels = !state.showCableLabels;
    },

    setSimulation: (state, action: PayloadAction<SimulationResult>) => {
      state.simulation = action.payload;
      state.showSimulation = true;
    },

    setShowSimulation: (state, action: PayloadAction<boolean>) => {
      state.showSimulation = action.payload;
    },

    showToast: (
      state,
      action: PayloadAction<{ message: string; severity?: 'info' | 'success' | 'warning' | 'error' }>
    ) => {
      state.toast = { message: action.payload.message, severity: action.payload.severity || 'info' };
    },

    clearToast: (state) => {
      state.toast = null;
    },
  },
});

export const {
  addDevice,
  removeDevice,
  updateDevicePosition,
  beginDeviceDrag,
  moveDevice,
  nudgeDevice,
  setDevicePositions,
  updateDeviceProperty,
  setDeviceTag,
  selectDevice,
  deselectAll,
  selectConnection,
  startConnection,
  completeConnection,
  connect,
  cancelConnection,
  removeConnection,
  updateConnectionLength,
  clearCanvas,
  loadProject,
  undo,
  redo,
  setZoom,
  setPan,
  setViewportSize,
  resetView,
  requestFit,
  toggleSnapToGrid,
  toggleCableLabels,
  setSimulation,
  setShowSimulation,
  showToast,
  clearToast,
} = canvasSlice.actions;

export default canvasSlice.reducer;
