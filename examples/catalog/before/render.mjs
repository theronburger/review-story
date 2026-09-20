const layouts = {
  en: { title: 'Stock summary', item: 'Item', quantity: 'Quantity' },
  fr: { title: 'Résumé du stock', item: 'Article', quantity: 'Quantité' },
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char])
}

export function renderSummary(items, requestedLocale = 'en') {
  const language = requestedLocale.split('-')[0]
  const locale = [requestedLocale, language, 'en'].find((key) => Object.hasOwn(layouts, key))
  const labels = layouts[locale]
  const total = items.reduce((sum, item) => sum + item.quantity, 0)
  const heading = `<tr><th>${labels.item}</th><th>${labels.quantity}</th></tr>`
  const rows = items.map((item) =>
    `<tr><td>${escapeHtml(item.name)}</td><td>${item.quantity}</td></tr>`
  ).join('')
  return { locale, title: labels.title, total, body: `<table>${heading}${rows}</table>` }
}
