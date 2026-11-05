import { antalOrd } from '../antalOrd.mjs'
// Opt-in local model. No global storage access and no screen integration.
export const MOBILITY_DONE_PREFIX = 'entropi2:mobility:done:v1:'
export const MOBILITY_DONE_LIMIT = 400
const validId = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 200
const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Copenhagen', year: 'numeric', month: '2-digit', day: '2-digit',
})

function dayTime(day) {
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
  const time = Date.parse(day + 'T00:00:00Z')
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === day ? time : null
}

// A date-only string is already a calendar day; instants use Danish local time.
function calendarDay(value) {
  if (typeof value === 'string') return dayTime(value) === null ? null : value
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) return null
  const parts = Object.fromEntries(formatter.formatToParts(value).map(p => [p.type, p.value]))
  const day = `${parts.year}-${parts.month}-${parts.day}`
  return dayTime(day) === null ? null : day
}

function bounded(entries) {
  const unique = new Map()
  for (const { routineId, day } of entries) unique.set(JSON.stringify([day, routineId]), { routineId, day })
  return [...unique.values()].sort((a, b) => a.day < b.day ? -1 : a.day > b.day ? 1 :
    a.routineId < b.routineId ? -1 : a.routineId > b.routineId ? 1 : 0).slice(-MOBILITY_DONE_LIMIT)
}

/** Returns { entries, error }. Reads never repair, delete or write storage. */
export function readMobilityDone({ enabled = false, athleteId, storage } = {}) {
  if (enabled !== true) return { entries: [], error: null }
  if (!validId(athleteId)) return { entries: [], error: 'invalid-input' }
  try {
    const raw = storage.getItem(MOBILITY_DONE_PREFIX + athleteId)
    if (raw === null) return { entries: [], error: null }
    if (typeof raw !== 'string') throw Error('storage format')
    const data = JSON.parse(raw)
    if (!data || data.version !== 1 || data.athleteId !== athleteId || !Array.isArray(data.entries) ||
      !data.entries.every(e => e && validId(e.routineId) && dayTime(e.day) !== null)) {
      return { entries: [], error: 'invalid-history' }
    }
    return { entries: bounded(data.entries), error: null }
  } catch { return { entries: [], error: 'read-failed' } }
}

/** A completion is unique by routineId + calendar day, within one athlete. */
export function markMobilityDone({ enabled = false, athleteId, storage, routineId, day } = {}) {
  if (enabled !== true) return { entries: [], error: null, saved: false, changed: false }
  const date = calendarDay(day)
  if (!validId(athleteId) || !validId(routineId) || date === null) {
    return { entries: [], error: 'invalid-input', saved: false, changed: false }
  }
  const previous = readMobilityDone({ enabled, athleteId, storage })
  if (previous.error) return { ...previous, saved: false, changed: false }
  if (previous.entries.some(e => e.routineId === routineId && e.day === date)) {
    return { ...previous, saved: true, changed: false }
  }
  const entries = bounded([...previous.entries, { routineId, day: date }])
  try {
    storage.setItem(MOBILITY_DONE_PREFIX + athleteId, JSON.stringify({ version: 1, athleteId, entries }))
    return { entries, error: null, saved: true, changed: true }
  } catch { return { ...previous, error: 'write-failed', saved: false, changed: false } }
}

/** Monday-Sunday around screenDate. Target is supplied by the future caller.
 * Counts routine/day completions, including counts above the weekly target.
 * Invalid history still yields seven empty marks with an error to display.
 */
export function mobilityDoneWeek({ enabled = false, athleteId, storage, screenDate, weeklyTarget } = {}) {
  if (enabled !== true) return null
  const day = calendarDay(screenDate)
  if (day === null || !Number.isSafeInteger(weeklyTarget) || weeklyTarget < 0) {
    return { days: [], completed: 0, target: null, label: null, error: 'invalid-input' }
  }
  const time = dayTime(day)
  const monday = time - ((new Date(time).getUTCDay() + 6) % 7) * 86400000
  const dates = Array.from({ length: 7 }, (_, i) => new Date(monday + i * 86400000).toISOString().slice(0, 10))
  // Guard the supported four-digit calendar range at either end.
  if (dates.some(date => dayTime(date) === null)) {
    return { days: [], completed: 0, target: null, label: null, error: 'invalid-input' }
  }
  const history = readMobilityDone({ enabled, athleteId, storage })
  const days = dates.map(date => {
    const routineIds = history.entries.filter(e => e.day === date).map(e => e.routineId)
    return { day: date, done: routineIds.length > 0, count: routineIds.length, routineIds }
  })
  const completed = days.reduce((sum, date) => sum + date.count, 0)
  return { weekStart: dates[0], weekEnd: dates[6], days, completed, target: weeklyTarget,
    label: `${completed} af ${weeklyTarget} ${antalOrd(weeklyTarget, 'rutine', 'rutiner')} denne uge`, error: history.error }
}
