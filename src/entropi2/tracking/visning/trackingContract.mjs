/** Display boundary for one already-authorized athlete. No raw logs or identity.
 * TRACK producers own aggregation, windows, targets and signal thresholds.
 * See ADAPTER.md for the complete v1 contract and missing-data semantics.
 */
export const TRACKING_VIEW_VERSION = 1
const number = value => typeof value === 'number' && Number.isFinite(value) && value >= 0
const text = value => typeof value === 'string' && value.trim().length > 0
export function isDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}
const nullableNumber = value => value === null || number(value)
const signalOK = signal => signal == null || (
  ['info', 'attention'].includes(signal.level) && text(signal.label) && text(signal.reason))
const daysApart = (a, b) => (Date.parse(b) - Date.parse(a)) / 86400000

function seriesOK(rows, fields, end, max, step) {
  return Array.isArray(rows) && rows.length <= max && Array.from(rows).every((row, i) =>
    row && isDay(row.day) && row.day <= end && daysApart(row.day, end) < max * step &&
    (!i || daysApart(rows[i - 1].day, row.day) === step) &&
    fields.every(field => nullableNumber(row[field])))
}

const validators = {
  load: (value, end) => text(value.unit) &&
    seriesOK(value.days, ['acute', 'chronic'], end, 28, 1),
  strength: (value, end) => Array.isArray(value.exercises) && value.exercises.length <= 20 &&
    new Set(value.exercises.map(e => e?.id)).size === value.exercises.length &&
    Array.from(value.exercises).every(e => e && text(e.id) && text(e.label) &&
      ['rising', 'falling', 'stable', 'unknown'].includes(e.trend) &&
      (e.plateau === null || typeof e.plateau === 'boolean') &&
      text(e.reason) && seriesOK(e.days, ['e1rmKg'], end, 28, 1) &&
      (e.days.some(d => number(d.e1rmKg)) || (e.trend === 'unknown' && e.plateau === null))),
  nutrition: (value, end) => seriesOK(value.weeks,
    ['proteinG', 'proteinGoalG', 'kcal', 'kcalGoal'], end, 4, 7) &&
    value.weeks.every(w => Number.isInteger(w.loggedDays) && w.loggedDays >= 0 && w.loggedDays <= 7 &&
      (w.loggedDays !== 0 || [w.proteinG, w.proteinGoalG, w.kcal, w.kcalGoal].every(v => v === null))),
  weight: (value, end) => seriesOK(value.days, ['kg', 'mean7Kg'], end, 28, 1) &&
    value.days.every(d => Number.isInteger(d.samples7) && d.samples7 >= 0 && d.samples7 <= 7 &&
      (d.samples7 !== 0 || (d.mean7Kg === null && d.kg === null))),
}

export function trackingViewModel(input) {
  const valid = input?.version === TRACKING_VIEW_VERSION && isDay(input.asOf)
  const cards = Object.fromEntries(Object.entries(validators).map(([key, validate]) => {
    const value = valid ? input[key] : null
    if (!value || value.state === 'missing') return [key, { state: 'missing' }]
    if (value.state !== 'ready' || !signalOK(value.signal) || !validate(value, input.asOf)) {
      return [key, { state: 'invalid' }]
    }
    return [key, value]
  }))
  return { asOf: valid ? input.asOf : null, ...cards }
}

/** Nulls split paths: never bridge unlogged days or silently replace with zero.
 * All lines share a scale; timestamps set the horizontal position.
 */
export function chartGeometry(rows, fields) {
  const values = rows.flatMap(row => fields.map(field => row[field])).filter(number)
  if (!values.length) return { paths: fields.map(() => ''), points: [], min: null, max: null }
  const min = Math.min(...values), max = Math.max(...values)
  const start = Date.parse(rows[0].day), end = Date.parse(rows.at(-1).day)
  const points = fields.map(field => rows.map(row => number(row[field]) ? {
    x: end === start ? 160 : 16 + (Date.parse(row.day) - start) / (end - start) * 288,
    y: max === min ? 48 : 80 - (row[field] - min) / (max - min) * 64,
  } : null))
  const paths = points.map(line => {
    let pen = false
    return line.map(point => {
      if (!point) { pen = false; return '' }
      const command = `${pen ? 'L' : 'M'}${point.x.toFixed(2)},${point.y.toFixed(2)}`
      pen = true
      return command
    }).filter(Boolean).join(' ')
  })
  return { paths, points, min, max }
}
