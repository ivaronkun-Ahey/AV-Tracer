import { describe, it, expect } from 'vitest';
import { runSimulation } from './engine';
import { createDevice, findEquipment } from '../data/equipment';
import { CableType, Connection, Device, PropValue } from '../types/device.types';

/** Звук через HDMI: идёт вместе с видео и выходит в аналоговый тракт только через деэмбеддер. */

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

const reached = (r: ReturnType<typeof runSimulation>, type: 'audio' | 'video', id: string) =>
  r.signal_flows.some((f) => f.type === type && f.path.indexOf(id) > 0);

describe('звук через HDMI', () => {
  it('ноутбук → деэмбеддер → проектор, звук деэмбеддера → микшер → колонка: картинка и звук доходят', () => {
    const r = runSimulation(
      [
        dev('generic-laptop', 'pc'),
        dev('generic-hdmi-deembedder', 'de'),
        dev('epson-l1755u', 'proj'),
        dev('yamaha-mg12xu', 'mix', { input_gain: 10 }),
        dev('jbl-prx815w', 'spk'),
      ],
      [
        cable('pc', 'hdmi_out', 'de', 'hdmi_in', 'hdmi'),
        cable('de', 'hdmi_out', 'proj', 'hdmi_in_1', 'hdmi'),
        cable('de', 'trs_out_l', 'mix', 'trs_in_7', 'trs'),
        cable('mix', 'xlr_out_l', 'spk', 'xlr_in', 'xlr'),
      ]
    );
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(reached(r, 'video', 'proj')).toBe(true);
    expect(r.signal_flows.find((f) => f.type === 'audio')!.path).toEqual(['pc', 'de', 'mix', 'spk']);
  });

  it('звук по HDMI до проектора — не отдельная аудиоцепочка; колонка без деэмбеддера звука не получает', () => {
    const r = runSimulation(
      [dev('generic-laptop', 'pc'), dev('epson-l1755u', 'proj'), dev('yamaha-mg12xu', 'mix'), dev('jbl-prx815w', 'spk')],
      [cable('pc', 'hdmi_out', 'proj', 'hdmi_in_1', 'hdmi'), cable('mix', 'xlr_out_l', 'spk', 'xlr_in', 'xlr')]
    );
    expect(r.signal_flows.filter((f) => f.type === 'audio')).toEqual([]);
    expect(r.errors.find((e) => e.device === 'spk')?.type).toBe('no_signal');
  });

  it('встроенный звук проходит через коммутатор по выбранному входу', () => {
    const devices = [
      dev('brightsign-xt1144', 'player'),
      dev('extron-in1608', 'sw', { selected_input: 1 }),
      dev('generic-hdmi-deembedder', 'de'),
      dev('yamaha-mg12xu', 'mix', { input_gain: 10 }),
      dev('jbl-prx815w', 'spk'),
    ];
    const connections = [
      cable('player', 'hdmi_out', 'sw', 'hdmi_in_2', 'hdmi'),
      cable('sw', 'hdmi_out_1', 'de', 'hdmi_in', 'hdmi'),
      cable('de', 'trs_out_l', 'mix', 'trs_in_7', 'trs'),
      cable('mix', 'xlr_out_l', 'spk', 'xlr_in', 'xlr'),
    ];
    const blocked = runSimulation(devices, connections);
    expect(blocked.errors.find((e) => e.device === 'spk')?.message).toContain('вход 2 на «IN1608» не выбран');
    devices[1].properties.selected_input = 2;
    expect(reached(runSimulation(devices, connections), 'audio', 'spk')).toBe(true);
  });

  it('эмбеддер: звук микшера уходит по HDMI на дисплей вместе с картинкой ноутбука', () => {
    const r = runSimulation(
      [
        dev('shure-sm58', 'mic'),
        dev('yamaha-mg12xu', 'mix', { input_gain: 50 }),
        dev('generic-laptop', 'pc'),
        dev('generic-hdmi-embedder', 'em'),
        dev('samsung-qm85r', 'tv'),
      ],
      [
        cable('mic', 'xlr_out', 'mix', 'xlr_in_1', 'xlr'),
        cable('mix', 'xlr_out_l', 'em', 'trs_in_l', 'trs'),
        cable('pc', 'hdmi_out', 'em', 'hdmi_in', 'hdmi'),
        cable('em', 'hdmi_out', 'tv', 'hdmi_in_1', 'hdmi'),
      ]
    );
    expect(r.errors).toEqual([]);
    expect(r.signal_flows.some((f) => f.type === 'audio' && f.path.join('>') === 'mic>mix>em>tv')).toBe(true);
    expect(reached(r, 'video', 'tv')).toBe(true);
  });

  it('звук микрофонов видеобара уходит в компьютер (в звонок), а не обратно на дисплей', () => {
    const r = runSimulation(
      [dev('generic-video-bar', 'vb'), dev('generic-laptop', 'pc'), dev('lg-75up8000', 'tv')],
      [cable('vb', 'usb_out', 'pc', 'usb_in', 'usb'), cable('pc', 'hdmi_out', 'tv', 'hdmi_in_1', 'hdmi')]
    );
    expect(r.signal_flows.filter((f) => f.type === 'audio').map((f) => f.path.join('>'))).toEqual(['vb>pc']);
  });
});
