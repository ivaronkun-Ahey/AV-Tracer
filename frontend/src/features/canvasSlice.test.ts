import { describe, it, expect } from 'vitest';
import reducer, {
  addDevice,
  removeDevice,
  startConnection,
  completeConnection,
  beginDeviceDrag,
  moveDevice,
  updateDeviceProperty,
  setSimulation,
  undo,
  redo,
} from './canvasSlice';
import { Device, Port } from '../types/device.types';

const OUT: Port = { id: 'p', type: 'xlr', direction: 'output', signal_type: 'analog_audio' };
const IN: Port = { id: 'in', type: 'xlr', direction: 'input', signal_type: 'analog_audio' };
const LAN: Port = { id: 'eth', type: 'cat6', direction: 'bidirectional', signal_type: 'network' };

function makeDevice(id: string, ports: Port[] = [OUT, IN, LAN]): Device {
  return {
    id,
    type: 'microphone',
    manufacturer: 'Test',
    model: id,
    full_name: id,
    category: 'audio',
    position: { x: 0, y: 0 },
    ports,
    properties: { gain: 0 },
  };
}

function withDevices(...ids: string[]) {
  return ids.reduce((s, id) => reducer(s, addDevice(makeDevice(id))), reducer(undefined, { type: 'init' }));
}

function connect(state: ReturnType<typeof reducer>, from: string, fromPort: string, to: string, toPort: string) {
  state = reducer(state, startConnection({ deviceId: from, portId: fromPort }));
  return reducer(state, completeConnection({ toDeviceId: to, toPortId: toPort, cableType: 'xlr' }));
}

describe('canvasSlice', () => {
  it('добавляет устройство и пишет историю', () => {
    const state = reducer(undefined, addDevice(makeDevice('a')));
    expect(state.devices).toHaveLength(1);
    expect(state.past).toHaveLength(1);
    expect(state.selectedDeviceId).toBe('a');
  });

  it('undo/redo возвращает и повторяет изменения', () => {
    let state = reducer(undefined, addDevice(makeDevice('a')));
    state = reducer(state, addDevice(makeDevice('b')));
    expect(state.devices).toHaveLength(2);

    state = reducer(state, undo());
    expect(state.devices).toHaveLength(1);
    expect(state.future).toHaveLength(1);

    state = reducer(state, redo());
    expect(state.devices).toHaveLength(2);
  });

  it('удаление устройства убирает связанные соединения', () => {
    let state = reducer(undefined, addDevice(makeDevice('a')));
    state = reducer(state, addDevice(makeDevice('b')));
    state = connect(state, 'a', 'p', 'b', 'in');
    expect(state.connections).toHaveLength(1);

    state = reducer(state, removeDevice('a'));
    expect(state.devices).toHaveLength(1);
    expect(state.connections).toHaveLength(0);
  });

  it('второй кабель в занятый вход не подключается', () => {
    let state = withDevices('a', 'b', 'mix');
    state = connect(state, 'a', 'p', 'mix', 'in');
    state = connect(state, 'b', 'p', 'mix', 'in');
    state = connect(state, 'a', 'p', 'mix', 'in');
    expect(state.connections).toHaveLength(1);
    expect(state.connectionInProgress).toBeNull();
  });

  it('с одного выхода можно вести несколько кабелей (параллельные АС)', () => {
    let state = withDevices('amp', 's1', 's2');
    state = connect(state, 'amp', 'p', 's1', 'in');
    state = connect(state, 'amp', 'p', 's2', 'in');
    expect(state.connections).toHaveLength(2);
  });

  it('Ethernet-порт, занятый как вход, нельзя использовать как выход', () => {
    let state = withDevices('sw', 'ap', 'panel');
    state = connect(state, 'ap', 'eth', 'sw', 'eth');
    state = connect(state, 'sw', 'eth', 'panel', 'eth');
    expect(state.connections).toHaveLength(1);
  });

  it('перетаскивание: позиция обновляется сразу, в истории один шаг, симуляция сохраняется', () => {
    let state = withDevices('a');
    state = reducer(state, setSimulation({ valid: true, signal_flows: [], warnings: [], errors: [] }));
    const historyBefore = state.past.length;
    state = reducer(state, beginDeviceDrag('a'));
    for (let x = 1; x <= 5; x++) state = reducer(state, moveDevice({ id: 'a', position: { x: x * 10, y: 0 } }));
    expect(state.devices[0].position).toEqual({ x: 50, y: 0 });
    expect(state.past.length).toBe(historyBefore + 1);
    expect(state.simulation).not.toBeNull();
    state = reducer(state, undo());
    expect(state.devices[0].position).toEqual({ x: 0, y: 0 });
  });

  it('ввод числа по символам — один шаг отмены', () => {
    let state = withDevices('a');
    const historyBefore = state.past.length;
    for (const v of [-1, -12, -120]) {
      state = reducer(state, updateDeviceProperty({ id: 'a', property: 'gain', value: v }));
    }
    expect(state.past.length).toBe(historyBefore + 1);
    state = reducer(state, undo());
    expect(state.devices[0].properties.gain).toBe(0);
  });
});
