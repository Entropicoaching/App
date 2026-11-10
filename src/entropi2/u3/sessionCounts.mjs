import { addCalendarDays, calendarDay } from '../../calendarDate.js'
import { uniqueLogs } from '../analysis/publicContract.mjs'

// Ren tæller for én programuge med samme regel som counts i weekOverview.mjs:
// et pas er gennemført, når alle planlagte sæt er logget eller sprunget over.
// weekOverview regner kun den aktuelle uge; denne regner en hvilken som helst uge.
// week: { start_date, sessions: [{ exercises: [{ id, sets }] }] }.
const missing = { planned: null, done: null, confirmed: null, skipped: null }

function validDay(value, now) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:$|T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$)/.test(value)) return null
  const day = calendarDay(value)
  return day && (!value.includes('T') || Date.parse(value) <= new Date(now).getTime()) ? day : null
}

export function sessionCounts(week, logs, { today, now = new Date() } = {}) {
  const start = calendarDay(week?.start_date), day = calendarDay(today)
  const sessions = week?.sessions
  if (!start || !day || start > day || !Array.isArray(sessions)) return missing
  const ids = new Set()
  for (const session of sessions) {
    if (!Array.isArray(session?.exercises)) return missing
    for (const ex of session.exercises) {
      if (ex?.id == null || ids.has(ex.id) || !Number.isSafeInteger(ex.sets) || ex.sets <= 0) return missing
      ids.add(ex.id)
    }
  }
  const plannedSessions = sessions.filter(s => s.exercises.length)
  const planned = plannedSessions.length
  if (!Array.isArray(logs)) return { ...missing, planned }
  const end = addCalendarDays(start, 6)
  const kept = uniqueLogs(logs.map(r => ({ ...r, id: undefined }))).filter(r => {
    const logged = validDay(r.logged_at, now)
    return !r._optimistic && logged && logged >= start && logged <= day && ids.has(r.exercise_id)
  })
  let done = 0, confirmed = 0, skipped = 0
  for (const session of plannedSessions) {
    let addressed = 0, total = 0
    for (const ex of session.exercises) {
      total += ex.sets
      const positions = kept.filter(r => r.exercise_id === ex.id &&
        Number.isSafeInteger(r.set_number) && r.set_number >= 1 && r.set_number <= ex.sets)
      addressed += positions.length
      skipped += positions.filter(r => r.skipped).length
      confirmed += positions.filter(r => !r.skipped).length
    }
    if (addressed === total) done++
  }
  return { planned, done, confirmed, skipped, start, end, complete: end < day }
}
