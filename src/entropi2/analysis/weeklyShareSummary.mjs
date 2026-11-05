import { addCalendarDays, calendarDay, calendarDaysBetween } from '../../calendarDate.js'
import { parseInputNumber } from '../../inputValues.js'
import { rpeOrigin } from '../../rpeEvidence.mjs'
import { isDayReceipt } from '../../mealEvidence.mjs'
import { adaptPublicContract } from './publicContract.mjs'
import { bestWeeklySet, MAIN_LIFTS } from './weekOverview.mjs'

const format = n => new Intl.NumberFormat('da-DK', { maximumFractionDigits: 1 }).format(n)
const date = day => `${day.slice(8, 10)}.${day.slice(5, 7)}.${day.slice(0, 4)}`
const list = value => Array.isArray(value) ? value : []
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const timestamp = /^\d{4}-\d{2}-\d{2}(?:$|T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$)/

function loggedDay(value, today, now) {
  if (typeof value !== 'string' || !timestamp.test(value)) return null
  const day = calendarDay(value)
  if (!day || day > today || (value.includes('T') && Date.parse(value) > new Date(now).getTime())) return null
  return day
}

function planFor(week, today) {
  const start = typeof week?.start_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(week.start_date)
    ? calendarDay(week.start_date) : null
  const age = start ? calendarDaysBetween(start, today) : null
  if (age === null || age < 0 || age > 6 || !Array.isArray(week.sessions)) return null
  const exercises = new Map(), sessions = []
  for (const session of week.sessions) {
    if (!Array.isArray(session?.exercises)) return null
    if (!session.exercises.length) continue
    const positions = []
    for (const ex of session.exercises) {
      if (!object(ex) || !['string', 'number'].includes(typeof ex.id) ||
          (typeof ex.id === 'string' ? !ex.id.trim() : !Number.isSafeInteger(ex.id)) ||
          exercises.has(ex.id) || !Number.isSafeInteger(ex.sets) || ex.sets <= 0) return null
      exercises.set(ex.id, ex)
      positions.push(ex)
    }
    sessions.push(positions)
  }
  return { start, exercises, sessions }
}

// A planned position owns retries, edits and undo. Conflicting observations are
// excluded, including conflicts in RPE/provenance that uniqueLogs does not track.
function confirmedRows(rows, plan, today, now) {
  const groups = new Map()
  for (const row of list(rows)) {
    if (!object(row)) continue
    const ex = plan.exercises.get(row.exercise_id)
    if (!ex || !Number.isSafeInteger(row.set_number) || row.set_number < 1 || row.set_number > ex.sets) continue
    const day = loggedDay(row.logged_at, today, now)
    if (!day || day < plan.start) continue
    const key = JSON.stringify([row.exercise_id, row.set_number])
    const group = groups.get(key) || []
    group.push(row); groups.set(key, group)
  }
  return [...groups.values()].flatMap(group => {
    const signatures = group.map(r => JSON.stringify([r.logged_at, r.weight, r.reps_completed,
      r.skipped ?? false, r._optimistic ?? false, r.rpe_actual, rpeOrigin(r)]))
    if (new Set(signatures).size !== 1 || group[0]._optimistic) return []
    return [group[0]]
  })
}

/**
 * Pure Danish share text; now is required (Date or zoned ISO timestamp).
 * Uses existing currentWeek/exerciseLogs/fremgangLogs/fremgangLoading and
 * historicalMealLogs snapshots. Arrays describe loaded snapshots; absent arrays
 * mean unknown. No fetching, callbacks, writes or implicit wall clock.
 * Completion follows the overview: all planned positions logged or skipped.
 * Tonnage includes valid non-skipped planned sets, including light/deload sets.
 * Best sets follow the existing heavy main-lift/e1RM rules. RPE is athlete-only.
 */
export function weeklyShareSummary(props = {}, now) {
  props = object(props) ? props : {}
  const validNow = now instanceof Date || (typeof now === 'string' && timestamp.test(now) && now.includes('T'))
  const today = validNow ? calendarDay(now) : null
  if (!today) return ''
  const plan = planFor(props.currentWeek, today)
  const monday = addCalendarDays(today, -((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7))
  const start = plan?.start ?? monday, end = addCalendarDays(start, 6)
  const loaded = !!plan && Array.isArray(props.exerciseLogs) && !props.exerciseLogsLoading && !props.exerciseLogsError
  const rows = loaded ? confirmedRows(props.exerciseLogs, plan, today, now) : []
  const done = plan?.sessions.filter(session => session.every(ex =>
    rows.filter(r => r.exercise_id === ex.id).length === ex.sets)).length
  const measured = rows.filter(r => !r.skipped).map(r => ({ row: r,
    weight: parseInputNumber(r.weight), reps: parseInputNumber(r.reps_completed) }))
    .filter(r => r.weight !== null && Number.isSafeInteger(r.reps) && r.reps > 0)
  let tonnage = 0
  for (const r of measured) tonnage += r.weight * r.reps
  const rpes = rows.filter(r => !r.skipped && rpeOrigin(r) === 'athlete')
    .map(r => parseInputNumber(r.rpe_actual)).filter(r => r !== null && r <= 10)
  const meanRpe = rpes.reduce((sum, r) => sum + r / rpes.length, 0)
  // Supply the de-duplicated local snapshot; never revive undone saved rows for
  // current exercise IDs. The existing adapter owns heavy-set eligibility.
  const contract = adaptPublicContract({ ...props, exerciseLogs: loaded ? rows : undefined }, now)
  const best = plan && loaded && !contract.loading && contract.historyReady
    ? MAIN_LIFTS.flatMap(lift => {
      const row = bestWeeklySet(contract.rows, lift, start, end)
      return row && Number.isFinite(row.value)
        ? [`${lift} ${format(row.weight)} kg × ${format(row.reps_completed)} (${format(row.value)} kg e1RM)`] : []
    }) : []
  const meals = Array.isArray(props.historicalMealLogs) && !props.mealLoading && !props.mealError ? new Set(props.historicalMealLogs
    .filter(r => object(r) && !r._optimistic && !isDayReceipt({ meal: typeof r.meal === 'string' ? r.meal.trimStart() : r.meal }) &&
      typeof r.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.date) && calendarDay(r.date) &&
      r.date >= start && r.date <= today && parseInputNumber(r.kcal) !== null)
    .map(r => r.date)).size : null
  const lines = [
    loaded && rows.length > 0 ? `Pas gennemført: ${done} af ${plan.sessions.length} planlagt.` : null,
    measured.length > 0 && Number.isFinite(tonnage)
      ? `Tonnage: ${format(tonnage)} kg${measured.length < rows.filter(r => !r.skipped).length ? ' (kun gyldige sæt)' : ''}.` : null,
    best.length && !props.fremgangError ? `Bedste sæt: ${best.join('; ')}.` : null,
    rpes.length ? `Gennemsnitlig RPE: ${format(meanRpe)} (${rpes.length} atletregistreringer).` : null,
    meals > 0 ? `Kostdage logget: ${meals} af 7.` : null,
  ].filter(Boolean)
  if (!lines.length) return ''
  return [
    `Ugesammendrag ${date(start)} til ${date(end)}`,
    ...lines,
    'Ugen kan være ufuldstændig. Pas tæller loggede eller oversprungne sæt; kostdage er dage med en log, ikke nødvendigvis hele kostdage.',
  ].join('\n')
}
