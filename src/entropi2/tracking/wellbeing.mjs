import { dayNumber, inWindow, requireId, windowEnding } from './trackingDates.mjs'

export const WELLBEING_FIELDS = Object.freeze({
  sleep_hours: [0, 24, false], sleep_quality: [1, 5, true],
  energy: [1, 5, true], stress: [1, 5, true], soreness_level: [1, 5, true], pain: [0, 10, true],
})

// Missing is null, never Number(null), an empty string or a guessed value.
function normalizeWellbeing(row) {
  requireId(row?.athlete_id)
  dayNumber(row.logged_date)
  const result = { athlete_id: row.athlete_id, logged_date: row.logged_date }
  for (const [field, [min, max, integer]] of Object.entries(WELLBEING_FIELDS)) {
    const value = row[field] ?? null
    if (value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value)))) throw new TypeError(`Invalid ${field}`)
    result[field] = value
  }
  for (const field of ['pain_location']) {
    const value = row[field] ?? null
    if (value !== null && (typeof value !== 'string' || !value.trim() || value.length > 120)) throw new TypeError(`Invalid ${field}`)
    result[field] = value
  }
  for (const field of ['pain']) {
    if ((result[field] > 0) !== (result[`${field}_location`] !== null)) throw new TypeError(`Location required exactly when ${field} > 0`)
  }
  if (Object.keys(WELLBEING_FIELDS).every(field => result[field] === null)) throw new TypeError('Empty daily entry')
  return result
}

const READINESS = ['sleep_hours', 'energy', 'stress', 'soreness_level']
const EXTRAS = ['sleep_quality', 'pain', 'pain_location']

// Payload for tracking_daily_v1 only. Readiness keeps its existing write path.
export function normalizeDailyExtras(row) {
  if ([...READINESS, 'soreness', 'soreness_location'].some(key => Object.hasOwn(row, key))) throw new TypeError('Readiness belongs in readiness_logs')
  const normalized = normalizeWellbeing(row)
  return Object.fromEntries(['athlete_id', 'logged_date', ...EXTRAS].map(key => [key, normalized[key]]))
}

export function summarizeWellbeing({ athleteId, weekEnd, rows = [], readiness = [] }) {
  requireId(athleteId)
  if (!Array.isArray(rows) || !Array.isArray(readiness)) throw new TypeError('Rows required')
  const window = windowEnding(weekEnd, 7)
  const byDate = new Map()
  for (const [source, fields, isExtras] of [[readiness, READINESS, false], [rows, EXTRAS, true]]) {
    const seen = new Set()
    for (const row of source) {
      if (row?.athlete_id !== athleteId) continue
      dayNumber(row.logged_date)
      if (!inWindow(row.logged_date, window)) continue
      if (seen.has(row.logged_date)) throw new TypeError('Conflicting daily entries; resolve at source')
      seen.add(row.logged_date)
      const selected = { athlete_id: athleteId, logged_date: row.logged_date }
      for (const field of fields) selected[field] = row[field] ?? null
      // No conversion between scales, no copied readiness fields in extras.
      const entry = isExtras ? normalizeDailyExtras(row) : normalizeWellbeing(selected)
      byDate.set(row.logged_date, { ...byDate.get(row.logged_date), ...Object.fromEntries(fields.map(field => [field, entry[field]])),
        athlete_id: athleteId, logged_date: row.logged_date })
    }
  }
  const daily = [...byDate.values()].map(normalizeWellbeing).sort((a, b) => a.logged_date.localeCompare(b.logged_date))
  const metrics = Object.fromEntries(Object.keys(WELLBEING_FIELDS).map(field => {
    const values = daily.filter(row => row[field] !== null)
    const n = values.length
    return [field, { status: n >= 4 ? 'ready' : 'insufficient', observedDays: n, expectedDays: 7,
      mean: n >= 4 ? values.reduce((sum, row) => sum + row[field], 0) / n : null }]
  }))
  const signals = []
  const add = (id, severity, reason, dates, values, threshold) => signals.push({ id, severity, reason, evidence: { ...window, dates, values, threshold } })
  for (const [field, threshold, direction, reason] of [
    ['sleep_hours', 6, 'below', 'Gennemsnitlig søvn under 6 timer'],
    ['sleep_quality', 2, 'atMost', 'Søvnkvalitet højst 2 af 5'],
    ['energy', 2, 'atMost', 'Energi højst 2 af 5'],
    ['stress', 4, 'atLeast', 'Stress mindst 4 af 5'],
    ['soreness_level', 4, 'atLeast', 'Ømhed mindst 4 af 5'],
  ]) {
    const m = metrics[field]
    if (m.status !== 'ready') continue
    const match = direction === 'below' ? m.mean < threshold : direction === 'atMost' ? m.mean <= threshold : m.mean >= threshold
    if (match) {
      const basis = daily.filter(row => row[field] !== null)
      add(field, 'attention', reason, basis.map(row => row.logged_date), basis.map(row => row[field]), { direction, value: threshold })
    }
  }
  // A severe pain report is actionable even with only one daily entry.
  const pain = daily.filter(row => row.pain >= 7)
  if (pain.length) add('pain', 'priority', 'Selvrapporteret smerte mindst 7 af 10; afklar før belastning øges',
    pain.map(row => row.logged_date), pain.map(row => ({ grade: row.pain, location: row.pain_location })), { direction: 'atLeast', value: 7 })
  return { window, observedDays: daily.length, metrics, signals }
}
