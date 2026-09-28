import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { catalog } from './catalog.mjs';
import { run } from './run.mjs';

const changed = ['contracts/shipment.json'];
const read = file => {
  const text = readFileSync(new URL(file, import.meta.url), 'utf8');
  if (file !== changed[0]) return text;
  const contract = JSON.parse(text);
  contract.inputs = contract.inputs.filter(name => name !== 'trackingUrl');
  return JSON.stringify(contract);
};
const scoped = run({ changed, catalog, read });
const full = run({ changed, catalog, read, all: true });
assert.equal(scoped.checked, 0);
assert.equal(scoped.exitCode, 0);
assert.equal(full.exitCode, 1);
assert.equal(full.results.filter(result => result.issues.length).length, 5);
console.log(JSON.stringify({ scoped, full }, null, 2));
