import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { catalog } from './catalog.mjs';
import { run } from './run.mjs';

const all = process.argv.includes('--all');
const baseIndex = process.argv.indexOf('--base');
if (!all && (baseIndex < 0 || !process.argv[baseIndex + 1])) {
  throw new Error('Pass --all or --base <revision>');
}
const changed = all ? [] : execFileSync('git',
  ['diff', '--name-only', '-z', process.argv[baseIndex + 1], 'HEAD'],
  { encoding: 'utf8' }).split('\0').filter(Boolean);
const report = run({ changed, catalog, all,
  read: file => readFileSync(new URL(file, import.meta.url), 'utf8') });
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.exitCode;
