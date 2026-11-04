// Calendar dates are athlete-local dates supplied by the adapter, never UTC slices.
export function dayNumber(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) throw new TypeError('Invalid calendar date')
  const milliseconds = Date.parse(`${value}T00:00:00Z`)
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString().slice(0, 10) !== value) throw new TypeError('Invalid calendar date')
  return milliseconds / 86400000
}

export function windowEnding(end, days) {
  const last = dayNumber(end)
  if (!Number.isInteger(days) || days < 1 || days > 366) throw new TypeError('Invalid window')
  const from = new Date((last - days + 1) * 86400000).toISOString().slice(0, 10)
  dayNumber(from)
  return { from, to: end, days }
}

export function requireId(id) {
  if (typeof id !== 'string' || !id.trim()) throw new TypeError('Identity required')
  return id
}

export function inWindow(date, window) {
  dayNumber(date)
  return date >= window.from && date <= window.to
}
