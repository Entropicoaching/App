import { calendarDay, addCalendarDays } from '../../calendarDate.js'
import { parseInputNumber } from '../../inputValues.js'
import { isDayReceipt } from '../../mealEvidence.mjs'
import { analysisSessions } from './analysisSnapshots.mjs'

const state = (rows, loading, error) => error ? 'error' : loading === true ? 'loading'
  : Array.isArray(rows) ? 'ready' : 'unavailable'
const source = (rows, loading, error) => ({ state: state(rows, loading, error), rows: rows ?? [] })
const list = rows => Array.isArray(rows) ? rows.filter(r => r && typeof r === 'object') : []
const identity = r => JSON.stringify(r.exercise_id != null && r.set_number != null
  ? ['position', r.exercise_id, r.set_number] : r.id != null ? ['id', r.id]
    : ['time', r.exercise_id, r.logged_at])

// Read-only bridge. Legacy history/meal arrays are already athlete-scoped by
// their host; explicit foreign ownership is still rejected. No IO or writes.
export function analysisMineData(props = {}, now) {
  const athleteId = props.athlete?.id, today = calendarDay(now)
  const owned = r => r.athlete_id == null || r.athlete_id === athleteId
  const confirmed = r => !r._optimistic && !r.pending && owned(r)
  const date = r => typeof r.logged_at === 'string' &&
    /^\d{4}-\d{2}-\d{2}(?:$|T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$)/.test(r.logged_at) &&
    (!r.logged_at.includes('T') || Date.parse(r.logged_at) <= new Date(now).getTime())
    ? calendarDay(r.logged_at) : null
  const exercises = list(props.currentWeek?.sessions).flatMap(s => list(s.exercises))
  const names = new Map(exercises.map(e => [e.id, e.name]))
  const localOwns = Array.isArray(props.exerciseLogs) && names.size > 0
  const history = list(props.fremgangLogs).filter(r => !localOwns || !names.has(r.exercise_id))
  const local = localOwns ? list(props.exerciseLogs).filter(r => names.has(r.exercise_id) &&
    date(r) && date(r) >= props.currentWeek.start_date && date(r) <= addCalendarDays(props.currentWeek.start_date, 6) && date(r) <= today)
    .map(r => ({ ...r, exercises: { name: names.get(r.exercise_id) } })) : []
  const raw = [...history, ...local].filter(owned)
  const pending = new Set(raw.filter(r => r._optimistic || r.pending).map(identity))
  const records = raw.filter(r => confirmed(r) && !pending.has(identity(r))).map(r => ({
    athlete_id: athleteId, id: identity(r), date: date(r),
    exerciseId: r.exercise_id == null ? null : String(r.exercise_id), exercise: r.exercises?.name,
    weightKg: r.skipped ? null : parseInputNumber(r.weight), reps: parseInputNumber(r.reps_completed),
  }))
  const recordSource = source(records, props.fremgangLoading, props.fremgangError)
  if (!Array.isArray(props.fremgangLogs)) recordSource.state = state(null, props.fremgangLoading, props.fremgangError)
  if (localOwns && (props.exerciseLogsLoading === true || props.exerciseLogsError))
    recordSource.state = props.exerciseLogsError ? 'error' : 'loading'
  const meals = list(props.historicalMealLogs).filter(r => confirmed(r) &&
    !isDayReceipt({ meal: typeof r.meal === 'string' ? r.meal.trimStart() : r.meal }) &&
    parseInputNumber(r.kcal) !== null).map(r => ({ athlete_id: athleteId, date: r.date }))
  const weights = list(props.weightLogs).filter(r => confirmed(r) && r.athlete_id === athleteId)
    .map(r => ({ athlete_id: athleteId, date: date(r), kg: parseInputNumber(r.weight) }))
  // The current program week supplies explicitly limited session coverage.
  // Explicit normalized snapshots may supply sources the legacy host lacks.
  // Host identity/date always win; MineData validates each row's athlete_id.
  return { athleteId, today,
    sessions: props.mineData?.sessions ?? analysisSessions(props, now),
    sessionsLabel: props.mineData?.sessions ? 'Pas gennemført' : 'Pas i den viste programuge',
    records: props.mineData?.records ?? recordSource,
    nutritionDays: props.mineData?.nutritionDays ?? source(meals,
      props.mealLoading, props.mealError),
    weights: props.mineData?.weights ?? source(weights, props.weightLoading, props.weightError),
    ...(!Array.isArray(props.historicalMealLogs) && !props.mineData?.nutritionDays
      ? { nutritionDays: { state: state(null, props.mealLoading, props.mealError), rows: [] } } : {}),
    ...(!Array.isArray(props.weightLogs) && !props.mineData?.weights
      ? { weights: { state: state(null, props.weightLoading, props.weightError), rows: [] } } : {}),
  }
}
