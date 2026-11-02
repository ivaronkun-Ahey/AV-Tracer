import { describe, it, expect } from 'vitest';
import reducer, {
  addRoom,
  beginPlanDrag,
  loadProject,
  movePlanTo,
  placeOnPlan,
  removeRoom,
  setConnectionLengths,
  setDeviceRoom,
  setRoomSize,
  undo,
} from '../features/canvasSlice';
import { createDevice, findEquipment } from './equipment';
import { parseProjectDoc, serializeProject } from './projectSchema';
import { cableLengthsFromPlan, clampPlace, planCableLength } from './plan';
import { Connection, Device } from '../types/device.types';

const device = (eq: string, id: string, extra: Partial<Device> = {}): Device => ({
  ...createDevice(findEquipment(eq)!, id, { x: 0, y: 0 }),
  ...extra,
});
const cable = (id: string, from: [string, string], to: [string, string]): Connection => ({
  id,
  from: { device: from[0], port: from[1] },
  to: { device: to[0], port: to[1] },
  cable_type: 'xlr',
  cable_length: 10,
});
const HALL = { id: 'hall', name: 'Зал', color: '#5B8DEF', size: { width: 12, length: 20 } };

describe('план помещения', () => {
  it('место — в пределах помещения, направление — 0…359°; длина кабеля — по проекциям с запасом 2 м', () => {
    expect(clampPlace({ x: -3, y: 25.123, rotation: -90 }, HALL.size)).toEqual({ x: 0, y: 20, rotation: 270 });
    expect(planCableLength({ x: 1, y: 1 }, { x: 4.2, y: 9 })).toBe(14); // 3,2 + 8 + 2 = 13,2 → 14
  });

  it('длины по плану — только для кабелей внутри одного помещения, оба конца на плане', () => {
    const devices = [
      device('shure-sm58', 'mic', { room: 'hall', plan: { x: 6, y: 2 } }),
      device('yamaha-mg12xu', 'mix', { room: 'hall', plan: { x: 6, y: 18 } }),
      device('jbl-prx815w', 'spk', { room: 'other', plan: { x: 1, y: 1 } }),
      device('jbl-prx815w', 'spk2', { room: 'hall' }),
    ];
    const connections = [
      cable('a', ['mic', 'xlr_out'], ['mix', 'xlr_in_1']),
      cable('b', ['mix', 'xlr_out_l'], ['spk', 'xlr_in']),
      cable('c', ['mix', 'xlr_out_r'], ['spk2', 'xlr_in']),
    ];
    expect(cableLengthsFromPlan(devices, connections)).toEqual({ a: 18 });
  });

  it('файл проекта: размеры и места сохраняются; место без помещения с размерами снимается, за стеной — у стены', () => {
    const devices = [
      device('shure-sm58', 'mic', { room: 'hall', plan: { x: 3, y: 30, rotation: 90 } }),
      device('shure-sm58', 'mic2', { plan: { x: 1, y: 1 } }),
    ];
    const parsed = parseProjectDoc(JSON.parse(JSON.stringify(serializeProject({ devices, connections: [], rooms: [HALL] }))));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.rooms[0].size).toEqual(HALL.size);
    expect(parsed.devices[0].plan).toEqual({ x: 3, y: 20, rotation: 90 });
    expect(parsed.devices[1].plan).toBeUndefined();
    expect(parsed.notes.join()).toContain('на плане без помещения с размерами: 1');
  });

  it('редактор: поставить, перетащить одним шагом отмены, уменьшить помещение, сменить помещение, длины кабелей', () => {
    let s = reducer(
      undefined,
      loadProject({ devices: [device('shure-sm58', 'mic', { room: 'hall' })], connections: [], rooms: [{ ...HALL, size: undefined }] })
    );
    // Без размеров помещения на план не поставить
    s = reducer(s, placeOnPlan({ id: 'mic', x: 1, y: 1 }));
    expect(s.devices[0].plan).toBeUndefined();
    s = reducer(s, setRoomSize({ id: 'hall', size: { width: 12, length: 20 } }));
    s = reducer(s, placeOnPlan({ id: 'mic', x: 6, y: 10 }));
    expect(s.devices[0].plan).toEqual({ x: 6, y: 10 });

    s = reducer(s, beginPlanDrag('mic'));
    s = reducer(s, movePlanTo({ id: 'mic', x: 7, y: 11 }));
    s = reducer(s, movePlanTo({ id: 'mic', x: 8, y: 12 }));
    expect(s.devices[0].plan).toEqual({ x: 8, y: 12 });
    s = reducer(s, undo());
    expect(s.devices[0].plan).toEqual({ x: 6, y: 10 });

    s = reducer(s, setRoomSize({ id: 'hall', size: { width: 4, length: 5 } }));
    expect(s.devices[0].plan).toEqual({ x: 4, y: 5 });
    expect(reducer(s, setRoomSize({ id: 'hall', size: { width: 0, length: 5 } })).rooms[0].size).toEqual({ width: 4, length: 5 });

    s = reducer(s, addRoom({ id: 'r2', name: 'Аппаратная', color: '#E0A030' }));
    expect(reducer(s, setDeviceRoom({ id: 'mic', room: 'r2' })).devices[0].plan).toBeUndefined();
    expect(reducer(s, removeRoom('hall')).devices[0].plan).toBeUndefined();

    const withCable = reducer(
      s,
      loadProject({ devices: s.devices, connections: [cable('a', ['mic', 'xlr_out'], ['mic', 'xlr_out'])], rooms: s.rooms })
    );
    const updated = reducer(withCable, setConnectionLengths({ a: 7 }));
    expect(updated.connections[0].cable_length).toBe(7);
    expect(reducer(updated, undo()).connections[0].cable_length).toBe(10);
  });
});
