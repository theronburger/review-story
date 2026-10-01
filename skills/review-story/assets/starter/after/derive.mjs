export function deriveSummary(items) {
  for (const item of items) {
    if (!Number.isFinite(item.quantity) || item.quantity < 0) {
      throw new RangeError('Quantity must be a finite, non-negative number')
    }
  }
  return {
    rows: items.map(({ name, quantity }) => ({ name, quantity })),
    total: items.reduce((sum, item) => sum + item.quantity, 0),
  }
}
