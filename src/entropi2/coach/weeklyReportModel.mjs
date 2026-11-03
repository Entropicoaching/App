import { adaptCoachState, hasUndatedPlannedWeek } from './coachModel.mjs'
import { activityDay } from '../../dashboard/coachInactive.mjs'
import { parseInputNumber } from '../../athlete/kostNumbers.mjs'

const ordinal = day => Date.parse(day + 'T00:00:00Z') / 86400000
const civil = day => typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day) && activityDay(day) === day
const id = value => typeof value === 'string' && value.trim().length > 0
const scope = values => Array.isArray(values) && values.every(id) && new Set(values).size === values.length

// Same receipt and meal rules as coachNutrition; no four-day display threshold.
// Unknown batches never become zero logged days. Confirmation rows are metadata.
function nutritionDays(props, data) {
  const result = new Map(), source = props.coachNutrition, context = props.readContext
  if (!data.rosterReady || !civil(data.day) || !scope(context?.athleteIds) ||
    source?.coachId !== context.coachId || source.day !== data.day ||
    !scope(source.athleteIds) || source.athleteIds.length !== context.athleteIds.length ||
    !context.athleteIds.every(a => source.athleteIds.includes(a)) ||
    source.state !== 'ready' || source.complete !== true || !civil(source.from) ||
    ordinal(source.from) !== ordinal(data.day) - 6 || source.through !== data.day ||
    !Array.isArray(source.rows) || !Array.isArray(source.targets)) return result
  const allowed = new Set(source.athleteIds), totals = new Map(), targets = new Map(), seen = new Set()
  for (const row of source.rows) {
    if (!allowed.has(row?.athlete_id) || !id(row.id) || seen.has(row.id) ||
      !civil(row.date) || row.date < source.from || row.date > data.day) return result
    seen.add(row.id)
    if (typeof row.meal === 'string' && row.meal.trimStart().startsWith('[appData2-day-v1]')) continue
    const protein = parseInputNumber(row.protein), kcal = parseInputNumber(row.kcal)
    if (typeof row.meal !== 'string' || !row.meal.trim() || protein === null || kcal === null) return result
    if (!totals.has(row.athlete_id)) totals.set(row.athlete_id, new Map())
    const days = totals.get(row.athlete_id), sum = days.get(row.date) || { protein: 0, kcal: 0 }
    sum.protein += protein; sum.kcal += kcal
    if (!Number.isFinite(sum.protein) || !Number.isFinite(sum.kcal)) return result
    days.set(row.date, sum)
  }
  for (const target of source.targets) {
    if (!allowed.has(target?.athlete_id) || targets.has(target.athlete_id)) return result
    targets.set(target.athlete_id, target)
  }
  for (const athlete of data.athletes) {
    const days = totals.get(athlete.id) || new Map()
    const goal = parseInputNumber(targets.get(athlete.id)?.protein_target)
    result.set(athlete.id, { logged: days.size, proteinGoal: goal > 0 ? goal : null,
      reached: goal > 0 ? [...days.values()].filter(d => d.protein + 1e-9 >= goal).length : null })
  }
  return result
}

function training(data, athlete) {
  const unknown = { start: null, planned: null, completed: null, rpe: null, rpeCount: 0 }
  const weeks = data.plans[athlete.id]
  if (!data.calendarReady || hasUndatedPlannedWeek(weeks)) return unknown
  const active = weeks.filter(w => civil(w.start_date) && w.start_date <= data.day &&
    ordinal(data.day) < ordinal(w.start_date) + 7)
  if (active.length !== 1) return unknown
  const week = active[0], planned = week.session_count
  const result = { ...unknown, start: week.start_date,
    planned: Number.isSafeInteger(planned) && planned >= 0 ? planned : null }
  if (!data.logs.complete) return result
  const rows = data.logs.rows.filter(r => r.athlete_id === athlete.id && r.skipped !== true &&
    activityDay(r.logged_at) >= week.start_date && activityDay(r.logged_at) <= data.day)
  const sessionId = row => row.exercises?.sessions?.id
  // A set is evidence of a logged session, not proof all prescribed sets finished.
  if (rows.some(row => !id(sessionId(row)))) return result
  result.completed = new Set(rows.map(sessionId)).size
  const latest = rows.slice().sort((a, b) => Date.parse(b.logged_at) - Date.parse(a.logged_at))[0]
  if (!latest) return result
  const values = rows.filter(row => sessionId(row) === sessionId(latest))
    .map(row => parseInputNumber(row.rpe_actual)).filter(value => value !== null && value <= 10)
  result.rpeCount = values.length
  result.rpe = values.length ? values.reduce((n, value) => n + value, 0) / values.length : null
  return result
}

// Uses only the existing, owner/day/roster-scoped state. Never reads athleteLogs
// from an open profile, whose receipt does not cover the coach roster.
export function weeklyReportModel(props = {}, today = new Date()) {
  const data = adaptCoachState(props, today), nutrition = nutritionDays(props, data)
  return { day: data.day, ready: data.rosterReady,
    rows: data.athletes.map(athlete => ({ athlete, training: training(data, athlete),
      nutrition: nutrition.get(athlete.id) ?? null })) }
}
