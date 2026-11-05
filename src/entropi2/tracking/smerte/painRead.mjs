import { calendarDay, addCalendarDays } from '../../../calendarDate.js'
import { buildPainHistory } from './painModel.mjs'

const failure = () => ({ state: 'error' })

/** Project the existing coach readiness snapshot. No client, imports or IO.
 * fetchAthleteReadiness selects the latest 90 readiness_logs for one athlete.
 * Only explicit pain/pain_location are observations; soreness is never pain.
 */
export function readPainHistory(options = {}) {
  if (options.enabled !== true) return { state: 'off' }
  const { athleteId, asOf, weeks = 6, readiness } = options
  if (typeof athleteId !== 'string' || !athleteId.trim() || athleteId.length > 120
    || typeof asOf !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(asOf)
    || calendarDay(asOf) !== asOf || !Number.isInteger(weeks) || weeks < 4 || weeks > 8
    || !Array.isArray(readiness) || readiness.length > 90) return failure()
  const from = addCalendarDays(asOf, 1 - weeks * 7)
  if (!from) return failure()
  const daily = [], dates = new Set()
  for (const row of readiness) {
    if (!row || row.athlete_id !== athleteId || typeof row.logged_date !== 'string'
      || !/^\d{4}-\d{2}-\d{2}$/.test(row.logged_date) || calendarDay(row.logged_date) !== row.logged_date
      || dates.has(row.logged_date)) return failure()
    dates.add(row.logged_date)
    if (row.logged_date < from || row.logged_date > asOf) continue
    // Existing readiness entries are athlete check-ins. Reject other explicit origins.
    if (row.source != null && row.source !== 'athlete_manual') return failure()
    daily.push({ athleteId, day: row.logged_date, source: 'athlete_manual',
      pain: Object.hasOwn(row, 'pain') ? row.pain : null,
      painLocation: Object.hasOwn(row, 'pain_location') ? row.pain_location : null })
  }
  // If a full 90-row response does not reach the window start, it may be cut off.
  if (readiness.length === 90 && ![...dates].some(day => day <= from)) return failure()
  const data = { state: 'ready', complete: true, athleteId, asOf, daily }
  return buildPainHistory({ enabled: true, data, weeks }).state === 'error'
    ? { state: 'error', athleteId, asOf, invalidObservations: true } : data
}

// The tab uses the same projection before loading any optional view chunk.
export function hasReadinessPain(options = {}) {
  if (options.enabled !== true) return false
  return buildPainHistory({ enabled: true, data: readPainHistory(options), weeks: options.weeks }).state === 'ready'
}

// Invalid observations may be explained only after athlete, dates and origin passed.
export function shouldShowPainHistory(options = {}) {
  if (options.enabled !== true) return false
  const data = readPainHistory(options)
  return data.invalidObservations === true ||
    buildPainHistory({ enabled: true, data, weeks: options.weeks }).state === 'ready'
}
