import { weeklyLoad, uniqueSets } from '../analysis/weeklyLoad.mjs'
import { calendarDay, addCalendarDays } from '../../calendarDate.js'

const sum = days => {
  if (days.some(day => day.tonnage === null)) return null
  const total = days.reduce((value, day) => value + day.tonnage, 0)
  return Number.isFinite(total) ? total : null
}

/**
 * Pure descriptive tonnage (kg x completed reps), never a recommendation.
 * One athlete's authoritative exercise_logs snapshot; explicit asOf required.
 * weeklyLoad owns validation, Danish dates, RPE and per-set measurement rules.
 * days: 28 Danish calendar days, oldest first, including asOf's day.
 * weeks: existing four Monday-Sunday calendar weeks (current week may be partial).
 * acuteLoad: trailing 7-day sum; chronicLoad: trailing 28-day sum / 4.
 * Each trailing 7-day bucket must contain a recorded measurable set for chronic
 * evidence. No rows in a bucket cannot establish a recorded rest week.
 * Missing/invalid measurements suppress their window; absent RPE does not.
 * Empty days/weeks have tonnage 0, but insufficient evidence gives null for
 * ratio/signal (and for an empty acute window). A zero chronic mean gives null.
 * signal: 'belastningsspring' strictly outside [0.8, 1.5], null without evidence,
 * otherwise 'normal'. This describes recorded tonnage, not injury risk.
 * No clock, IO, UI, flags, storage or writes. Caller owns athlete/loading scope.
 */
export function load(exerciseLogs, asOf) {
  const weekly = weeklyLoad(exerciseLogs, asOf)
  if (!weekly) return null
  const today = calendarDay(asOf)
  const start = addCalendarDays(today, -27)
  if (!start) return null
  // Resolve identities over the WHOLE snapshot before splitting dates. This
  // preserves exclusion of conflicting copies even if they disagree on date.
  const rows = uniqueSets(exerciseLogs)
  const days = Array.from({ length: 28 }, (_, index) => {
    const date = addCalendarDays(start, index)
    const matching = rows.filter(row => typeof row.logged_at === 'string'
      && calendarDay(row.logged_at) === date)
    // Keep the exact-instant cutoff on the final day; earlier days are complete.
    const result = weeklyLoad(matching, date === today ? asOf : date)
    const { sets, tonnage, averageRpe, rpeCount } = result.weeks[3]
    return { date, sets, tonnage, averageRpe, rpeCount }
  })
  const buckets = Array.from({ length: 4 }, (_, i) => days.slice(i * 7, i * 7 + 7))
  const acuteDays = buckets[3]
  const acuteLoad = acuteDays.some(day => day.sets > 0) ? sum(acuteDays) : null
  const chronicTotal = buckets.every(bucket => bucket.some(day => day.sets > 0))
    ? sum(days) : null
  const chronicLoad = chronicTotal === null ? null : chronicTotal / 4
  const ratio = acuteLoad !== null && chronicLoad > 0 ? acuteLoad / chronicLoad : null
  const acuteChronicRatio = Number.isFinite(ratio) ? ratio : null
  const signal = acuteChronicRatio === null ? null
    : acuteChronicRatio > 1.5 || acuteChronicRatio < 0.8 ? 'belastningsspring' : 'normal'
  return { days, weeks: weekly.weeks, acuteLoad, chronicLoad, acuteChronicRatio, signal }
}
