import { createSlice, PayloadAction, current } from '@reduxjs/toolkit';
import {
  Device,
  Connection,
  SimulationResult,
  CableType,
  PropValue,
  ProjectDoc,
  ProjectMeta,
  Rack,
  Room,
  RoomSize,
} from '../types/device.types';
import { connectionProblem, PortRef } from './connectionRules';
import { nextDeviceTag, withDeviceTags } from '../data/deviceTags';
import { connectionPrefix, nextCableLabel, withCableLabels } from '../data/cableLabels';
import { MAX_RACK_UNITS, freePlace, placeProblem, rackUnits } from '../data/racks';
import { clampPlace, validSize } from '../data/plan';

type CanvasDoc = ProjectDoc;

interface CanvasState {
  devices: Device[];
  connections: Connection[];
  rooms: Room[];
  /** Шкафы 19″. */
  racks: Rack[];
  /** Данные штампа чертежей. */
  meta: ProjectMeta;
  selectedDeviceId: string | null;
  selectedConnectionId: string | null;
  selectedRoomId: string | null;
  /** Показывать только устройства этого помещения (null — все). */
  roomFilter: string | null;
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
  rooms: [],
  racks: [],
  meta: {},
  selectedDeviceId: null,
  selectedConnectionId: null,
  selectedRoomId: null,
  roomFilter: null,
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
  state.past.push(snapshot(state));
  if (state.past.length > HISTORY_LIMIT) state.past.shift();
  state.future = [];
}

function snapshot(state: CanvasState): CanvasDoc {
  const { devices, connections, rooms, racks, meta } = current(state);
  return JSON.parse(JSON.stringify({ devices, connections, rooms, racks, meta }));
}

/** Вернуть документ из истории; выделение и фильтр по несуществующему помещению сбрасываются. */
function restore(state: CanvasState, doc: CanvasDoc) {
  state.devices = doc.devices;
  state.connections = doc.connections;
  state.rooms = doc.rooms ?? [];
  state.racks = doc.racks ?? [];
  state.meta = doc.meta ?? {};
  state.selectedDeviceId = null;
  state.selectedConnectionId = null;
  state.selectedRoomId = null;
  state.connectionInProgress = null;
  state.simulation = null;
  state.lastHistoryKey = null;
  if (state.roomFilter && !state.rooms.some((r) => r.id === state.roomFilter)) state.roomFilter = null;
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
      // При фильтре по помещению новое устройство попадает в это помещение — иначе оно сразу скрылось бы
      const room = action.payload.room ?? state.roomFilter ?? undefined;
      const device: Device = { ...action.payload, tag, ...(room ? { room } : {}) };
      // Место в шкафу и на плане не копируется: новое устройство расставляют отдельно
      delete device.rack;
      delete device.plan;
      state.devices.push(device);
      state.selectedDeviceId = action.payload.id;
      state.selectedConnectionId = null;
      state.selectedRoomId = null;
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

    /** Начало перетаскивания рамки помещения: один снимок в историю на всё перемещение. */
    beginRoomDrag: (state, action: PayloadAction<string>) => {
      pushHistory(state, { keepSimulation: true });
      state.selectedRoomId = action.payload;
      state.selectedDeviceId = null;
      state.selectedConnectionId = null;
    },

    /** Позиции нескольких устройств во время перетаскивания рамки — без записи в историю. */
    moveDevicesTo: (state, action: PayloadAction<Record<string, { x: number; y: number }>>) => {
      for (const d of state.devices) {
        const p = action.payload[d.id];
        if (p) d.position = p;
      }
    },

    addRoom: (state, action: PayloadAction<Room>) => {
      if (state.rooms.some((r) => r.id === action.payload.id)) return;
      pushHistory(state, { keepSimulation: true });
      state.rooms.push(action.payload);
    },

    updateRoom: (state, action: PayloadAction<{ id: string; name?: string; color?: string }>) => {
      const room = state.rooms.find((r) => r.id === action.payload.id);
      if (!room) return;
      const name = action.payload.name?.trim();
      if (action.payload.name !== undefined && (!name || name.length > 64)) return;
      pushHistory(state, { key: `room:${room.id}`, keepSimulation: true });
      if (name) room.name = name;
      if (action.payload.color) room.color = action.payload.color;
    },

    /** Удаление помещения: устройства остаются на схеме, но вне помещений. */
    removeRoom: (state, action: PayloadAction<string>) => {
      if (!state.rooms.some((r) => r.id === action.payload)) return;
      pushHistory(state, { keepSimulation: true });
      state.rooms = state.rooms.filter((r) => r.id !== action.payload);
      for (const d of state.devices) {
        if (d.room !== action.payload) continue;
        delete d.room;
        delete d.plan;
      }
      if (state.selectedRoomId === action.payload) state.selectedRoomId = null;
      if (state.roomFilter === action.payload) state.roomFilter = null;
    },

    /** Поля штампа чертежей; пустое значение удаляет поле. */
    setProjectMeta: (state, action: PayloadAction<Partial<ProjectMeta>>) => {
      pushHistory(state, { key: 'meta', keepSimulation: true });
      for (const [key, value] of Object.entries(action.payload) as Array<[keyof ProjectMeta, string | undefined]>) {
        const text = value?.trim();
        if (text) state.meta[key] = text.slice(0, 200);
        else delete state.meta[key];
      }
    },

    setDeviceRoom: (state, action: PayloadAction<{ id: string; room: string | null }>) => {
      const device = state.devices.find((d) => d.id === action.payload.id);
      const room = action.payload.room;
      if (!device || (room !== null && !state.rooms.some((r) => r.id === room))) return;
      if ((device.room ?? null) === room) return;
      pushHistory(state, { keepSimulation: true });
      if (room === null) delete device.room;
      else device.room = room;
      // План — у каждого помещения свой: в новом помещении устройство ещё не расставлено
      delete device.plan;
      // Шкаф стоит в другом помещении — устройство из него вынимается
      const rack = state.racks.find((r) => r.id === device.rack?.rack);
      if (rack?.room && rack.room !== room) {
        delete device.rack;
        state.toast = { message: `${device.tag ?? device.model} вынут из шкафа «${rack.name}»: шкаф в другом помещении`, severity: 'info' };
      }
    },

    /** Размеры помещения для плана; устройства на плане остаются внутри помещения. */
    setRoomSize: (state, action: PayloadAction<{ id: string; size: RoomSize | null }>) => {
      const room = state.rooms.find((r) => r.id === action.payload.id);
      const size = action.payload.size;
      if (!room || (size && !validSize(size))) return;
      pushHistory(state, { key: `room-size:${room.id}`, keepSimulation: true });
      if (!size) {
        delete room.size;
        for (const d of state.devices) if (d.room === room.id) delete d.plan;
        return;
      }
      room.size = { width: size.width, length: size.length };
      for (const d of state.devices) if (d.room === room.id && d.plan) d.plan = clampPlace(d.plan, size);
    },

    /** Поставить или передвинуть устройство на плане его помещения (стрелки — подряд один шаг отмены). */
    placeOnPlan: (state, action: PayloadAction<{ id: string; x: number; y: number; rotation?: number; historyKey?: string }>) => {
      const device = state.devices.find((d) => d.id === action.payload.id);
      const size = state.rooms.find((r) => r.id === device?.room)?.size;
      if (!device || !validSize(size)) return;
      const { x, y, rotation, historyKey } = action.payload;
      pushHistory(state, { keepSimulation: true, ...(historyKey ? { key: historyKey } : {}) });
      device.plan = clampPlace({ x, y, rotation: rotation ?? device.plan?.rotation }, size);
      state.selectedDeviceId = device.id;
      state.selectedConnectionId = null;
      state.selectedRoomId = null;
    },

    /** Начало перетаскивания на плане: один снимок в историю на всё перемещение. */
    beginPlanDrag: (state, action: PayloadAction<string>) => {
      pushHistory(state, { keepSimulation: true });
      state.selectedDeviceId = action.payload;
      state.selectedConnectionId = null;
      state.selectedRoomId = null;
    },

    /** Место на плане во время перетаскивания — без записи в историю. */
    movePlanTo: (state, action: PayloadAction<{ id: string; x: number; y: number }>) => {
      const device = state.devices.find((d) => d.id === action.payload.id);
      const size = state.rooms.find((r) => r.id === device?.room)?.size;
      if (!device || !validSize(size)) return;
      device.plan = clampPlace({ ...action.payload, rotation: device.plan?.rotation }, size);
    },

    removeFromPlan: (state, action: PayloadAction<string>) => {
      const device = state.devices.find((d) => d.id === action.payload);
      if (!device?.plan) return;
      pushHistory(state, { keepSimulation: true });
      delete device.plan;
    },

    /** Длины нескольких кабелей сразу (по плану) — один шаг отмены. */
    setConnectionLengths: (state, action: PayloadAction<Record<string, number>>) => {
      const changes = state.connections.filter((c) => {
        const v = action.payload[c.id];
        return v !== undefined && Number.isFinite(v) && v >= 0 && v !== c.cable_length;
      });
      if (changes.length === 0) return;
      pushHistory(state);
      for (const c of changes) c.cable_length = action.payload[c.id];
    },

    addRack: (state, action: PayloadAction<Rack>) => {
      const rack = action.payload;
      const name = rack.name.trim();
      if (!name || name.length > 64 || state.racks.some((r) => r.id === rack.id)) return;
      if (!Number.isInteger(rack.units) || rack.units < 1 || rack.units > MAX_RACK_UNITS) return;
      if (rack.room && !state.rooms.some((r) => r.id === rack.room)) return;
      pushHistory(state, { keepSimulation: true });
      state.racks.push({ ...rack, name });
    },

    updateRack: (state, action: PayloadAction<{ id: string; name?: string; units?: number; room?: string | null }>) => {
      const rack = state.racks.find((r) => r.id === action.payload.id);
      if (!rack) return;
      const { name, units, room } = action.payload;
      if (name !== undefined && (!name.trim() || name.trim().length > 64)) return;
      if (units !== undefined) {
        if (!Number.isInteger(units) || units < 1 || units > MAX_RACK_UNITS) return;
        const top = Math.max(0, ...state.devices.filter((d) => d.rack?.rack === rack.id).map((d) => d.rack!.u + (rackUnits(d) ?? 1) - 1));
        if (units < top) {
          state.toast = { message: `В шкафу «${rack.name}» занят юнит ${top} — сначала освободите верхние юниты`, severity: 'warning' };
          return;
        }
      }
      if (room && !state.rooms.some((r) => r.id === room)) return;
      pushHistory(state, { key: `rack:${rack.id}`, keepSimulation: true });
      if (name !== undefined) rack.name = name.trim();
      if (units !== undefined) rack.units = units;
      if (room === null) delete rack.room;
      else if (room) {
        rack.room = room;
        // Оборудование шкафа переезжает вместе с ним
        for (const d of state.devices) if (d.rack?.rack === rack.id) d.room = room;
      }
    },

    /** Удаление шкафа: устройства остаются на схеме, но вне шкафов. */
    removeRack: (state, action: PayloadAction<string>) => {
      if (!state.racks.some((r) => r.id === action.payload)) return;
      pushHistory(state, { keepSimulation: true });
      state.racks = state.racks.filter((r) => r.id !== action.payload);
      for (const d of state.devices) if (d.rack?.rack === action.payload) delete d.rack;
    },

    /** Поставить устройство в шкаф: на юнит u или в самое верхнее свободное место. */
    placeInRack: (state, action: PayloadAction<{ deviceId: string; rack: string; u?: number }>) => {
      const device = state.devices.find((d) => d.id === action.payload.deviceId);
      const rack = state.racks.find((r) => r.id === action.payload.rack);
      if (!device || !rack) return;
      const u = action.payload.u ?? freePlace(state.devices, rack, device);
      const problem = u === null ? `в шкафу «${rack.name}» нет места под ${device.tag ?? device.model}` : placeProblem(state.devices, rack, device, u);
      if (problem || u === null) {
        state.toast = { message: problem ?? '', severity: 'warning' };
        return;
      }
      if (device.rack?.rack === rack.id && device.rack.u === u) return;
      pushHistory(state, { keepSimulation: true });
      device.rack = { rack: rack.id, u };
      if (rack.room) device.room = rack.room;
      state.selectedDeviceId = device.id;
      state.selectedConnectionId = null;
      state.selectedRoomId = null;
    },

    removeFromRack: (state, action: PayloadAction<string>) => {
      const device = state.devices.find((d) => d.id === action.payload);
      if (!device?.rack) return;
      pushHistory(state, { keepSimulation: true });
      delete device.rack;
    },

    selectRoom: (state, action: PayloadAction<string>) => {
      state.selectedRoomId = action.payload;
      state.selectedDeviceId = null;
      state.selectedConnectionId = null;
      state.lastHistoryKey = null;
    },

    setRoomFilter: (state, action: PayloadAction<string | null>) => {
      const id = action.payload;
      state.roomFilter = id && state.rooms.some((r) => r.id === id) ? id : null;
      // Выделенное устройство из другого помещения скрылось — снимаем выделение
      const selected = state.devices.find((d) => d.id === state.selectedDeviceId);
      if (state.roomFilter && selected && selected.room !== state.roomFilter) state.selectedDeviceId = null;
      state.connectionInProgress = null;
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
      // Устройство из другого помещения скрыто фильтром — показываем всю схему
      const device = state.devices.find((d) => d.id === action.payload);
      if (state.roomFilter && device && device.room !== state.roomFilter) state.roomFilter = null;
      state.selectedDeviceId = action.payload;
      state.selectedConnectionId = null;
      state.selectedRoomId = null;
      state.lastHistoryKey = null;
    },

    deselectAll: (state) => {
      state.selectedDeviceId = null;
      state.selectedConnectionId = null;
      state.selectedRoomId = null;
      state.connectionInProgress = null;
      state.lastHistoryKey = null;
    },

    selectConnection: (state, action: PayloadAction<string>) => {
      state.selectedConnectionId = action.payload;
      state.selectedDeviceId = null;
      state.selectedRoomId = null;
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
      state.rooms = [];
      state.racks = [];
      state.meta = {};
      state.selectedDeviceId = null;
      state.selectedConnectionId = null;
      state.selectedRoomId = null;
      state.roomFilter = null;
      state.connectionInProgress = null;
    },

    loadProject: (
      state,
      action: PayloadAction<{ devices: Device[]; connections: Connection[]; rooms?: Room[]; racks?: Rack[]; meta?: ProjectMeta }>
    ) => {
      pushHistory(state);
      state.devices = withDeviceTags(action.payload.devices);
      state.connections = withCableLabels(action.payload.devices, action.payload.connections);
      state.rooms = action.payload.rooms ?? [];
      state.racks = action.payload.racks ?? [];
      state.meta = action.payload.meta ?? {};
      state.selectedDeviceId = null;
      state.selectedConnectionId = null;
      state.selectedRoomId = null;
      state.roomFilter = null;
      state.connectionInProgress = null;
    },

    undo: (state) => {
      const previous = state.past.pop();
      if (!previous) return;
      state.future.unshift(snapshot(state));
      restore(state, previous);
    },

    redo: (state) => {
      const next = state.future.shift();
      if (!next) return;
      state.past.push(snapshot(state));
      restore(state, next);
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
  beginRoomDrag,
  moveDevicesTo,
  addRoom,
  updateRoom,
  removeRoom,
  setDeviceRoom,
  setRoomSize,
  placeOnPlan,
  beginPlanDrag,
  movePlanTo,
  removeFromPlan,
  setConnectionLengths,
  addRack,
  updateRack,
  removeRack,
  placeInRack,
  removeFromRack,
  setProjectMeta,
  selectRoom,
  setRoomFilter,
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
