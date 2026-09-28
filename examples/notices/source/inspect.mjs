import { fields } from './shared.mjs';

export function inspect(text) {
  const document = JSON.parse(text);
  if (!document || typeof document !== 'object' || Array.isArray(document)) {
    throw new Error('Expected a notice object');
  }
  if (typeof document.body !== 'string' || !document.body.trim()) {
    throw new Error('A nonempty body is required');
  }
  const found = {};
  for (const field of fields) {
    if (!Object.hasOwn(document, field)) continue;
    if (typeof document[field] !== 'string') throw new Error(`${field} must be text`);
    const names = [];
    const remainder = document[field].replace(/\{\{\s*([a-zA-Z][a-zA-Z0-9]*)\s*\}\}/g,
      (_, name) => { names.push(name); return ''; });
    if (remainder.includes('{{') || remainder.includes('}}')) {
      throw new Error(`Malformed placeholder in ${field}`);
    }
    found[field] = [...new Set(names)].sort();
  }
  return found;
}
