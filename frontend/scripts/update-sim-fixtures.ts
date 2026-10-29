/**
 * Пересчитывает поле expected во всех shared/sim-fixtures/*.json движком
 * симуляции. Запускать после намеренного изменения логики и проверять diff.
 *
 *   npm run fixtures:update
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSimulation } from '../src/sim/engine';

const dir = join(dirname(fileURLToPath(import.meta.url)), '../../shared/sim-fixtures');

for (const file of readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
  const path = join(dir, file);
  const fixture = JSON.parse(readFileSync(path, 'utf8'));
  fixture.expected = runSimulation(fixture.devices, fixture.connections);
  writeFileSync(path, JSON.stringify(fixture, null, 2) + '\n');
  console.log(`updated ${file}`);
}
