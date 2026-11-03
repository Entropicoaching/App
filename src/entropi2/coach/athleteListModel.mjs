const DAY_MS = 86400000

export const MISSING_LOG_DAYS = 3
export const PROGRAM_END_SOON_DAYS = 7

// Civil dates only: the caller supplies today's Danish calendar date. No clock,
// parsing of local timestamps, reads or state changes belong in this model.
function dayNumber(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const stamp = Date.parse(`${value}T00:00:00Z`)
  return Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0, 10) === value
    ? stamp / DAY_MS : null
}

function signal(athlete, today) {
  if (athlete.painReported === true) return {
    priority: 0, kind: 'pain', reason: 'Smerte meldt',
  }
  if (athlete.deviationReported === true) return {
    priority: 0, kind: 'deviation', reason: 'Afvigelse meldt',
  }
  const lastLog = dayNumber(athlete.lastLogDay)
  if (lastLog !== null && today - lastLog >= MISSING_LOG_DAYS) return {
    priority: 1, kind: 'missing-log', reason: `Ingen log i ${today - lastLog} dage`,
  }
  const unread = athlete.unreadMessages
  if (Number.isSafeInteger(unread) && unread > 0) return {
    priority: 2, kind: 'unread', reason: `${unread} ulæst${unread === 1 ? '' : 'e'} besked${unread === 1 ? '' : 'er'}`,
  }
  const end = dayNumber(athlete.programEndDay)
  if (end !== null && end - today <= PROGRAM_END_SOON_DAYS) return {
    priority: 3, kind: 'program-end', reason: end < today ? 'Programmet er udløbet'
      : end === today ? 'Programmet slutter i dag'
        : `Programmet slutter om ${end - today} dag${end - today === 1 ? '' : 'e'}`,
  }
  return { priority: 4, kind: 'none', reason: 'Intet bekræftet opfølgningssignal' }
}

/**
 * Pure, unconnected roster model. Each athlete is a normalized fact record:
 * { id, painReported, deviationReported, lastLogDay, unreadMessages, programEndDay }.
 * Report flags mean an active report requiring review, not lifetime history.
 * Date fields and today use YYYY-MM-DD. Missing facts stay unknown; a missing
 * lastLogDay does not prove inactivity. The caller scopes visible athletes and
 * supplies fresh, complete facts; this function performs no authorization/read.
 * Returns one { athlete, priority, kind, reason } per input athlete. Equal
 * priorities retain roster order. Inputs are never sorted or changed.
 */
export function coachAthleteList({ athletes = [], today } = {}) {
  const day = dayNumber(today)
  if (day === null) throw new TypeError('today must be a valid YYYY-MM-DD calendar date')
  if (!Array.isArray(athletes) || Array.from(athletes).some(athlete => !athlete ||
    typeof athlete !== 'object' || Array.isArray(athlete))) {
    throw new TypeError('athletes must be an array of fact records')
  }
  return athletes.map(athlete => ({ athlete, ...signal(athlete, day) }))
    .sort((a, b) => a.priority - b.priority)
}
