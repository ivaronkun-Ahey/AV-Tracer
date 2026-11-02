import { describe, it, expect } from 'vitest';
import { runSimulation } from './engine';
import { createDevice, findEquipment } from '../data/equipment';
import { withDeviceTags } from '../data/deviceTags';
import { connectionProblem } from '../features/connectionRules';
import { Connection, Device, PropValue } from '../types/device.types';

/** DMX512: адреса приборов, вселенная 512 каналов, терминатор, до 32 устройств на сегменте, без Y-разветвлений. */

function dev(eq: string, id: string, props: Record<string, PropValue> = {}): Device {
  const d = createDevice(findEquipment(eq)!, id, { x: 0, y: 0 });
  Object.assign(d.properties, props);
  return d;
}

let n = 0;
const dmx = (from: string, fromPort: string, to: string): Connection => ({
  id: `c${++n}`,
  from: { device: from, port: fromPort },
  to: { device: to, port: 'dmx_in' },
  cable_type: 'xlr',
  cable_length: 10,
});

/** Пульт → цепочка приборов PAR (8 каналов) с адресами addresses. */
function rig(addresses: number[], lastTerminated = true) {
  const devices = [dev('generic-dmx-console', 'desk')];
  const connections: Connection[] = [];
  addresses.forEach((a, i) => {
    devices.push(dev('generic-led-par', `p${i + 1}`, { dmx_address: a, dmx_terminator: lastTerminated && i === addresses.length - 1 }));
    connections.push(dmx(i === 0 ? 'desk' : `p${i}`, i === 0 ? 'dmx_out_1' : 'dmx_thru', `p${i + 1}`));
  });
  return { devices: withDeviceTags(devices), connections };
}

const types = (issues: { type: string }[]) => issues.map((i) => i.type);

describe('свет: DMX512', () => {
  it('пульт → 4 прибора с адресами 1, 9, 17, 25 и терминатором — без замечаний', () => {
    const { devices, connections } = rig([1, 9, 17, 25]);
    const r = runSimulation(devices, connections);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
  });

  it('пересечение каналов — предупреждение с «Исправить» на следующий свободный адрес; одинаковые адреса — намеренно вместе', () => {
    const { devices, connections } = rig([1, 5, 17]);
    const w = runSimulation(devices, connections).warnings.find((x) => x.type === 'dmx_address_overlap')!;
    expect(w.message).toContain('(1–8)');
    expect(w.message).toContain('(5–12)');
    expect(w.fix).toMatchObject({ device: 'p2', property: 'dmx_address', value: 9 });
    expect(types(runSimulation(...(Object.values(rig([1, 1, 9])) as [Device[], Connection[]])).warnings)).not.toContain(
      'dmx_address_overlap'
    );
  });

  it('адрес за пределами 512 каналов — ошибка', () => {
    const { devices, connections } = rig([1, 508]);
    expect(types(runSimulation(devices, connections).errors)).toContain('dmx_address_range');
  });

  it('нет терминатора на последнем приборе или он посередине — предупреждения с «Исправить»', () => {
    const { devices, connections } = rig([1, 9, 17], false);
    const r = runSimulation(devices, connections);
    expect(r.warnings.find((w) => w.type === 'dmx_no_terminator')).toMatchObject({
      device: 'p3',
      fix: { property: 'dmx_terminator', value: true },
    });
    devices[1].properties.dmx_terminator = true;
    expect(types(runSimulation(devices, connections).warnings)).toContain('dmx_terminator_middle');
  });

  it('Y-разветвление — предупреждение; больше 32 устройств — нужен сплиттер, со сплиттером — норма', () => {
    const { devices, connections } = rig([1, 9]);
    devices.push(dev('generic-led-par', 'y', { dmx_address: 17, dmx_terminator: true }));
    connections.push(dmx('desk', 'dmx_out_1', 'y'));
    expect(types(runSimulation(devices, connections).warnings)).toContain('dmx_branch');

    const long = rig(Array.from({ length: 40 }, (_, i) => 1 + i * 8));
    expect(types(runSimulation(long.devices, long.connections).warnings)).toContain('dmx_too_many');

    // Сплиттер: 20 приборов на одном выходе, 20 — на другом
    const devs = [dev('generic-dmx-console', 'desk'), dev('generic-dmx-splitter', 'spl')];
    const cons = [dmx('desk', 'dmx_out_1', 'spl')];
    for (const [out, base] of [
      ['dmx_out_1', 0],
      ['dmx_out_2', 20],
    ] as const) {
      for (let i = 0; i < 20; i++) {
        const id = `f${base + i}`;
        devs.push(dev('generic-led-par', id, { dmx_address: 1 + (base + i) * 8, dmx_terminator: i === 19 }));
        cons.push(dmx(i === 0 ? 'spl' : `f${base + i - 1}`, i === 0 ? out : 'dmx_thru', id));
      }
    }
    const split = runSimulation(devs, cons);
    expect(split.errors).toEqual([]);
    expect(split.warnings).toEqual([]);
  });

  it('прибор без DMX или без пульта в цепочке — ошибка; DMX не подключается к аудиовходу', () => {
    const lone = runSimulation([dev('generic-led-par', 'p')], []);
    expect(lone.errors[0]).toMatchObject({ type: 'dmx_no_signal', device: 'p' });
    const devices = [dev('generic-dmx-console', 'desk'), dev('yamaha-mg12xu', 'mix')];
    expect(connectionProblem(devices, [], { device: 'desk', port: 'dmx_out_1' }, { device: 'mix', port: 'xlr_in_1' })).toBeTruthy();
  });
});
