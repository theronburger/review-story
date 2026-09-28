import { sharedInputs } from './shared.mjs';

export function loadContract(name, read) {
  const { inputs, derived } = JSON.parse(read(`contracts/${name}.json`));
  return new Set([...sharedInputs, ...inputs, ...derived]);
}
