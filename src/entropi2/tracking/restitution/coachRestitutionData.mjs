import { addCalendarDays, calendarDay } from '../../../calendarDate.js'
import { buildRestitution } from './restitutionModel.mjs'

export const RESTITUTION_READ_CAP = 1000
const identity = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 160
const day = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && calendarDay(value) === value
export const validRestitutionScope = scope => identity(scope?.coachId) && identity(scope?.athleteId) &&
  day(scope?.asOf) && !!addCalendarDays(scope.asOf, -14)
const fields = ['sleep_hours', 'energy', 'stress', 'soreness_level']
const validMeasure = (row, field) => typeof row[field] === 'number' && Number.isFinite(row[field]) &&
  (field === 'sleep_hours' ? row[field] >= 0 && row[field] <= 24
    : Number.isInteger(row[field]) && row[field] >= 1 && row[field] <= 5)

// Legacy arrays establish presence only, never a complete analysis snapshot.
// OFF short-circuits before inspecting identities, rows or the client.
export function hasRestitutionData(props = {}) {
  if (props.enabled !== true || !validRestitutionScope(props)) return false
  return hasRestitutionRows(props, addCalendarDays(props.asOf, -1))
}

// Also used after model validation to hide a successful, authoritatively empty read.
export function hasRestitutionRows(props, to) {
  const from = addCalendarDays(to, -13)
  const recentFrom = addCalendarDays(to, -6)
  return Array.isArray(props.readinessRows) && props.readinessRows.some(row =>
    row?.athlete_id === props.athleteId && !row._optimistic && day(row.logged_date) &&
    row.logged_date >= recentFrom && row.logged_date <= to && fields.some(field => validMeasure(row, field))) &&
    Array.isArray(props.exerciseLogs) && props.exerciseLogs.some(row => {
      if (row?.athlete_id !== props.athleteId || row._optimistic || row.skipped ||
        typeof row.logged_at !== 'string') return false
      const date = calendarDay(row.logged_at)
      return date !== null && date >= from && date <= to
    })
}

const sources = [
  ['readiness_logs', 'athlete_id, logged_date, sleep_hours, energy, stress, soreness_level', 'logged_date'],
  ['exercise_logs', 'athlete_id, id, exercise_id, set_number, logged_at, weight, reps_completed, skipped', 'logged_at'],
]

// Existing authorized client only; no new schema, writes, notes or cycle data.
// At the cap completeness is unknown, so no partial status is calculated.
export async function readCoachRestitution(client, scope) {
  if (!validRestitutionScope(scope) || !client) return { status: 'error' }
  const endDate = addCalendarDays(scope.asOf, -1), from = addCalendarDays(endDate, -13)
  try {
    const rows = await Promise.all(sources.map(async ([table, columns, date]) => {
      let query = client.from(table).select(columns).eq('athlete_id', scope.athleteId)
      // Overfetch UTC boundaries; the model applies exact Copenhagen days.
      query = table === 'exercise_logs'
        ? query.gte(date, `${addCalendarDays(from, -1)}T00:00:00Z`).lt(date, `${scope.asOf}T00:00:00Z`)
        : query.gte(date, from).lte(date, endDate)
      const result = await query.order(date).limit(RESTITUTION_READ_CAP)
      if (result?.error || !Array.isArray(result?.data) || result.data.length >= RESTITUTION_READ_CAP)
        throw Error('Incomplete source')
      return result.data.map(row => Object.fromEntries(columns.split(', ').map(key => [key,
        key === 'id' && Number.isSafeInteger(row?.[key]) ? String(row[key]) : row?.[key]])))
    }))
    const snapshot = { status: 'ready', complete: true, dailySource: 'readiness_logs',
      athleteId: scope.athleteId, endDate, readinessRows: rows[0], exerciseLogs: rows[1] }
    return buildRestitution(snapshot, { enabled: true }).status === 'error' ? { status: 'error' } : snapshot
  } catch {
    return { status: 'error' }
  }
}

export function selectCoachRestitution(result, client, scope, attempt) {
  return validRestitutionScope(scope) && result?.client === client && result?.coachId === scope.coachId &&
    result?.athleteId === scope.athleteId && result?.asOf === scope.asOf && result?.attempt === attempt
    ? result.snapshot : null
}

export function startCoachRestitution({ enabled, client, scope, attempt }, onResult) {
  if (enabled !== true || !validRestitutionScope(scope) || !client) return undefined
  let current = true
  readCoachRestitution(client, scope).then(snapshot => {
    if (current) onResult({ client, ...scope, attempt, snapshot })
  })
  return () => { current = false }
}
