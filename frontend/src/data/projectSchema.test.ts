import { describe, it, expect } from 'vitest';
import { parseProjectDoc, serializeProject } from './projectSchema';
import { SCHEMA_VERSION } from './migrations';
import { createDevice, findEquipment } from './equipment';

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
    expect(serializeProject([], [])).toEqual({ schemaVersion: SCHEMA_VERSION, devices: [], connections: [] });
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
