import { describe, it, expect } from 'vitest';
import { runSimulation } from './engine';
import { Connection, Device, SimulationResult } from '../types/device.types';

interface Fixture {
  name: string;
  devices: Device[];
  connections: Connection[];
  expected: SimulationResult;
}

// Эталонные схемы: любое изменение результата симуляции видно в diff эталонов.
// Пересчитать после намеренного изменения логики: npm run fixtures:update
const fixtures = import.meta.glob<Fixture>('../../../shared/sim-fixtures/*.json', { eager: true, import: 'default' });

describe('общие эталоны симуляции', () => {
  it('эталоны найдены', () => {
    expect(Object.keys(fixtures).length).toBeGreaterThan(0);
  });

  for (const [file, fx] of Object.entries(fixtures)) {
    it(file.split('/').pop()!, () => {
      const result = runSimulation(fx.devices, fx.connections);
      expect(JSON.parse(JSON.stringify(result))).toEqual(fx.expected);
    });
  }
});
