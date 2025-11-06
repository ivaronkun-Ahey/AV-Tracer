import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Device, Connection } from '../../types/device.types';

interface CanvasState {
  devices: Device[];
  connections: Connection[];
  selectedDeviceId: string | null;
  connectionInProgress: {
    fromDeviceId: string;
    fromPortId: string;
  } | null;
  zoom: number;
  pan: { x: number; y: number };
}

const initialState: CanvasState = {
  devices: [],
  connections: [],
  selectedDeviceId: null,
  connectionInProgress: null,
  zoom: 1,
  pan: { x: 0, y: 0 },
};

const canvasSlice = createSlice({
  name: 'canvas',
  initialState,
  reducers: {
    addDevice: (state, action: PayloadAction<Device>) => {
      state.devices.push(action.payload);
    },

    removeDevice: (state, action: PayloadAction<string>) => {
      state.devices = state.devices.filter(d => d.id !== action.payload);
      // Remove connections involving this device
      state.connections = state.connections.filter(
        c => c.from.device !== action.payload && c.to.device !== action.payload
      );
      if (state.selectedDeviceId === action.payload) {
        state.selectedDeviceId = null;
      }
    },

    updateDevicePosition: (state, action: PayloadAction<{
      id: string;
      position: { x: number; y: number };
    }>) => {
      const device = state.devices.find(d => d.id === action.payload.id);
      if (device) {
        device.position = action.payload.position;
      }
    },

    updateDeviceProperty: (state, action: PayloadAction<{
      id: string;
      property: string;
      value: any;
    }>) => {
      const device = state.devices.find(d => d.id === action.payload.id);
      if (device) {
        device.properties[action.payload.property] = action.payload.value;
      }
    },

    selectDevice: (state, action: PayloadAction<string>) => {
      state.selectedDeviceId = action.payload;
    },

    deselectDevice: (state) => {
      state.selectedDeviceId = null;
    },

    startConnection: (state, action: PayloadAction<{
      deviceId: string;
      portId: string;
    }>) => {
      state.connectionInProgress = {
        fromDeviceId: action.payload.deviceId,
        fromPortId: action.payload.portId,
      };
    },

    completeConnection: (state, action: PayloadAction<{
      toDeviceId: string;
      toPortId: string;
      cableType: string;
    }>) => {
      if (state.connectionInProgress) {
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
      state.connections = state.connections.filter(c => c.id !== action.payload);
    },

    clearCanvas: (state) => {
      state.devices = [];
      state.connections = [];
      state.selectedDeviceId = null;
      state.connectionInProgress = null;
    },

    loadProject: (state, action: PayloadAction<{
      devices: Device[];
      connections: Connection[];
    }>) => {
      state.devices = action.payload.devices;
      state.connections = action.payload.connections;
      state.selectedDeviceId = null;
      state.connectionInProgress = null;
    },

    setZoom: (state, action: PayloadAction<number>) => {
      state.zoom = Math.max(0.1, Math.min(3, action.payload));
    },

    setPan: (state, action: PayloadAction<{ x: number; y: number }>) => {
      state.pan = action.payload;
    },
  },
});

export const {
  addDevice,
  removeDevice,
  updateDevicePosition,
  updateDeviceProperty,
  selectDevice,
  deselectDevice,
  startConnection,
  completeConnection,
  cancelConnection,
  removeConnection,
  clearCanvas,
  loadProject,
  setZoom,
  setPan,
} = canvasSlice.actions;

export default canvasSlice.reducer;
