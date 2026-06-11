import { describe, it, expect } from 'vitest';
import reducer, {
  addDevice,
  removeDevice,
  startConnection,
  completeConnection,
  undo,
  redo,
} from './canvasSlice';
import { Device } from '../types/device.types';

function makeDevice(id: string): Device {
  return {
    id,
    type: 'microphone',
    manufacturer: 'Test',
    model: id,
    full_name: id,
    category: 'audio',
    position: { x: 0, y: 0 },
    ports: [{ id: 'p', type: 'xlr', direction: 'output', signal_type: 'analog_audio' }],
    properties: {},
  };
}

describe('canvasSlice', () => {
  it('добавляет устройство и пишет историю', () => {
    let state = reducer(undefined, addDevice(makeDevice('a')));
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
    state = reducer(state, startConnection({ deviceId: 'a', portId: 'p' }));
    state = reducer(state, completeConnection({ toDeviceId: 'b', toPortId: 'p', cableType: 'xlr' }));
    expect(state.connections).toHaveLength(1);

    state = reducer(state, removeDevice('a'));
    expect(state.devices).toHaveLength(1);
    expect(state.connections).toHaveLength(0);
  });
});
