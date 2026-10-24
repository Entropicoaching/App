// Decimal input is ungrouped; comma and dot are alternative decimal separators.
export function parseInputNumber(value, empty = null) {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const text = String(value).trim()
  if (!text) return empty
  if (!/^[+]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:e[+-]?\d+)?$/i.test(text)) return null
  const number = Number(text.replace(',', '.'))
  return Number.isFinite(number) && number >= 0 ? number : null
}

export function roundNutrition(value) {
  if (!Number.isFinite(value) || value < 0) return null
  const whole = Math.trunc(value)
  const fraction = value - whole
  // A fixed tolerance repairs scaling noise without growing with the input.
  return fraction > 0 && fraction < 0.5 && 0.5 - fraction <= Number.EPSILON * 1024
    ? whole + 1 : Math.round(value)
}

export function nutritionValues(values, factor = 1) {
  if (!Number.isFinite(factor) || factor < 0) return null
  const result = {}
  for (const key of ['kcal', 'protein', 'carb', 'fat']) {
    const value = parseInputNumber(values[key] ?? '', 0)
    if (value === null) return null
    const rounded = roundNutrition(value * factor)
    if (rounded === null) return null
    result[key] = rounded
  }
  return result
}

// Display totals saturate at the largest finite number. Writes never saturate.
export function finiteTotal(rows, key) {
  return rows.reduce((sum, row) => {
    const value = parseInputNumber(row[key], 0) ?? 0
    return sum > Number.MAX_VALUE - value ? Number.MAX_VALUE : sum + value
  }, 0)
}

export function calendarTime(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const time = Date.parse(value + 'T00:00:00Z')
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time : null
}
