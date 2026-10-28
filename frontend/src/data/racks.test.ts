import { describe, it, expect } from 'vitest';
import reducer, {
  addRack,
  loadProject,
  placeInRack,
  removeFromRack,
  removeRack,
  setDeviceRoom,
  undo,
  updateRack,
} from '../features/canvasSlice';
import { createDevice, findEquipment } from './equipment';
import { parseProjectDoc, serializeProject } from './projectSchema';
import { freePlace, placeProblem, rackUnits, usedUnits } from './racks';
import { Device, Rack } from '../types/device.types';

const device = (eq: string, id: string): Device => ({ ...createDevice(findEquipment(eq)!, id, { x: 0, y: 0 }), tag: id.toUpperCase() });
const RACK: Rack = { id: 'r1', name: 'Шкаф 1', units: 12 };

describe('шкафы 19″', () => {
  it('высота из каталога; немонтируемое оборудование в шкаф не ставится', () => {
    expect(rackUnits(device('crown-xls2502', 'amp'))).toBe(2);
    expect(rackUnits(device('cisco-sg350', 'sw'))).toBe(1);
    expect(rackUnits(device('shure-sm58', 'mic'))).toBeUndefined();
    expect(placeProblem([], RACK, device('shure-sm58', 'mic'), 1)).toContain('не монтируется');
  });

  it('место: в пределах шкафа и без наложений; свободное место — сверху', () => {
    const amp = { ...device('crown-xls2502', 'amp-01'), rack: { rack: 'r1', u: 11 } };
    const sw = device('cisco-sg350', 'sw-01');
    expect(placeProblem([amp], RACK, sw, 12)).toContain('заняты: там AMP-01');
    expect(placeProblem([amp], RACK, sw, 13)).toContain('не помещается');
    expect(placeProblem([amp], RACK, sw, 10)).toBeNull();
    expect(freePlace([amp], RACK, sw)).toBe(10);
    expect(freePlace([], RACK, amp)).toBe(11);
    expect(usedUnits([amp], RACK)).toBe(2);
  });

  it('файл проекта: шкафы сохраняются; недопустимые места снимаются с пояснением', () => {
    const devices = [
      { ...device('crown-xls2502', 'a1'), rack: { rack: 'r1', u: 1 } },
      { ...device('qsc-gx5', 'a2'), rack: { rack: 'r1', u: 2 } }, // наложение на a1
      { ...device('cisco-sg350', 's1'), rack: { rack: 'nope', u: 1 } }, // нет шкафа
      { ...device('shure-sm58', 'm1'), rack: { rack: 'r1', u: 5 } }, // не монтируется
      { ...device('cisco-sg350', 's2'), rack: { rack: 'r1', u: 12 } },
    ];
    const raw = serializeProject({ devices, connections: [], rooms: [], racks: [{ ...RACK, room: 'gone' }] });
    expect(raw.schemaVersion).toBe(4);
    const parsed = parseProjectDoc(JSON.parse(JSON.stringify(raw)));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.racks).toEqual([RACK]); // ссылка на несуществующее помещение снята
    expect(parsed.devices.map((d) => d.rack?.u ?? null)).toEqual([1, null, null, null, 12]);
    expect(parsed.notes.join()).toContain('недопустимым местом в шкафу: 3');

    const old = parseProjectDoc({ schemaVersion: 3, rooms: [], devices: [device('crown-xls2502', 'a1')], connections: [] });
    expect(old.ok && old.racks).toEqual([]);
    expect(parseProjectDoc({ ...raw, racks: [RACK, RACK] })).toMatchObject({ ok: false, error: expect.stringContaining('шкафа «r1»') });
  });

  it('редактор: поставить, переставить, вынуть, удалить шкаф; отмена одним шагом', () => {
    let s = reducer(
      undefined,
      loadProject({
        devices: [device('crown-xls2502', 'amp'), device('cisco-sg350', 'sw')],
        connections: [],
        rooms: [{ id: 'hall', name: 'Аппаратная', color: '#5B8DEF' }],
      })
    );
    s = reducer(s, addRack({ ...RACK, room: 'hall' }));
    s = reducer(s, placeInRack({ deviceId: 'amp', rack: 'r1' }));
    expect(s.devices[0].rack).toEqual({ rack: 'r1', u: 11 });
    expect(s.devices[0].room).toBe('hall'); // устройство — в помещении шкафа
    s = reducer(s, placeInRack({ deviceId: 'sw', rack: 'r1', u: 12 }));
    expect(s.devices[1].rack).toBeUndefined();
    expect(s.toast?.message).toContain('заняты');
    s = reducer(s, placeInRack({ deviceId: 'sw', rack: 'r1' }));
    expect(s.devices[1].rack).toEqual({ rack: 'r1', u: 10 });

    // Шкаф ниже занятых юнитов не сделать
    const shrunk = reducer(s, updateRack({ id: 'r1', units: 9 }));
    expect(shrunk.racks[0].units).toBe(12);
    expect(shrunk.toast?.message).toContain('занят юнит 12');

    s = reducer(s, removeFromRack('sw'));
    expect(s.devices[1].rack).toBeUndefined();
    s = reducer(s, undo());
    expect(s.devices[1].rack).toEqual({ rack: 'r1', u: 10 });

    // Устройство перенесли в другое помещение — оно вынимается из шкафа
    s = reducer(s, setDeviceRoom({ id: 'amp', room: null }));
    expect(s.devices[0].rack).toBeUndefined();

    s = reducer(s, removeRack('r1'));
    expect(s.racks).toEqual([]);
    expect(s.devices.every((d) => !d.rack)).toBe(true);
  });
});
