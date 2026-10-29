import { describe, it, expect } from 'vitest';
import { runSimulation } from './engine';
import { createDevice, findEquipment } from '../data/equipment';
import { CableType, Connection, Device, PropValue } from '../types/device.types';

/** Кодек ВКС: источник изображения и звука собеседников; камера, микрофоны и презентация — его входы. */

function dev(eq: string, id: string, props: Record<string, PropValue> = {}): Device {
  const d = createDevice(findEquipment(eq)!, id, { x: 0, y: 0 });
  Object.assign(d.properties, props);
  return d;
}

let n = 0;
const cable = (from: string, fromPort: string, to: string, toPort: string, type: CableType): Connection => ({
  id: `c${++n}`,
  from: { device: from, port: fromPort },
  to: { device: to, port: toPort },
  cable_type: type,
  cable_length: 5,
});

function room() {
  const devices = [
    dev('ptzoptics-20x', 'cam'),
    dev('generic-laptop', 'pc'),
    dev('sennheiser-e835', 'mic1'),
    dev('generic-vc-codec', 'vc'),
    dev('samsung-qm85r', 'tv1'),
    dev('lg-75up8000', 'tv2'),
    dev('jbl-prx815w', 'spk'),
    dev('cisco-sg350', 'lan'),
  ];
  const connections = [
    cable('cam', 'hdmi_out', 'vc', 'hdmi_in_1', 'hdmi'),
    cable('pc', 'hdmi_out', 'vc', 'hdmi_in_2', 'hdmi'),
    cable('mic1', 'xlr_out', 'vc', 'xlr_in_1', 'xlr'),
    cable('vc', 'hdmi_out_1', 'tv1', 'hdmi_in_1', 'hdmi'),
    cable('vc', 'hdmi_out_2', 'tv2', 'hdmi_in_1', 'hdmi'),
    cable('vc', 'xlr_out', 'spk', 'xlr_in', 'xlr'),
    cable('vc', 'eth', 'lan', 'eth_1', 'cat6'),
  ];
  return { devices, connections };
}

const types = (issues: { type: string }[]) => issues.map((i) => i.type);

describe('кодек ВКС', () => {
  it('переговорная: камера, презентация, микрофон, два дисплея, колонка, сеть — без замечаний', () => {
    const { devices, connections } = room();
    const r = runSimulation(devices, connections);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
    // Звук микрофона уходит в кодек (в звонок) и обратно в колонку не возвращается
    expect(r.signal_flows.filter((f) => f.type === 'audio').map((f) => f.path.join('>'))).toEqual(['mic1>vc', 'vc>spk']);
    // Уровень микрофона — после предусилителя кодека
    expect(r.signal_flows.find((f) => f.source === 'mic1')!.level_at).toBe('vc');
  });

  it('нет сети, камеры, микрофона, вывода собеседников — предупреждения', () => {
    const r = runSimulation([dev('generic-vc-codec', 'vc')], []);
    expect(types(r.warnings).sort()).toEqual(['codec_no_camera', 'codec_no_display', 'codec_no_mic', 'codec_no_speaker', 'codec_offline']);
  });

  it('конденсаторный микрофон без фантомного питания на кодеке — ошибка с «Исправить», микрофон не засчитан', () => {
    const { devices, connections } = room();
    devices[2] = dev('shure-beta87a', 'mic1');
    const r = runSimulation(devices, connections);
    const phantom = r.errors.find((e) => e.type === 'phantom_power')!;
    expect(phantom.fix).toMatchObject({ device: 'vc', property: 'phantom_power', value: true });
    expect(types(r.warnings)).toContain('codec_no_mic');
    devices[3].properties.phantom_power = true;
    expect(runSimulation(devices, connections).errors).toEqual([]);
  });

  it('слабый сигнал микрофона на кодеке — по его усилению входа', () => {
    const { devices, connections } = room();
    devices[3].properties.input_gain = 10;
    const low = runSimulation(devices, connections).warnings.find((w) => w.type === 'level_low')!;
    expect(low.device).toBe('vc');
    expect(low.fix).toMatchObject({ device: 'vc', kind: 'set_property' });
  });
});
