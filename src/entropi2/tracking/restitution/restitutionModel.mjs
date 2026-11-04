import { calendarDay, addCalendarDays } from '../../../calendarDate.js'
import { parseInputNumber } from '../../../inputValues.js'

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const identity = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 160
const day = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && calendarDay(value) === value
const timestamp = /^\d{4}-\d{2}-\d{2}(?:$|T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$)/
const fields = ['sleep_hours', 'energy', 'stress', 'soreness_level']
const mean = values => values.length ? values.sort((a, b) => a - b).reduce((sum, n) => sum + n, 0) / values.length : null

function dailyBasis(rows, from, to) {
  const seen = new Set(), values = Object.fromEntries(fields.map(field => [field, []]))
  let invalidMeasurements = 0, latestCompleteDate = null
  for (const row of rows) {
    if (!day(row.logged_date)) throw Error('Invalid day')
    if (row.logged_date < from || row.logged_date > to || row._optimistic) continue
    if (seen.has(row.logged_date)) throw Error('Ambiguous daily entry')
    seen.add(row.logged_date)
    let complete = true
    for (const field of fields) {
      const raw = row[field]
      const valid = typeof raw === 'number' && Number.isFinite(raw)
        && (field === 'sleep_hours' ? raw >= 0 && raw <= 24 : Number.isInteger(raw) && raw >= 1 && raw <= 5)
      if (valid) values[field].push(raw)
      else {
        complete = false
        if (raw !== null && raw !== undefined) invalidMeasurements++
      }
    }
    if (complete && (!latestCompleteDate || row.logged_date > latestCompleteDate)) latestCompleteDate = row.logged_date
  }
  return { metrics: Object.fromEntries(fields.map(field => [field, {
    count: values[field].length, average: values[field].length >= 4 ? mean(values[field]) : null,
  }])), latestCompleteDate, invalidMeasurements }
}

// Project only the production fields used for kg x completed reps. IDs are
// internal deduplication keys, never output. An ambiguous set taints the load
// comparison instead of silently turning a missing/invalid set into zero.
function trainingBasis(rows, from, split, to) {
  const candidates = [], byId = new Map(), byPosition = new Map()
  const add = (map, key, signature) => {
    if (!map.has(key)) map.set(key, new Set())
    map.get(key).add(signature)
  }
  for (const row of rows) {
    if (typeof row.logged_at !== 'string' || !timestamp.test(row.logged_at)
      || !calendarDay(row.logged_at)) throw Error('Invalid training day')
    const date = calendarDay(row.logged_at)
    // Validate identity conflicts across the whole supplied snapshot, before
    // dates/skip/pending are filtered. An old or future copy cannot win.
    const projected = { id: row.id, exercise_id: row.exercise_id, set_number: row.set_number,
      logged_at: row.logged_at, weight: row.weight, reps_completed: row.reps_completed,
      skipped: row.skipped ?? false, pending: row._optimistic ?? false }
    const hasPosition = identity(projected.exercise_id)
      && Number.isSafeInteger(projected.set_number) && projected.set_number > 0
    const identified = identity(projected.id) && hasPosition
    const signature = JSON.stringify(projected)
    const position = JSON.stringify([projected.exercise_id, projected.set_number])
    if (identity(projected.id)) add(byId, projected.id, signature)
    if (hasPosition) add(byPosition, position, signature)
    candidates.push({ projected, identified, signature, position, date })
  }
  const buckets = [
    { from, to: addCalendarDays(split, -1), sets: 0, recordedDays: 0, tonnage: 0 },
    { from: split, to, sets: 0, recordedDays: 0, tonnage: 0 },
  ]
  const dates = [new Set(), new Set()], seen = new Set()
  let excludedSets = 0, uncertainSets = 0
  candidates.sort((a, b) => a.signature < b.signature ? -1 : a.signature > b.signature ? 1 : 0)
  for (const { projected: row, identified, signature, position, date } of candidates) {
    if (date < from || date > to) continue
    const conflict = identified && (byId.get(row.id).size !== 1 || byPosition.get(position).size !== 1)
    if (conflict || !identified) { uncertainSets++; continue }
    if (row.skipped || row.pending) { excludedSets++; continue }
    if (seen.has(signature)) continue
    seen.add(signature)
    const index = date < split ? 0 : 1, bucket = buckets[index]
    bucket.sets++
    dates[index].add(date)
    const kg = parseInputNumber(row.weight), reps = parseInputNumber(row.reps_completed)
    const tonnage = kg !== null && kg >= 0 && Number.isSafeInteger(reps) && reps > 0 ? kg * reps : NaN
    if (!Number.isFinite(tonnage) || !Number.isFinite(bucket.tonnage + tonnage)) uncertainSets++
    else bucket.tonnage += tonnage
  }
  buckets.forEach((bucket, index) => {
    bucket.recordedDays = dates[index].size
    // No recorded sets is unknown, not a confirmed rest week.
    if (uncertainSets || bucket.sets === 0) bucket.tonnage = null
  })
  const [previous, recent] = buckets
  const ratio = previous.recordedDays >= 2 && recent.recordedDays >= 2
    && previous.tonnage > 0 && recent.tonnage !== null ? recent.tonnage / previous.tonnage : null
  return { previous, recent, ratio: Number.isFinite(ratio) ? ratio : null, excludedSets, uncertainSets }
}

/** Unwired, pure leaf; OFF returns before accessing the snapshot.
 * Complete, single-athlete production-shaped snapshots only. endDate is the
 * last completed Copenhagen day, supplied explicitly by the host. No IO/clock,
 * score inference, causation, medical interpretation or program decisions.
 */
export function buildRestitution(snapshot, options = {}) {
  if (options?.enabled !== true) return null
  try {
    if (!object(snapshot)) return { status: 'error' }
    if (snapshot.status === 'loading') return { status: 'loading' }
    if (snapshot.status !== 'ready' || snapshot.complete !== true || snapshot.dailySource !== 'readiness_logs'
      || !identity(snapshot.athleteId) || !day(snapshot.endDate)) return { status: 'error' }
    const { readinessRows, exerciseLogs, endDate, athleteId } = snapshot
    if ([readinessRows, exerciseLogs].some(rows => !Array.isArray(rows) || rows.length > 10000
      || !Array.from(rows).every(row => object(row) && row.athlete_id === athleteId))) return { status: 'error' }
    const from = addCalendarDays(endDate, -13), recentFrom = addCalendarDays(endDate, -6)
    if (!from || !recentFrom) return { status: 'error' }
    const daily = dailyBasis(readinessRows, recentFrom, endDate)
    const load = trainingBasis(exerciseLogs, from, recentFrom, endDate)
    const enoughDaily = fields.every(field => daily.metrics[field].average !== null)
    const fresh = daily.latestCompleteDate !== null && daily.latestCompleteDate >= addCalendarDays(endDate, -1)
    const basis = { from, to: endDate, recentFrom, ...daily, load, fresh }
    if (!enoughDaily || !fresh || load.ratio === null) return { status: 'insufficient', level: null, ...basis }
    const { sleep_hours: sleep, energy, stress, soreness_level: soreness } = daily.metrics
    // Simple product heuristics, not validated measures of recovery. Higher
    // recorded tonnage alone can cap 'god' at 'ok', never imply 'lav'.
    const low = sleep.average < 6 || energy.average <= 2 || stress.average >= 4 || soreness.average >= 4
    const good = sleep.average >= 7 && energy.average >= 4 && stress.average <= 2
      && soreness.average <= 2 && load.ratio <= 1.2
    const level = low ? 'lav' : good ? 'god' : 'ok'
    return { status: 'ready', level, ...basis }
  } catch {
    return { status: 'error' }
  }
}
