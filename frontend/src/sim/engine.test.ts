import { describe, it, expect } from 'vitest';
import { runSimulation } from './engine';
import { Device, Connection } from '../types/device.types';

function dev(partial: Partial<Device> & { id: string; type: string }): Device {
  return {
    manufacturer: 'Test',
    model: partial.id,
    full_name: partial.id,
    category: 'audio',
    position: { x: 0, y: 0 },
    ports: [],
    properties: {},
    ...partial,
  };
}

describe('runSimulation', () => {
  it('строит аудиоцепочку микрофон → микшер → колонка и считает уровень', () => {
    const devices: Device[] = [
      dev({ id: 'mic', type: 'microphone', properties: { phantom_power: true } }),
      dev({ id: 'mix', type: 'mixer', properties: { master_gain: 40 } }),
      dev({ id: 'spk', type: 'speaker', properties: {} }),
    ];
    const connections: Connection[] = [
      { id: 'c1', from: { device: 'mic', port: 'o' }, to: { device: 'mix', port: 'i' }, cable_type: 'xlr', cable_length: 1 },
      { id: 'c2', from: { device: 'mix', port: 'o' }, to: { device: 'spk', port: 'i' }, cable_type: 'xlr', cable_length: 1 },
    ];
    const r = runSimulation(devices, connections);
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
    const audio = r.signal_flows.find((f) => f.type === 'audio');
    expect(audio?.path).toEqual(['mic', 'mix', 'spk']);
    expect(audio?.final_level_db).toBe(-20); // -60 + 40
  });

  it('сообщает об ошибке, если колонка не подключена', () => {
    const devices: Device[] = [dev({ id: 'spk', type: 'speaker' })];
    const r = runSimulation(devices, []);
    expect(r.valid).toBe(false);
    expect(r.errors[0].device).toBe('spk');
  });

  it('предупреждает о конденсаторном микрофоне без фантомного питания', () => {
    const devices: Device[] = [
      dev({ id: 'mic', type: 'microphone', properties: { phantom_power: false }, specs: { requires_phantom: true } }),
    ];
    const r = runSimulation(devices, []);
    expect(r.warnings.some((w) => w.type === 'phantom_power')).toBe(true);
  });
});
