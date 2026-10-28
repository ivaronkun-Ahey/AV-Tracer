/**
 * Проверка лицензий продакшен-зависимостей (то, что попадает в сборку).
 * Ошибка, если лицензия не из разрешённого списка: так обновление зависимостей
 * не принесёт в проект несовместимую с Apache 2.0 лицензию незаметно.
 *
 *   npm run licenses:check
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ALLOWED = new Set(['MIT', 'ISC', 'BSD-2-Clause', 'BSD-3-Clause', 'Apache-2.0', '0BSD']);
// Слабый копилефт на уровне модуля: допустим без изменений, с указанием в THIRD_PARTY_NOTICES.md
const ALLOWED_PACKAGES = { elkjs: 'EPL-2.0' };

const out = execFileSync('npm', ['ls', '--omit=dev', '--all', '--parseable'], { encoding: 'utf8' });
const dirs = out.trim().split('\n').slice(1);
const problems = [];
for (const dir of dirs) {
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  const license = typeof pkg.license === 'string' ? pkg.license : pkg.license?.type ?? 'UNKNOWN';
  const ok = ALLOWED.has(license) || ALLOWED_PACKAGES[pkg.name] === license;
  if (!ok) problems.push(`${pkg.name}@${pkg.version}: ${license}`);
}
if (problems.length) {
  console.error(`Лицензии вне разрешённого списка:\n  ${problems.join('\n  ')}`);
  console.error('Проверьте совместимость с Apache 2.0 и обновите THIRD_PARTY_NOTICES.md.');
  process.exit(1);
}
console.log(`Лицензии в порядке (продакшен-пакетов: ${dirs.length})`);
