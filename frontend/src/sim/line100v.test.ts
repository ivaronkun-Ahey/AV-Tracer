import { describe, it, expect } from 'vitest';
import { runSimulation } from './engine';
import { createDevice, findEquipment } from '../data/equipment';
import { connectionProblem } from '../features/connectionRules';
import { CableType, Connection, Device, PropValue } from '../types/device.types';

/** Трансляционная линия 100 В: ожидания — по сумме отводов громкоговорителей (не больше 80–100 % мощности канала). */

function dev(eq: string, id: string, props: Record<string, PropValue> = {}): Device {
  const d = createDevice(findEquipment(eq)!, id, { x: 0, y: 0 });
  Object.assign(d.properties, props);
  return d;
}

let n = 0;
const cable = (from: string, fromPort: string, to: string, toPort: string, type: CableType = 'terminal'): Connection => ({
  id: `c${++n}`,
  from: { device: from, port: fromPort },
  to: { device: to, port: toPort },
  cable_type: type,
  cable_length: 20,
});

/** Микрофон → микшер → трансляционный усилитель → цепочка громкоговорителей по проходным клеммам. */
function system(count: number, tap: number, ampProps: Record<string, PropValue> = {}) {
  const devices = [dev('shure-sm58', 'mic'), dev('yamaha-mg12xu', 'mix', { input_gain: 50 }), dev('generic-pa-amp-240', 'amp', ampProps)];
  const connections = [cable('mic', 'xlr_out', 'mix', 'xlr_in_1', 'xlr'), cable('mix', 'xlr_out_l', 'amp', 'xlr_in', 'xlr')];
  for (let i = 1; i <= count; i++) {
    devices.push(dev('generic-ceiling-spk-100v', `s${i}`, { tap_watts: tap }));
    connections.push(i === 1 ? cable('amp', 'line100_out', 's1', 'line100_in') : cable(`s${i - 1}`, 'line100_thru', `s${i}`, 'line100_in'));
  }
  return { devices, connections };
}

const types = (issues: { type: string }[]) => issues.map((i) => i.type);

describe('трансляционная линия 100 В', () => {
  it('10 громкоговорителей по 6 Вт на усилителе 240 Вт: звук доходит до всех, перегрузки нет', () => {
    const { devices, connections } = system(10, 6);
    const r = runSimulation(devices, connections);
    expect(r.errors).toEqual([]);
    expect(types(r.warnings)).not.toContain('line_headroom');
    for (let i = 1; i <= 10; i++) expect(r.signal_flows.some((f) => f.path.includes(`s${i}`))).toBe(true);
  });

  it('сумма отводов больше мощности — ошибка; больше 80 % — предупреждение о запасе', () => {
    const over = runSimulation(...(Object.values(system(50, 6)) as [Device[], Connection[]]));
    expect(types(over.errors)).toContain('line_overload');
    expect(over.errors.find((e) => e.type === 'line_overload')!.message).toContain(
      '300 Вт на 50 громкоговорителей больше мощности канала 240 Вт'
    );

    const tight = runSimulation(...(Object.values(system(34, 6)) as [Device[], Connection[]])); // 204 Вт = 85 %
    expect(types(tight.errors)).not.toContain('line_overload');
    expect(types(tight.warnings)).toContain('line_headroom');

    // Отвод поменьше — линия в норме
    const fixed = runSimulation(...(Object.values(system(50, 3)) as [Device[], Connection[]])); // 150 Вт
    expect(types(fixed.errors)).not.toContain('line_overload');
    expect(types(fixed.warnings)).not.toContain('line_headroom');
  });

  it('на 70 В отводы для 100 В дают вдвое меньше мощности', () => {
    const r = runSimulation(...(Object.values(system(50, 6, { line_voltage: 70 })) as [Device[], Connection[]])); // 300 × 0,49 = 147 Вт
    expect(types(r.errors)).not.toContain('line_overload');
  });

  it('усилитель 2×120 Вт: каждая зона считается отдельно', () => {
    const devices = [dev('generic-pa-amp-2x120', 'amp')];
    const connections: Connection[] = [];
    // Зона 1: 13 × 10 Вт = 130 Вт > 120 Вт; зона 2: 10 Вт
    for (let i = 1; i <= 13; i++) {
      devices.push(dev('generic-wall-spk-100v', `z1_${i}`, { tap_watts: 10 }));
      connections.push(cable(i === 1 ? 'amp' : `z1_${i - 1}`, i === 1 ? 'line100_out_1' : 'line100_thru', `z1_${i}`, 'line100_in'));
    }
    devices.push(dev('generic-wall-spk-100v', 'z2_1', { tap_watts: 10 }));
    connections.push(cable('amp', 'line100_out_2', 'z2_1', 'line100_in'));
    const r = runSimulation(devices, connections);
    const overload = r.errors.filter((e) => e.type === 'line_overload');
    expect(overload).toHaveLength(1);
    expect(overload[0].message).toContain('выход 1');
  });

  it('линия 100 В не подключается к Speakon и линейным входам, низкоомная АС — к линии', () => {
    const devices = [
      dev('generic-pa-amp-240', 'amp'),
      dev('ev-evf1122', 'lowz'),
      dev('generic-ceiling-spk-100v', 'cv'),
      dev('crown-xls2502', 'xls'),
    ];
    expect(connectionProblem(devices, [], { device: 'amp', port: 'line100_out' }, { device: 'lowz', port: 'speakon_in' })).toBeTruthy();
    expect(connectionProblem(devices, [], { device: 'xls', port: 'speakon_out_l' }, { device: 'cv', port: 'line100_in' })).toBeTruthy();
    expect(connectionProblem(devices, [], { device: 'amp', port: 'line100_out' }, { device: 'cv', port: 'line100_in' })).toBeNull();
  });

  it('громкоговоритель без отвода — предупреждение', () => {
    const { devices, connections } = system(3, 6);
    devices[4].properties.tap_watts = 0;
    expect(types(runSimulation(devices, connections).warnings)).toContain('tap_missing');
  });
});
