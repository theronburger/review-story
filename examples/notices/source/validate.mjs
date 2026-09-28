import { fields } from './shared.mjs';
import { inspect } from './inspect.mjs';

function checkDocument(text, side, allowed) {
  try {
    const tokens = inspect(text);
    const issues = Object.entries(tokens).flatMap(([field, names]) =>
      names.filter(name => !allowed.has(name))
        .map(name => ({ kind: 'unknown-input', side, field, name })));
    return { tokens, issues };
  } catch (error) {
    return { issues: [{ kind: 'invalid-document', side, message: error.message }] };
  }
}

export function validate(source, translation, allowed) {
  const original = checkDocument(source, 'source', allowed);
  if (original.issues.length || translation === undefined) return original.issues;
  const candidate = checkDocument(translation, 'translation', allowed);
  if (!candidate.tokens) return candidate.issues;
  const issues = [...candidate.issues];
  for (const field of fields) {
    const expected = original.tokens[field];
    const actual = candidate.tokens[field];
    if (expected === undefined || actual === undefined) {
      if (expected !== actual) issues.push({ kind: 'field-presence', field });
      continue;
    }
    const missing = expected.filter(name => !actual.includes(name));
    const unexpected = actual.filter(name => !expected.includes(name));
    if (missing.length || unexpected.length) {
      issues.push({ kind: 'token-mismatch', field, missing, unexpected });
    }
  }
  return issues;
}
