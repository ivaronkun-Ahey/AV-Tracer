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

  it('радиосистема является источником аудиоцепочки', () => {
    const devices: Device[] = [
      dev({ id: 'rx', type: 'wireless_mic' }),
      dev({ id: 'mix', type: 'mixer', properties: { master_gain: 50 } }),
    ];
    const conn: Connection[] = [
      { id: 'c', from: { device: 'rx', port: 'o' }, to: { device: 'mix', port: 'i' }, cable_type: 'xlr', cable_length: 1 },
    ];
    const r = runSimulation(devices, conn);
    const audio = r.signal_flows.find((f) => f.type === 'audio');
    expect(audio?.source).toBe('rx');
    expect(audio?.final_level_db).toBe(0); // -50 + 50
  });

  it('ошибка: активную АС подключили к выходу усилителя', () => {
    const devices: Device[] = [
      dev({ id: 'amp', type: 'amplifier', properties: { gain: 20 } }),
      dev({ id: 'spk', type: 'speaker', properties: { active: true } }),
    ];
    const conn: Connection[] = [
      { id: 'c', from: { device: 'amp', port: 'o' }, to: { device: 'spk', port: 'i' }, cable_type: 'speakon', cable_length: 1 },
    ];
    const r = runSimulation(devices, conn);
    expect(r.errors.some((e) => e.type === 'active_on_amp')).toBe(true);
  });

  it('ошибка: пассивная АС без усилителя', () => {
    const devices: Device[] = [
      dev({ id: 'mix', type: 'mixer', properties: {} }),
      dev({ id: 'spk', type: 'speaker', properties: { active: false } }),
    ];
    const conn: Connection[] = [
      { id: 'c', from: { device: 'mix', port: 'o' }, to: { device: 'spk', port: 'i' }, cable_type: 'xlr', cable_length: 1 },
    ];
    const r = runSimulation(devices, conn);
    expect(r.errors.some((e) => e.type === 'passive_no_amp')).toBe(true);
  });

  it('ошибка: несовместимые сигналы на соединении', () => {
    const devices: Device[] = [
      dev({
        id: 'a',
        type: 'mixer',
        ports: [{ id: 'o', type: 'xlr', direction: 'output', signal_type: 'analog_audio' }],
      }),
      dev({
        id: 'b',
        type: 'display',
        properties: {},
        ports: [{ id: 'i', type: 'hdmi', direction: 'input', signal_type: 'hdmi' }],
      }),
    ];
    const conn: Connection[] = [
      { id: 'c', from: { device: 'a', port: 'o' }, to: { device: 'b', port: 'i' }, cable_type: 'xlr', cable_length: 1 },
    ];
    const r = runSimulation(devices, conn);
    expect(r.errors.some((e) => e.type === 'signal_mismatch')).toBe(true);
  });

  it('Dante (digital_audio) совместим с сетью (network)', () => {
    const devices: Device[] = [
      dev({
        id: 'mic',
        type: 'array_microphone',
        ports: [{ id: 'o', type: 'cat6', direction: 'output', signal_type: 'digital_audio' }],
      }),
      dev({
        id: 'sw',
        type: 'network_switch',
        ports: [{ id: 'i', type: 'cat6', direction: 'bidirectional', signal_type: 'network' }],
      }),
    ];
    const conn: Connection[] = [
      { id: 'c', from: { device: 'mic', port: 'o' }, to: { device: 'sw', port: 'i' }, cable_type: 'cat6', cable_length: 1 },
    ];
    const r = runSimulation(devices, conn);
    expect(r.errors.some((e) => e.type === 'signal_mismatch')).toBe(false);
  });

  it('предупреждает о PoE-устройстве на коммутаторе без PoE', () => {
    const devices: Device[] = [
      dev({ id: 'ap', type: 'wireless_ap', specs: { requires_poe: true } }),
      dev({ id: 'sw', type: 'network_switch', properties: { poe: false } }),
    ];
    const conn: Connection[] = [
      { id: 'c', from: { device: 'ap', port: 'e' }, to: { device: 'sw', port: 'p' }, cable_type: 'cat6', cable_length: 1 },
    ];
    const r = runSimulation(devices, conn);
    expect(r.warnings.some((w) => w.type === 'no_poe')).toBe(true);
  });

  it('масштабатор меняет итоговое разрешение видеоцепочки', () => {
    const devices: Device[] = [
      dev({ id: 'cam', type: 'camera', category: 'video', properties: { resolution: '3840x2160' } }),
      dev({ id: 'sc', type: 'scaler', category: 'video', properties: { resolution_out: '1920x1080' } }),
    ];
    const conn: Connection[] = [
      { id: 'c', from: { device: 'cam', port: 'o' }, to: { device: 'sc', port: 'i' }, cable_type: 'hdmi', cable_length: 1 },
    ];
    const r = runSimulation(devices, conn);
    const video = r.signal_flows.find((f) => f.type === 'video');
    expect(video?.resolution).toBe('1920x1080');
  });
});
