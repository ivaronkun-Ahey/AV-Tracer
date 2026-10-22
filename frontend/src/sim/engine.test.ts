import { describe, it, expect } from 'vitest';
import { runSimulation, parseResolution } from './engine';
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
  it('строит аудиоцепочку микрофон → микшер → колонка и считает уровень на входе АС', () => {
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
    expect(audio?.final_level_db).toBe(-10); // -50 дБu (микрофон) + 40 дБ
    expect(audio?.level_at).toBe('spk');
  });

  it('учитывает чувствительность микрофона и усиление входа микшера', () => {
    const devices: Device[] = [
      dev({ id: 'mic', type: 'microphone', properties: { sensitivity: -54.5 } }),
      dev({ id: 'mix', type: 'mixer', properties: { input_gain: 45, master_gain: 0 } }),
      dev({ id: 'spk', type: 'speaker', properties: { active: true } }),
    ];
    const conn: Connection[] = [
      { id: 'c1', from: { device: 'mic', port: 'o' }, to: { device: 'mix', port: 'i' }, cable_type: 'xlr', cable_length: 1 },
      { id: 'c2', from: { device: 'mix', port: 'o' }, to: { device: 'spk', port: 'i' }, cable_type: 'xlr', cable_length: 1 },
    ];
    const r = runSimulation(devices, conn);
    expect(r.signal_flows[0].final_level_db).toBe(-7.3); // -54.5 + 2.2 + 45
    expect(r.signal_flows[0].status).toBe('ok');
    expect(r.warnings).toHaveLength(0);
  });

  it('слабый сигнал попадает в предупреждения, а не только в статус цепочки', () => {
    const devices: Device[] = [
      dev({ id: 'mic', type: 'microphone', properties: { sensitivity: -54.5 } }),
      dev({ id: 'mix', type: 'mixer', properties: { input_gain: 0 } }),
      dev({ id: 'spk', type: 'speaker', properties: { active: true } }),
    ];
    const conn: Connection[] = [
      { id: 'c1', from: { device: 'mic', port: 'o' }, to: { device: 'mix', port: 'i' }, cable_type: 'xlr', cable_length: 1 },
      { id: 'c2', from: { device: 'mix', port: 'o' }, to: { device: 'spk', port: 'i' }, cable_type: 'xlr', cable_length: 1 },
    ];
    const r = runSimulation(devices, conn);
    expect(r.signal_flows[0].status).toBe('warning');
    expect(r.warnings.find((w) => w.type === 'level_low')?.device).toBe('mix');
  });

  it('идёт по всем кабелям с выхода: две АС на одном выходе усилителя — две ветви', () => {
    const devices: Device[] = [
      dev({ id: 'mic', type: 'microphone' }),
      dev({ id: 'amp', type: 'amplifier' }),
      dev({ id: 's1', type: 'speaker', properties: { active: false } }),
      dev({ id: 's2', type: 'speaker', properties: { active: false } }),
    ];
    const conn: Connection[] = [
      { id: 'c1', from: { device: 'mic', port: 'o' }, to: { device: 'amp', port: 'i' }, cable_type: 'xlr', cable_length: 1 },
      { id: 'c2', from: { device: 'amp', port: 'o' }, to: { device: 's1', port: 'i' }, cable_type: 'speakon', cable_length: 1 },
      { id: 'c3', from: { device: 'amp', port: 'o' }, to: { device: 's2', port: 'i' }, cable_type: 'speakon', cable_length: 1 },
    ];
    const paths = runSimulation(devices, conn).signal_flows.map((f) => f.path);
    expect(paths).toEqual([
      ['mic', 'amp', 's1'],
      ['mic', 'amp', 's2'],
    ]);
  });

  it('ошибка: в один вход подключено два кабеля', () => {
    const inPort = { id: 'in', type: 'xlr' as const, direction: 'input' as const, signal_type: 'analog_audio' as const };
    const devices: Device[] = [
      dev({ id: 'a', type: 'microphone' }),
      dev({ id: 'b', type: 'microphone' }),
      dev({ id: 'mix', type: 'mixer', ports: [inPort] }),
    ];
    const conn: Connection[] = [
      { id: 'c1', from: { device: 'a', port: 'o' }, to: { device: 'mix', port: 'in' }, cable_type: 'xlr', cable_length: 1 },
      { id: 'c2', from: { device: 'b', port: 'o' }, to: { device: 'mix', port: 'in' }, cable_type: 'xlr', cable_length: 1 },
    ];
    const busy = runSimulation(devices, conn).errors.find((e) => e.type === 'input_busy');
    expect(busy?.device).toBe('mix');
    expect(busy?.connection).toBe('c2');
  });

  it('предупреждает, если сигнал выше максимального разрешения коммутатора', () => {
    const devices: Device[] = [
      dev({ id: 'cam', type: 'camera', category: 'video', properties: { resolution: '3840x2160' } }),
      dev({ id: 'sw', type: 'switcher', category: 'video', properties: { max_resolution: '1920x1080' } }),
    ];
    const conn: Connection[] = [
      { id: 'c', from: { device: 'cam', port: 'o' }, to: { device: 'sw', port: 'i' }, cable_type: 'hdmi', cable_length: 1 },
    ];
    const r = runSimulation(devices, conn);
    expect(r.warnings.some((w) => w.type === 'resolution_unsupported' && w.device === 'sw')).toBe(true);
    expect(r.signal_flows[0].status).toBe('warning');
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

  it('бюджет мощности: слишком низкое сопротивление нагрузки усилителя', () => {
    const devices: Device[] = [
      dev({ id: 'amp', type: 'amplifier', properties: { power_watts: 500, min_impedance_ohms: 8 } }),
      dev({ id: 's1', type: 'speaker', properties: { active: false, impedance_ohms: 8, power_handling_watts: 250 } }),
      dev({ id: 's2', type: 'speaker', properties: { active: false, impedance_ohms: 8, power_handling_watts: 250 } }),
    ];
    const conn: Connection[] = [
      { id: 'c1', from: { device: 'amp', port: 'o' }, to: { device: 's1', port: 'i' }, cable_type: 'speakon', cable_length: 1 },
      { id: 'c2', from: { device: 'amp', port: 'o' }, to: { device: 's2', port: 'i' }, cable_type: 'speakon', cable_length: 1 },
    ];
    const r = runSimulation(devices, conn);
    expect(r.errors.some((e) => e.type === 'impedance_low')).toBe(true);
  });

  it('бюджет мощности: усилитель мощнее допустимой мощности АС', () => {
    const devices: Device[] = [
      dev({ id: 'amp', type: 'amplifier', properties: { power_watts: 2000, min_impedance_ohms: 2 } }),
      dev({ id: 's1', type: 'speaker', properties: { active: false, impedance_ohms: 8, power_handling_watts: 200 } }),
    ];
    const conn: Connection[] = [
      { id: 'c1', from: { device: 'amp', port: 'o' }, to: { device: 's1', port: 'i' }, cable_type: 'speakon', cable_length: 1 },
    ];
    const r = runSimulation(devices, conn);
    expect(r.warnings.some((w) => w.type === 'power_over')).toBe(true);
  });

  it('предупреждает о слишком длинном кабеле', () => {
    const devices: Device[] = [
      dev({ id: 'a', type: 'mixer' }),
      dev({ id: 'b', type: 'mixer' }),
    ];
    const conn: Connection[] = [
      { id: 'c', from: { device: 'a', port: 'o' }, to: { device: 'b', port: 'i' }, cable_type: 'hdmi', cable_length: 30 },
    ];
    const r = runSimulation(devices, conn);
    expect(r.warnings.some((w) => w.type === 'cable_length')).toBe(true);
  });
});

describe('parseResolution', () => {
  it('понимает разные записи разрешения', () => {
    expect(parseResolution('3840x2160')).toEqual({ w: 3840, h: 2160 });
    expect(parseResolution('1920 × 1200')).toEqual({ w: 1920, h: 1200 });
    expect(parseResolution('4K60')).toEqual({ w: 3840, h: 2160 });
    expect(parseResolution('1080p')).toEqual({ w: 1920, h: 1080 });
    expect(parseResolution('мусор')).toBeNull();
    expect(parseResolution(42)).toBeNull();
  });
});
