function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char])
}

export function renderRows(rows, labels) {
  const heading = `<tr><th>${labels.item}</th><th>${labels.quantity}</th></tr>`
  const body = rows.map((row) =>
    `<tr><td>${escapeHtml(row.name)}</td><td>${row.quantity}</td></tr>`
  ).join('')
  return `<table>${heading}${body}</table>`
}
