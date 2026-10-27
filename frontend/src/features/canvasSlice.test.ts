import { describe, it, expect } from 'vitest';
import reducer, {
  addDevice,
  removeDevice,
  startConnection,
  completeConnection,
  connect as connectPorts,
  nudgeDevice,
  beginDeviceDrag,
  moveDevice,
  updateDeviceProperty,
  setDeviceTag,
  setSimulation,
  undo,
  redo,
} from './canvasSlice';
import { Device, Port } from '../types/device.types';
import { possibleLinks } from './connectionRules';

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
    // Каждый новый кабель получает маркировку для схемы и кабельного журнала
    expect(state.connections.map((c) => c.label)).toEqual(['A-001', 'A-002']);
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

describe('R6: незавершённое соединение не переживает отмену и удаление', () => {
  it('отмена добавления источника посреди соединения — кабель не создаётся', () => {
    let state = withDevices('mix');
    state = reducer(state, addDevice(makeDevice('mic')));
    state = reducer(state, startConnection({ deviceId: 'mic', portId: 'p' }));
    state = reducer(state, undo());
    expect(state.connectionInProgress).toBeNull();
    state = reducer(state, completeConnection({ toDeviceId: 'mix', toPortId: 'in', cableType: 'xlr' }));
    expect(state.connections).toHaveLength(0);
  });

  it('удаление источника посреди соединения сбрасывает его', () => {
    let state = withDevices('mix', 'mic');
    state = reducer(state, startConnection({ deviceId: 'mic', portId: 'p' }));
    state = reducer(state, removeDevice('mic'));
    expect(state.connectionInProgress).toBeNull();
  });

  it('редьюсер не соединяет выход с выходом, несуществующий порт и несовместимые сигналы', () => {
    const video = (id: string): Device => ({
      ...makeDevice(id),
      ports: [{ id: 'hdmi_in', type: 'hdmi', direction: 'input', signal_type: 'hdmi' }],
    });
    let state = withDevices('a', 'b');
    state = reducer(state, addDevice(video('tv')));
    for (const [to, port] of [
      ['b', 'p'],
      ['b', 'nope'],
      ['tv', 'hdmi_in'],
      ['a', 'in'],
    ]) {
      state = reducer(state, startConnection({ deviceId: 'a', portId: 'p' }));
      state = reducer(state, completeConnection({ toDeviceId: to, toPortId: port, cableType: 'xlr' }));
    }
    expect(state.connections).toHaveLength(0);
  });
});

describe('R7: обозначения устройств постоянные', () => {
  it('удаление MIC-01 не перенумеровывает MIC-02, новый получает MIC-03', () => {
    let state = withDevices('m1', 'm2');
    expect(state.devices.map((d) => d.tag)).toEqual(['MIC-01', 'MIC-02']);
    state = reducer(state, removeDevice('m1'));
    expect(state.devices.map((d) => d.tag)).toEqual(['MIC-02']);
    state = reducer(state, addDevice(makeDevice('m3')));
    expect(state.devices.map((d) => d.tag)).toEqual(['MIC-02', 'MIC-03']);
    state = reducer(state, undo());
    state = reducer(state, undo());
    expect(state.devices.map((d) => d.tag)).toEqual(['MIC-01', 'MIC-02']);
  });

  it('обозначение можно изменить, но не на занятое', () => {
    let state = withDevices('m1', 'm2');
    state = reducer(state, setDeviceTag({ id: 'm1', tag: ' vox-1 ' }));
    expect(state.devices[0].tag).toBe('VOX-1');
    state = reducer(state, setDeviceTag({ id: 'm2', tag: 'VOX-1' }));
    expect(state.devices[1].tag).toBe('MIC-02');
  });

  it('кабель из панели свойств проходит те же проверки, что и на холсте', () => {
    let state = withDevices('a', 'b');
    const cable = { from: { device: 'a', port: 'p' }, to: { device: 'b', port: 'in' }, cableType: 'xlr' as const };
    state = reducer(state, connectPorts(cable));
    expect(state.connections).toHaveLength(1);
    expect(state.connections[0].label).toBe('A-001');
    // Вход занят — второй кабель не добавляется и история не растёт
    const pastBefore = state.past.length;
    state = reducer(state, connectPorts(cable));
    expect(state.connections).toHaveLength(1);
    expect(state.past).toHaveLength(pastBefore);
    // Не в ту сторону и несовместимые сигналы — тоже нет
    state = reducer(state, connectPorts({ ...cable, from: { device: 'b', port: 'in' }, to: { device: 'a', port: 'p' } }));
    state = reducer(state, connectPorts({ ...cable, to: { device: 'a', port: 'eth' } }));
    expect(state.connections).toHaveLength(1);
  });

  it('варианты подключения: только свободные совместимые порты, в обе стороны', () => {
    let state = withDevices('a', 'b', 'c');
    const fromOut = possibleLinks(state.devices, state.connections, { device: 'a', port: 'p' });
    expect(fromOut.map((l) => `${l.to.device}.${l.to.port}`)).toEqual(['b.in', 'c.in']);
    const intoIn = possibleLinks(state.devices, state.connections, { device: 'a', port: 'in' });
    expect(intoIn.map((l) => `${l.from.device}.${l.from.port}`)).toEqual(['b.p', 'c.p']);
    // Ethernet ↔ Ethernet: кабель возможен, направление — от выбранного порта
    const lan = possibleLinks(state.devices, state.connections, { device: 'a', port: 'eth' });
    expect(lan.map((l) => `${l.from.device}>${l.to.device}`)).toEqual(['a>b', 'a>c']);
    state = connect(state, 'b', 'p', 'c', 'in');
    const after = possibleLinks(state.devices, state.connections, { device: 'a', port: 'p' });
    expect(after.map((l) => `${l.to.device}.${l.to.port}`)).toEqual(['b.in']);
  });

  it('сдвиг стрелками: серия нажатий — один шаг отмены', () => {
    let state = withDevices('a');
    const pastBefore = state.past.length;
    state = reducer(state, nudgeDevice({ id: 'a', dx: 20, dy: 0 }));
    state = reducer(state, nudgeDevice({ id: 'a', dx: 20, dy: 0 }));
    state = reducer(state, nudgeDevice({ id: 'a', dx: 0, dy: 100 }));
    expect(state.devices[0].position).toEqual({ x: 40, y: 100 });
    expect(state.past).toHaveLength(pastBefore + 1);
    state = reducer(state, undo());
    expect(state.devices[0].position).toEqual({ x: 0, y: 0 });
  });
});
