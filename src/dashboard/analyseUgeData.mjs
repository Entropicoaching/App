import { addCalendarDays } from '../calendarDate.js'
import { isDay } from '../entropi2/tracking/visning/trackingContract.mjs'

export const WEEK_READ_CAP = 1000
export const validWeekScope = ({ coachId, athleteId, asOf } = {}) =>
  typeof coachId === 'string' && coachId.trim().length > 0 &&
  typeof athleteId === 'string' && athleteId.trim().length > 0 && isDay(asOf)

const fields = {
  training: ['exercise_logs', 'id, athlete_id, exercise_id, set_number, logged_at, weight, reps_completed, skipped', 'logged_at'],
  nutrition: ['meal_logs', 'id, athlete_id, date, meal, kcal, protein', 'date'],
  weight: ['weight_logs', 'id, athlete_id, logged_at, weight', 'logged_at'],
  readiness: ['readiness_logs', 'id, athlete_id, logged_date, readiness_score, sleep_hours, energy, stress', 'logged_date'],
}

// Own scoped reads: never infer completeness from the legacy graph arrays.
// No mutation API, cycle columns, current goals copied backwards or raw errors.
export async function readAnalyseWeek(client, scope) {
  if (!validWeekScope(scope)) return null
  const { coachId, athleteId, asOf } = scope
  const from = addCalendarDays(asOf, -27)
  const sources = Object.fromEntries(await Promise.all(Object.entries(fields).map(async ([domain, [table, columns, date]]) => {
    const base = { athleteId }
    try {
      let query = client.from(table).select(columns).eq('athlete_id', athleteId)
      // UTC bounds deliberately overfetch Danish midnight; downstream models
      // apply their own calendar-day cutoff. Date columns need no conversion.
      query = domain === 'training'
        ? query.gte(date, `${addCalendarDays(from, -1)}T00:00:00Z`).lt(date, `${addCalendarDays(asOf, 1)}T00:00:00Z`)
        : query.gte(date, from).lte(date, asOf)
      const result = await query.order(date).order('id').limit(WEEK_READ_CAP)
      if (result?.error || !Array.isArray(result?.data)) return [domain, { ...base, state: 'error', complete: false }]
      if (result.data.length >= WEEK_READ_CAP) return [domain, { ...base, state: 'partial', complete: false }]
      // Reject unexpected identities rather than exposing an unrelated row.
      if (result.data.some(row => !row || row.athlete_id !== athleteId)) return [domain, { ...base, state: 'error', complete: false }]
      const rows = result.data.map(row => Object.fromEntries(columns.split(', ').map(key => [key,
        key === 'id' && typeof row[key] === 'number' ? String(row[key]) : row[key]])))
      return [domain, { ...base, state: 'ready', complete: true, rows }]
    } catch {
      return [domain, { ...base, state: 'error', complete: false }]
    }
  })))
  return { coachId, athleteId, asOf, sources }
}

export function analyseWeekSnapshot(batch) {
  if (!batch) return { state: 'loading' }
  if (Object.values(batch.sources).some(source => source.state !== 'ready' || source.complete !== true)) return { state: 'error' }
  return { state: 'ready', complete: true, athleteId: batch.athleteId, asOf: batch.asOf,
    daily: batch.sources.readiness.rows.map(row => ({ day: row.logged_date, source: 'athlete_manual',
      sleepHours: row.sleep_hours, energy: row.energy, stress: row.stress })),
    weightDays: batch.sources.weight.rows.map(row => ({ day: row.logged_at, kg: row.weight })),
    // Missing evidence stays unknown, not empty: no confirmed rest days,
    // 84-day variant history, dated nutrition targets or completed-set proof.
  }
}

// Synchronous stale-result guard, including before effect cleanup has run.
export function selectAnalyseWeek(result, enabled, client, scope, attempt) {
  if (enabled !== true || !validWeekScope(scope)) return null
  return result?.client === client && result?.attempt === attempt && result?.coachId === scope.coachId &&
    result?.athleteId === scope.athleteId && result?.asOf === scope.asOf ? result.batch : null
}

export function startAnalyseWeek({ enabled, client, scope, attempt }, onResult) {
  if (enabled !== true || !validWeekScope(scope) || !client) return undefined
  let current = true
  readAnalyseWeek(client, scope).then(batch => {
    if (current) onResult({ client, attempt, ...scope, batch })
  })
  return () => { current = false }
}
