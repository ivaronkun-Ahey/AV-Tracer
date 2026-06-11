import { createSlice, PayloadAction, current } from '@reduxjs/toolkit';
import { Device, Connection, SimulationResult } from '../types/device.types';

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
  // История для undo/redo
  past: CanvasDoc[];
  future: CanvasDoc[];
  // Результаты симуляции
  simulation: SimulationResult | null;
  showSimulation: boolean;
  // Всплывающее уведомление
  toast: { message: string; severity: 'info' | 'success' | 'warning' | 'error' } | null;
}

const HISTORY_LIMIT = 50;

const initialState: CanvasState = {
  devices: [],
  connections: [],
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

/** Снимок текущего документа кладётся в историю перед структурным изменением. */
function pushHistory(state: CanvasState) {
  state.past.push({
    devices: JSON.parse(JSON.stringify(current(state).devices)),
    connections: JSON.parse(JSON.stringify(current(state).connections)),
  });
  if (state.past.length > HISTORY_LIMIT) state.past.shift();
  state.future = [];
  // Любое изменение делает прежний результат симуляции неактуальным
  state.simulation = null;
}

const canvasSlice = createSlice({
  name: 'canvas',
  initialState,
  reducers: {
    addDevice: (state, action: PayloadAction<Device>) => {
      pushHistory(state);
      state.devices.push(action.payload);
      state.selectedDeviceId = action.payload.id;
      state.selectedConnectionId = null;
    },

    removeDevice: (state, action: PayloadAction<string>) => {
      pushHistory(state);
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
      pushHistory(state);
      const device = state.devices.find((d) => d.id === action.payload.id);
      if (device) {
        device.position = action.payload.position;
      }
    },

    updateDeviceProperty: (
      state,
      action: PayloadAction<{ id: string; property: string; value: any }>
    ) => {
      pushHistory(state);
      const device = state.devices.find((d) => d.id === action.payload.id);
      if (device) {
        device.properties[action.payload.property] = action.payload.value;
      }
    },

    selectDevice: (state, action: PayloadAction<string>) => {
      state.selectedDeviceId = action.payload;
      state.selectedConnectionId = null;
    },

    deselectAll: (state) => {
      state.selectedDeviceId = null;
      state.selectedConnectionId = null;
      state.connectionInProgress = null;
    },

    selectConnection: (state, action: PayloadAction<string>) => {
      state.selectedConnectionId = action.payload;
      state.selectedDeviceId = null;
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
      action: PayloadAction<{ toDeviceId: string; toPortId: string; cableType: string }>
    ) => {
      if (state.connectionInProgress) {
        pushHistory(state);
        const newConnection: Connection = {
          id: `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          from: {
            device: state.connectionInProgress.fromDeviceId,
            port: state.connectionInProgress.fromPortId,
          },
          to: {
            device: action.payload.toDeviceId,
            port: action.payload.toPortId,
          },
          cable_type: action.payload.cableType as any,
          cable_length: 10,
        };
        state.connections.push(newConnection);
        state.connectionInProgress = null;
      }
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
      state.devices = action.payload.devices;
      state.connections = action.payload.connections;
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
      state.simulation = null;
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
      state.simulation = null;
    },

    setZoom: (state, action: PayloadAction<number>) => {
      state.zoom = Math.max(0.2, Math.min(3, action.payload));
    },

    setPan: (state, action: PayloadAction<{ x: number; y: number }>) => {
      state.pan = action.payload;
    },

    resetView: (state) => {
      state.zoom = 1;
      state.pan = { x: 0, y: 0 };
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
  updateDeviceProperty,
  selectDevice,
  deselectAll,
  selectConnection,
  startConnection,
  completeConnection,
  cancelConnection,
  removeConnection,
  clearCanvas,
  loadProject,
  undo,
  redo,
  setZoom,
  setPan,
  resetView,
  setSimulation,
  setShowSimulation,
  showToast,
  clearToast,
} = canvasSlice.actions;

export default canvasSlice.reducer;
