import { describe, it, expect } from 'vitest';
import { parseProjectDoc } from './projectSchema';
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
