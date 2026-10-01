import { selectLayout } from './layouts.mjs'
import { deriveSummary } from './derive.mjs'
import { renderRows } from './rows.mjs'

export function renderSummary(items, requestedLocale = 'en') {
  const { locale, labels } = selectLayout(requestedLocale)
  const { rows, total } = deriveSummary(items)
  const body = renderRows(rows, labels)
  return { locale, title: labels.title, total, body }
}
