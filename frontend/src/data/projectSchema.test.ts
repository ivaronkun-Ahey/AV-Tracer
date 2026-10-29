import { describe, it, expect } from 'vitest';
import { identityError, parseProjectDoc, serializeProject } from './projectSchema';
import { SCHEMA_VERSION } from './migrations';
import { createDevice, findEquipment } from './equipment';
import { runSimulation } from '../sim/engine';
import { Connection } from '../types/device.types';

const mixer = () => createDevice(findEquipment('allen-heath-sq5')!, 'mix', { x: 0, y: 0 });
const mic = () => createDevice(findEquipment('shure-sm58')!, 'mic', { x: 0, y: 0 });

describe('parseProjectDoc', () => {
  it('принимает корректный проект', () => {
    const r = parseProjectDoc({ devices: [mic(), mixer()], connections: [] });
    expect(r.ok).toBe(true);
  });

  it('отклоняет устройство без портов с понятной ошибкой', () => {
    const broken = { ...mic(), ports: undefined };
    const r = parseProjectDoc({ devices: [broken], connections: [] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('devices.0.ports');
  });

  it('отбрасывает соединения с несуществующими портами', () => {
    const r = parseProjectDoc({
      devices: [mic(), mixer()],
      connections: [
        { id: 'ok', from: { device: 'mic', port: 'xlr_out' }, to: { device: 'mix', port: 'xlr_in_1' }, cable_type: 'xlr', cable_length: 5 },
        { id: 'bad', from: { device: 'mic', port: 'xlr_out' }, to: { device: 'ghost', port: 'x' }, cable_type: 'xlr', cable_length: 5 },
      ],
    });
    expect(r.ok && r.connections.map((c) => c.id)).toEqual(['ok']);
    expect(r.ok && r.droppedConnections).toBe(1);
  });

  it('дополняет старый проект новыми параметрами из каталога', () => {
    const old = mixer();
    delete old.properties.input_gain;
    const r = parseProjectDoc({ devices: [old], connections: [] });
    expect(r.ok && r.devices[0].properties.input_gain).toBe(45);
  });
});

describe('R5: целостность файла проекта', () => {
  const doc = () => ({ devices: [mic(), mixer()], connections: [] as unknown[] });

  it('повторяющиеся идентификаторы устройств отклоняются', () => {
    const d = doc();
    d.devices[1].id = d.devices[0].id;
    const r = parseProjectDoc(d);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('повторяется идентификатор устройства');
  });

  it('повторяющиеся идентификаторы соединений отклоняются', () => {
    const c = { id: 'same', from: { device: 'mic', port: 'xlr_out' }, to: { device: 'mix', port: 'xlr_in_1' }, cable_type: 'xlr', cable_length: 1 };
    const r = parseProjectDoc({ ...doc(), connections: [c, { ...c, to: { device: 'mix', port: 'xlr_in_2' } }] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('соединения');
  });

  it('повторяющиеся порты внутри устройства и обозначения отклоняются', () => {
    const d = doc();
    d.devices[1].ports.push({ ...d.devices[1].ports[0] });
    expect(parseProjectDoc(d).ok).toBe(false);
    const t = doc();
    t.devices[0].tag = 'X-01';
    t.devices[1].tag = 'X-01';
    expect(parseProjectDoc(t).ok).toBe(false);
  });

  it('файл более новой версии формата не открывается', () => {
    const r = parseProjectDoc({ ...doc(), schemaVersion: 99 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('более новой версией');
  });

  it('слишком большой проект отклоняется', () => {
    const many = Array.from({ length: 2001 }, (_, i) => ({ ...mic(), id: `m${i}` }));
    expect(parseProjectDoc({ devices: many, connections: [] }).ok).toBe(false);
  });

  it('при сохранении указывается версия формата', () => {
    expect(serializeProject({ devices: [], connections: [], rooms: [] })).toEqual({
      schemaVersion: SCHEMA_VERSION,
      rooms: [],
      racks: [],
      devices: [],
      connections: [],
    });
  });
});

describe('миграция старых проектов (версия 1 → 2)', () => {
  it('убирает «фантом» у микрофона и сообщает об этом', () => {
    const old = { ...mic(), properties: { phantom_power: true, sensitivity: -54.5 } };
    const r = parseProjectDoc({ devices: [old, mixer()], connections: [] });
    expect(r.ok && r.devices[0].properties).not.toHaveProperty('phantom_power');
    expect(r.ok && r.devices[1].properties.phantom_power).toBe(true);
    expect(r.ok && r.notes.join()).toContain('фантомное питание');
  });

  it('пассивную YX15P из старого каталога заменяет на EVF-1122S, сохраняя кабель', () => {
    const amp = createDevice(findEquipment('crown-xls2502')!, 'amp', { x: 0, y: 0 });
    const legacy = {
      ...createDevice(findEquipment('ev-evf1122')!, 'spk', { x: 0, y: 0 }),
      manufacturer: 'Yorkville',
      model: 'YX15P',
      properties: { impedance_ohms: 8, active: false, power_handling_watts: 400 },
    };
    const cable = { id: 'c', from: { device: 'amp', port: 'speakon_out_l' }, to: { device: 'spk', port: 'speakon_in' }, cable_type: 'speakon', cable_length: 5 };
    const r = parseProjectDoc({ devices: [amp, legacy], connections: [cable] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.devices[1].model).toBe('EVF-1122S');
    expect(r.connections).toHaveLength(1);
    expect(r.notes.join()).toContain('YX15P');
  });

  it('файл текущей версии не мигрирует', () => {
    const r = parseProjectDoc({ schemaVersion: SCHEMA_VERSION, devices: [mic(), mixer()], connections: [] });
    expect(r.ok && r.notes).toEqual([]);
  });

  it('устройствам без обозначения выдаются обозначения', () => {
    const r = parseProjectDoc({ devices: [mic(), mixer()], connections: [] });
    expect(r.ok && r.devices.map((d) => d.tag)).toEqual(['MIC-01', 'MIX-01']);
  });
});

describe('помещения в файле проекта (формат 3)', () => {
  const room = { id: 'r1', name: 'Аппаратная', color: '#5B8DEF' };

  it('сохраняются и открываются обратно вместе с принадлежностью устройств', () => {
    const m = { ...mixer(), room: 'r1' };
    const saved = JSON.parse(JSON.stringify(serializeProject({ devices: [mic(), m], connections: [], rooms: [room] })));
    const r = parseProjectDoc(saved);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.rooms).toEqual([room]);
    expect(r.devices.find((d) => d.id === 'mix')?.room).toBe('r1');
    expect(r.devices.find((d) => d.id === 'mic')?.room).toBeUndefined();
  });

  it('файл версии 2 без помещений открывается с пустым списком помещений', () => {
    const r = parseProjectDoc({ schemaVersion: 2, devices: [mic()], connections: [] });
    expect(r.ok && r.rooms).toEqual([]);
  });

  it('повторяющиеся идентификаторы помещений отклоняются', () => {
    const r = parseProjectDoc({ devices: [], connections: [], rooms: [room, { ...room, name: 'Зал' }] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('помещения');
  });

  it('ссылка на несуществующее помещение снимается с сообщением', () => {
    const r = parseProjectDoc({ devices: [{ ...mixer(), room: 'ghost' }], connections: [], rooms: [room] });
    expect(r.ok && r.devices[0].room).toBeUndefined();
    expect(r.ok && r.notes.join(' ')).toContain('несуществующее помещение');
  });

  it('пустое название и неверный цвет помещения отклоняются', () => {
    expect(parseProjectDoc({ devices: [], connections: [], rooms: [{ ...room, name: '' }] }).ok).toBe(false);
    expect(parseProjectDoc({ devices: [], connections: [], rooms: [{ ...room, color: 'red' }] }).ok).toBe(false);
  });
});

/** Обзор 28.10, N3: идентификатор из файла не ломает словари и проверку уникальности. */
describe('N3: пустые и служебные идентификаторы', () => {
  const cam = (id: string) => createDevice(findEquipment('sony-srg300h')!, id, { x: 0, y: 0 });
  const tv = () => createDevice(findEquipment('lg-75up8000')!, 'tv', { x: 0, y: 0 });
  const hdmi = (from: string) => ({
    id: 'c1',
    from: { device: from, port: 'hdmi_out' },
    to: { device: 'tv', port: 'hdmi_in_1' },
    cable_type: 'hdmi',
    cable_length: 3,
  });

  for (const id of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
    it(`id «${id}» отклоняется при открытии файла с понятной ошибкой`, () => {
      // Через JSON.parse, как из файла
      const raw = JSON.parse(JSON.stringify({ devices: [cam(id), tv()], connections: [hdmi(id)] }));
      const r = parseProjectDoc(raw);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toContain(`служебное имя «${id}»`);
    });
  }

  it('два устройства с пустым id — ошибка, а не тихое принятие', () => {
    const r = parseProjectDoc({ devices: [cam(''), { ...tv(), id: '' }], connections: [] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/пустой идентификатор \(devices\.0\.id\)/);
  });

  it('повтор пустой строки находится и в проверке уникальности', () => {
    expect(identityError([cam(''), cam('')], [], [], [])).toContain('повторяется идентификатор устройства «»');
  });

  it('движок не падает на служебных именах, даже если схема собрана в обход файла', () => {
    for (const id of ['constructor', '__proto__', 'toString']) {
      const r = runSimulation([cam(id), tv()], [hdmi(id) as Connection]);
      expect(r.signal_flows.some((f) => f.source === id && f.path.includes('tv'))).toBe(true);
    }
  });
});
