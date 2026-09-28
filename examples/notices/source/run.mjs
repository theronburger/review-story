import { selectAffected } from './select.mjs';
import { loadContract } from './contracts.mjs';
import { validate } from './validate.mjs';

export function run({ changed, catalog, read, all = false }) {
  const selected = selectAffected(changed, catalog, all);
  const results = selected.map(entry => {
    try {
      const source = catalog.find(item => item.id === entry.id && item.locale === 'en');
      if (!source) throw new Error(`Missing English source for ${entry.id}`);
      const allowed = loadContract(entry.contract, read);
      const issues = validate(read(source.file),
        entry.locale === 'en' ? undefined : read(entry.file), allowed);
      return { file: entry.file, issues };
    } catch (error) {
      return { file: entry.file, issues: [{ kind: 'load-error', message: error.message }] };
    }
  });
  return { checked: results.length, results,
    exitCode: results.some(result => result.issues.length) ? 1 : 0 };
}
