import { addCalendarDays, calendarDay } from '../../../calendarDate.js'
import { parseInputNumber } from '../../../inputValues.js'
import { isDayReceipt } from '../../../mealEvidence.mjs'
import { adaptPublicContract } from '../publicContract.mjs'
import { bestWeeklySet, MAIN_LIFTS, weekOverview } from '../weekOverview.mjs'

export const formatReportNumber = n => new Intl.NumberFormat('da-DK', { maximumFractionDigits: 1 }).format(n)
const date = day => day.split('-').reverse().join('.')
const timestamp = /^\d{4}-\d{2}-\d{2}(?:$|T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$)/
const arrayReady = (rows, loading, error) => Array.isArray(rows) && loading !== true && !error

// Pending retries must not be collapsed into a confirmed row by uniqueLogs.
function withoutPending(rows) {
  if (!Array.isArray(rows)) return undefined
  const key = r => r?.exercise_id != null && r?.set_number != null
    ? JSON.stringify([r.exercise_id, r.set_number]) : r?.id != null ? `id:${r.id}`
      : JSON.stringify([r?.exercise_id, r?.logged_at])
  const pending = new Set(rows.filter(r => r?._optimistic).map(key))
  return rows.filter(r => r && !pending.has(key(r)))
}

function weightChange(props, start, today, now) {
  const empty = message => ({ delta: null, days: null, message })
  if (!arrayReady(props.weightLogs, props.weightLoading, props.weightError) || props.athlete?.id == null)
    return empty('Vægtdata er ikke klar.')
  const days = new Map()
  for (const row of props.weightLogs) {
    if (!row || row.athlete_id !== props.athlete.id || row._optimistic ||
        typeof row.logged_at !== 'string' || !timestamp.test(row.logged_at)) continue
    const day = calendarDay(row.logged_at), weight = parseInputNumber(row.weight)
    if (!day || day < start || day > today || !(weight > 0) ||
        (row.logged_at.includes('T') && Date.parse(row.logged_at) > new Date(now).getTime())) continue
    if (!days.has(day)) days.set(day, new Set())
    days.get(day).add(weight)
  }
  // Conflicting same-day values are unknown; never select an arbitrary winner.
  const measured = [...days].filter(([, values]) => values.size === 1)
    .map(([day, values]) => ({ date: day, weight: [...values][0] }))
    .sort((a, b) => a.date.localeCompare(b.date))
  if (measured.length < 2) return { delta: null, days: measured.length,
    message: 'Vægtændring kræver mindst to entydige vejedage i ugen.' }
  const first = measured[0], last = measured.at(-1)
  const raw = last.weight - first.weight
  // Avoid multiplication overflow; Intl rounds only for display.
  const delta = Math.abs(raw) < 0.05 ? 0 : raw
  return { delta, days: measured.length, first, last,
    message: `Fra ${formatReportNumber(first.weight)} kg den ${date(first.date)} til ${formatReportNumber(last.weight)} kg den ${date(last.date)}. Observeret forskel, ikke en vægttrend.` }
}

/** Pure read-only snapshot. Required now: Date or zoned ISO timestamp.
 * Same week as the existing overview: active program week, otherwise Mon–Sun.
 * Arrays mean loaded snapshots; missing/loading/error means unknown, never zero.
 * historicalMealLogs must already belong to this athlete (same public contract).
 * weightLogs are additionally filtered by athlete.id. No queries or callbacks.
 */
export function weeklyReportModel(props = {}, now) {
  const validNow = now instanceof Date || (typeof now === 'string' && timestamp.test(now) && now.includes('T'))
  const today = validNow ? calendarDay(now) : null
  if (!today) return { ready: false, message: 'Ugens dato mangler eller er ugyldig.' }
  const exerciseReady = arrayReady(props.exerciseLogs, props.exerciseLogsLoading, props.exerciseLogsError)
  const historyReady = arrayReady(props.fremgangLogs, props.fremgangLoading, props.fremgangError)
  const contract = adaptPublicContract({ ...props,
    exerciseLogs: exerciseReady ? withoutPending(props.exerciseLogs) : undefined,
    fremgangLogs: historyReady ? withoutPending(props.fremgangLogs) : undefined,
  }, now)
  const start = contract.activeWeek ? contract.start
    : addCalendarDays(today, -((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7))
  const end = addCalendarDays(start, 6)
  const overview = weekOverview(contract, now)
  const liftDataReady = historyReady && !(contract.activeWeek &&
    (props.exerciseLogsLoading === true || props.exerciseLogsError))
  const lifts = MAIN_LIFTS.map(lift => {
    const best = liftDataReady && bestWeeklySet(contract.rows, lift, start, today)
    return { lift, value: best && Number.isFinite(best.value) ? best.value : null,
      message: !liftDataReady ? 'Løftehistorik er ikke klar.' : !best || !Number.isFinite(best.value)
        ? 'Ingen sammenlignelige tunge sæt denne uge.'
        : `Fra ${formatReportNumber(best.weight)} kg × ${best.reps_completed} den ${date(best.logged_at)}.` }
  })
  const mealsReady = arrayReady(props.historicalMealLogs, props.mealLoading, props.mealError)
  const mealDays = mealsReady ? new Set(props.historicalMealLogs.filter(row => row && !row._optimistic &&
    !isDayReceipt({ meal: typeof row.meal === 'string' ? row.meal.trimStart() : row.meal }) &&
    typeof row.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(row.date) && calendarDay(row.date) &&
    row.date >= start && row.date <= today && parseInputNumber(row.kcal) !== null).map(row => row.date)).size : null
  return { ready: true, start, end, today, period: `${date(start)} til ${date(end)}`,
    sessions: overview.sessions, sessionNote: overview.note,
    lifts, mealDays, weight: weightChange(props, start, today, now),
    note: 'Ugen kan være ufuldstændig. Kostdage er dage med en kostlog, ikke nødvendigvis hele kostdage. e1RM er beregnet enrepetitionsmaksimum fra tunge sæt; deload, taper og aflastning er udeladt.' }
}
