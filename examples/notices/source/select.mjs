export function selectAffected(changed, catalog, all = false) {
  if (all || changed.includes('shared.mjs') || changed.includes('catalog.mjs') ||
      changed.some(file => ['select.mjs', 'inspect.mjs', 'validate.mjs', 'run.mjs',
        'cli.mjs', 'contracts.mjs', '.github/workflows/notices.yml'].includes(file))) {
    return catalog;
  }
  const changedSources = new Set(catalog
    .filter(entry => entry.locale === 'en' && changed.includes(entry.file))
    .map(entry => entry.id));
  return catalog.filter(entry =>
    changed.includes(entry.file) || changedSources.has(entry.id));
}
