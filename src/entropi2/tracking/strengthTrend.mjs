import { estimatedOneRepMax, erTungtSaet, erDeloadLog } from '../../exerciseProgress.js'
import { exerciseSetView } from '../../exerciseSetView.js'
import { erHovedloeft } from '../../exerciseNames.js'
import { isMainLift } from '../../warmup.js'
import { calendarDay, addCalendarDays } from '../../calendarDate.js'

const MAIN = ['Squat', 'Bænkpres', 'Dødløft', 'Sumo dødløft']
const monday = day => {
  const weekday = (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7
  return addCalendarDays(day, -weekday)
}

// Ordinary least squares, kg per calendar week. Gaps keep their real distance.
function slope(weeks) {
  const points = weeks.map((w, x) => ({ x, y: w.e1rm })).filter(p => p.y !== null)
  if (points.length < 4) return null
  // Scale first so finite (even extreme) estimates do not overflow the sum.
  const scale = Math.max(...points.map(p => p.y))
  const xMean = points.reduce((s, p) => s + p.x, 0) / points.length
  const yMean = points.reduce((s, p) => s + p.y / scale, 0) / points.length
  const numerator = points.reduce((s, p) => s + (p.x - xMean) * (p.y / scale - yMean), 0)
  const denominator = points.reduce((s, p) => s + (p.x - xMean) ** 2, 0)
  const result = numerator / denominator * scale
  return Number.isFinite(result) ? result : null
}

/**
 * Pure, unwired read model. Pass logs for ONE athlete and explicit today.
 * Input: {logged_at, exercises:{name,sessions:{weeks:{block_name}}},
 *         weight, reps_completed, skipped}; name/reps are optional flat aliases.
 * Dates/timestamps use the existing Copenhagen calendarDay convention.
 * Twelve Monday-based weeks include the current, provisional week. Missing = null.
 * Only completed weeks enter slope/signals. Slope needs >=4 observed weeks;
 * signals need all four most recent completed weeks. No interpolation/carry.
 * Plateau = no new weekly high in the three weeks following the first of four.
 * Drop = latest weekly best >5% below the best in those four weeks (strict).
 * Existing main-lift recognition admits variants; normalized variants remain
 * separate series, including sumo. Accessory/overhead lifts are excluded.
 * Invalid today/log collection returns null; insufficient per-lift data keeps
 * that lift's statistics null. No input mutation, flags, storage or I/O.
 */
export function buildStrengthTrend(logs, { today } = {}) {
  if (!Array.isArray(logs) || typeof today !== 'string') return null
  const asOf = calendarDay(today)
  if (!asOf) return null
  const currentWeek = monday(asOf)
  const windowStart = addCalendarDays(currentWeek, -77)
  if (!windowStart) return null
  const weekStarts = Array.from({ length: 12 }, (_, i) => addCalendarDays(windowStart, i * 7))
  const series = new Map(MAIN.map(name => {
    const view = exerciseSetView(name)
    return [view.key, { key: view.key, name: view.name, best: new Map() }]
  }))
  for (const log of logs) {
    if (!log || typeof log !== 'object' || log.skipped || erDeloadLog(log)) continue
    const name = log.exercises?.name ?? log.name
    if (typeof name !== 'string' || !erHovedloeft(name) || !isMainLift(name)) continue
    const reps = log.reps_completed ?? log.reps
    if (!erTungtSaet(name, reps)) continue
    const estimate = estimatedOneRepMax(log.weight, reps)
    if (!(estimate > 0)) continue
    // Never allow calendarDay(undefined)'s default clock into this pure model.
    if (typeof log.logged_at !== 'string' || !log.logged_at.trim()) continue
    const day = calendarDay(log.logged_at)
    if (!day || day < windowStart || day > asOf) continue
    const weekStart = monday(day)
    if (!weekStarts.includes(weekStart)) continue
    const view = exerciseSetView(name)
    if (!series.has(view.key)) series.set(view.key, { key: view.key, name: view.name, best: new Map() })
    const best = series.get(view.key).best
    best.set(weekStart, Math.max(best.get(weekStart) ?? 0, estimate))
  }
  const lifts = [...series.values()].sort((a, b) => a.key.localeCompare(b.key)).map(({ key, name, best }) => {
    const weeks = weekStarts.map(weekStart => ({ weekStart, e1rm: best.get(weekStart) ?? null, provisional: weekStart === currentWeek }))
    const completed = weeks.slice(0, -1)
    const recent = completed.slice(-4).map(w => w.e1rm)
    const enough = recent.every(v => v !== null)
    let plateau = null, drop = null, dropPercent = null
    if (enough) {
      let top = recent[0]
      plateau = true
      for (const value of recent.slice(1)) {
        if (value > top) plateau = false
        top = Math.max(top, value)
      }
      dropPercent = (1 - recent.at(-1) / top) * 100
      // Compare estimates directly; a rounded percentage must not change >5%.
      drop = recent.at(-1) < top * 0.95
    }
    return { key, name, weeks, slopeKgPerWeek: slope(completed), plateau, drop, dropPercent }
  })
  return { asOf, windowStart, currentWeek, completedThrough: addCalendarDays(currentWeek, -1), lifts }
}
