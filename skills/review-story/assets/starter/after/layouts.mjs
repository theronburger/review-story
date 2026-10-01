const layouts = {
  en: { title: 'Stock summary', item: 'Item', quantity: 'Quantity' },
  fr: { title: 'Résumé du stock', item: 'Article', quantity: 'Quantité' },
}

export function selectLayout(requestedLocale) {
  const language = requestedLocale.split('-')[0]
  const locale = [requestedLocale, language, 'en'].find((key) => Object.hasOwn(layouts, key))
  return { locale, labels: layouts[locale] }
}
