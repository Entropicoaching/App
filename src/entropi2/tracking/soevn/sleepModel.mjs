import { calendarDay, addCalendarDays } from '../../../calendarDate.js'
import { explicitRpe } from '../../../dataEnough.mjs'
import { estimatedOneRepMax, erTungtSaet, erDeloadLog, hovedloeftFamilie } from '../../../exerciseProgress.js'
import { exerciseSetView } from '../../../exerciseSetView.js'
import { parseInputNumber } from '../../../inputValues.js'

const error = () => ({ status: 'error' })
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const id = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 160
const day = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && calendarDay(value) === value
const timestamp = /^\d{4}-\d{2}-\d{2}(?:$|T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$)/
const mean = values => values.length ? values.reduce((sum, value) => sum + value / values.length, 0) : null
const measure = (value, min, max, integer = false) => typeof value === 'number'
  && Number.isFinite(value) && value >= min && value <= max && (!integer || Number.isInteger(value)) ? value : null

function sleepDays(rows, field, from, to) {
  const result = new Map()
  let invalidMeasurements = 0
  for (const row of rows) {
    if (!day(row.logged_date)) throw new TypeError('Invalid date')
    if (row.logged_date < from || row.logged_date > to || row._optimistic) continue
    // A duplicated daily answer is ambiguous even when the numeric values agree.
    if (result.has(row.logged_date)) throw new TypeError('Duplicate date')
    const raw = row[field]
    const value = field === 'sleep_hours' ? measure(raw, 0, 24) : measure(raw, 1, 5, true)
    if (raw !== null && raw !== undefined && value === null) invalidMeasurements++
    result.set(row.logged_date, value)
  }
  return { values: result, invalidMeasurements }
}

// Project only training fields used below. Never serialize whole input rows.
function projectSet(row) {
  const exercise = row.exercises
  return { id: row.id, exercise_id: row.exercise_id, set_number: row.set_number,
    session_id: row.session_id ?? exercise?.session_id ?? exercise?.sessions?.id,
    logged_at: row.logged_at, weight: row.weight, reps_completed: row.reps_completed,
    rpe_actual: row.rpe_actual, rpe: row.rpe, rpe_source: row.rpe_source, note: row.note,
    skipped: row.skipped ?? false, _optimistic: row._optimistic ?? false,
    exercises: { name: exercise?.name,
      sessions: { weeks: { block_name: exercise?.sessions?.weeks?.block_name } } } }
}

function training(rows, from, to) {
  const projected = rows.map(projectSet)
  const byId = new Map(), byPosition = new Map()
  const register = (map, key, signature) => {
    if (!map.has(key)) map.set(key, new Set())
    map.get(key).add(signature)
  }
  const candidates = projected.map(row => {
    if (typeof row.logged_at !== 'string' || !timestamp.test(row.logged_at)
      || !calendarDay(row.logged_at)) throw new TypeError('Invalid training date')
    const date = calendarDay(row.logged_at)
    const identified = id(row.id) && id(row.exercise_id) && id(row.session_id)
      && Number.isSafeInteger(row.set_number) && row.set_number > 0
    if (!identified || date < from || date > to) return null
    const signature = JSON.stringify(row)
    const position = JSON.stringify([row.exercise_id, row.set_number])
    register(byId, row.id, signature)
    register(byPosition, position, signature)
    return { row, date, signature, position }
  }).filter(Boolean)
  const seen = new Set(), sessions = new Map()
  let excludedSets = projected.length - candidates.length
  for (const { row, date, signature, position } of candidates) {
    if (byId.get(row.id).size !== 1 || byPosition.get(position).size !== 1
      || row.skipped || row._optimistic) { excludedSets++; continue }
    if (seen.has(signature)) continue
    seen.add(signature)
    const key = JSON.stringify([date, row.session_id])
    if (!sessions.has(key)) sessions.set(key, { date, key, ratings: [], lifts: new Map(), sets: 0 })
    const session = sessions.get(key)
    session.sets++
    if (explicitRpe(row)) session.ratings.push(row.rpe_actual ?? row.rpe)
    const name = row.exercises.name, reps = parseInputNumber(row.reps_completed)
    if (typeof name !== 'string' || !hovedloeftFamilie(name) || !Number.isSafeInteger(reps)
      || !erTungtSaet(name, reps) || erDeloadLog(row)) continue
    const estimate = estimatedOneRepMax(row.weight, reps)
    if (!(estimate > 0)) continue
    const lift = exerciseSetView(name).name
    session.lifts.set(lift, Math.max(session.lifts.get(lift) ?? 0, estimate))
  }
  // IDs are used only for grouping; the returned view model contains no IDs/notes.
  return { excludedSets, sessions: [...sessions.values()]
    .sort((a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key))
    .map(session => ({ date: session.date, sets: session.sets,
      rpe: mean(session.ratings), ratedSets: session.ratings.length,
      performance: [...session.lifts].sort(([a], [b]) => a.localeCompare(b))
        .map(([lift, e1rm]) => ({ lift, e1rm })) })) }
}

/** Pure, unwired leaf. Explicit complete, single-athlete snapshots only.
 * Hours: readiness_logs; quality: tracking_daily_v1 (existing 1..5 scale).
 * endDate is the caller's last completed Copenhagen date. weeks: integer 4..8.
 * No clock, writes, fetching, inference, correlations or training decisions.
 */
export function buildSleepOverview(snapshot, options = {}) {
  if (options?.enabled !== true) return null
  try {
    if (!object(snapshot)) return error()
    if (snapshot.status === 'loading') return { status: 'loading' }
    if (snapshot.status !== 'ready' || snapshot.complete !== true) return error()
    const weeks = options.weeks ?? 6
    if (!Number.isInteger(weeks) || weeks < 4 || weeks > 8 || !id(snapshot.athleteId)
      || !day(snapshot.endDate)) return error()
    const from = addCalendarDays(snapshot.endDate, 1 - weeks * 7)
    if (!from) return error()
    const { readinessRows, qualityRows, exerciseLogs } = snapshot
    if ([readinessRows, qualityRows, exerciseLogs].some(rows => !Array.isArray(rows)
      || rows.length > 10000 || !Array.from(rows).every(row => object(row)
        && row.athlete_id === snapshot.athleteId))) return error()
    const hours = sleepDays(readinessRows, 'sleep_hours', from, snapshot.endDate)
    const quality = sleepDays(qualityRows, 'sleep_quality', from, snapshot.endDate)
    const context = training(exerciseLogs, from, snapshot.endDate)
    const days = Array.from({ length: weeks * 7 }, (_, index) => {
      const date = addCalendarDays(from, index)
      return { date, hours: hours.values.get(date) ?? null, quality: quality.values.get(date) ?? null }
    })
    const summary = (days, field) => {
      const values = days.map(d => d[field]).filter(value => value !== null)
      return { count: values.length, average: values.length >= 4 ? mean(values) : null }
    }
    const periods = Array.from({ length: weeks }, (_, index) => {
      const part = days.slice(index * 7, index * 7 + 7)
      return { from: part[0].date, to: part.at(-1).date,
        hours: summary(part, 'hours'), quality: summary(part, 'quality') }
    })
    const sessions = context.sessions.map(session => {
      const sleep = days.find(d => d.date === session.date)
      return { ...session, hours: sleep.hours, quality: sleep.quality }
    })
    return { status: days.some(d => d.hours !== null || d.quality !== null) ? 'ready' : 'empty',
      from, to: snapshot.endDate, weeks: periods, days, sessions,
      pairedRpeDays: new Set(sessions.filter(s => s.hours !== null && s.rpe !== null).map(s => s.date)).size,
      pairedPerformanceDays: new Set(sessions.filter(s => s.hours !== null && s.performance.length).map(s => s.date)).size,
      excludedSets: context.excludedSets,
      invalidMeasurements: hours.invalidMeasurements + quality.invalidMeasurements }
  } catch {
    return error()
  }
}
