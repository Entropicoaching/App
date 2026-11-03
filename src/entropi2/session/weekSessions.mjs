import { calendarDay, addCalendarDays } from '../../calendarDate.js'

const id = value => (typeof value === 'string' && value.trim() !== '') ||
  (typeof value === 'number' && Number.isSafeInteger(value))
const dateOnly = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  ? calendarDay(value) : null
const timestamp = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value) ||
      !dateOnly(value.slice(0, 10))) return null
  const at = Date.parse(value)
  return Number.isFinite(at) ? at : null
}

// Pure, unwired projection of ONE supplied program week. now is required.
// Input order is retained, including extra program sessions. Unknown exercise
// IDs cannot establish an extra session and are ignored rather than invented.
// done follows the existing addressed-slot contract (confirmed OR skipped).
// Missing data uses null counts, never a fabricated zero or completed session.
export function weekSessions({ week, exerciseLogs, athleteId, now,
  pendingSyncKeys = [], parkedSets = [] } = {}) {
  const at = now instanceof Date ? now.getTime() : typeof now === 'number' ? now : timestamp(now)
  const today = Number.isFinite(at) && at !== null ? calendarDay(new Date(at)) : null
  const start = dateOnly(week?.start_date), end = start ? addCalendarDays(start, 6) : null
  const sessions = Array.isArray(week?.sessions) ? week.sessions : []
  const ownerReady = id(athleteId) && (week?.athlete_id == null || week.athlete_id === athleteId)
  const ready = !!(today && start && end && ownerReady && Array.isArray(exerciseLogs))
  const occurrences = new Map(), sessionIds = new Map()
  for (const session of sessions) {
    sessionIds.set(session?.id, (sessionIds.get(session?.id) || 0) + 1)
    for (const ex of Array.isArray(session?.exercises) ? session.exercises : [])
      occurrences.set(ex?.id, (occurrences.get(ex?.id) || 0) + 1)
  }
  const pending = new Set(Array.isArray(pendingSyncKeys) ? pendingSyncKeys : [])
  const parked = Array.isArray(parkedSets) ? parkedSets : []
  const rows = new Map()
  if (ready) for (const row of exerciseLogs) {
    if (!row || !id(row.exercise_id) || !Number.isSafeInteger(row.set_number) || row.set_number < 1 ||
        row._optimistic || (row.athlete_id != null && row.athlete_id !== athleteId) ||
        (row.skipped != null && typeof row.skipped !== 'boolean')) continue
    const time = timestamp(row.logged_at), day = time === null ? null : calendarDay(new Date(time))
    if (!day || time > at || day < start || day > end ||
        pending.has(`${row.exercise_id}_${row.set_number}`) ||
        parked.some(s => s?.exerciseId === row.exercise_id && s.setNumber === row.set_number)) continue
    if (!rows.has(row.exercise_id)) rows.set(row.exercise_id, new Map())
    const slots = rows.get(row.exercise_id)
    const values = slots.get(row.set_number) || new Set()
    values.add(row.skipped === true ? 'skipped' : 'confirmed')
    slots.set(row.set_number, values)
  }
  return {
    weekId: week?.id ?? null, start, end, today,
    dataMissing: !ready || !Array.isArray(week?.sessions),
    sessions: sessions.map(session => {
      const exercises = session?.exercises
      const valid = id(session?.id) && sessionIds.get(session.id) === 1 && Array.isArray(exercises) &&
        exercises.every(ex => id(ex?.id) && occurrences.get(ex.id) === 1 && Number.isSafeInteger(ex.sets) && ex.sets >= 0)
      const sum = valid ? exercises.reduce((n, ex) => n + ex.sets, 0) : null
      const planned = Number.isSafeInteger(sum) ? sum : null
      const date = start && Number.isInteger(session?.weekday) && session.weekday >= 0 && session.weekday <= 6
        ? addCalendarDays(start, session.weekday) : null
      let confirmed = 0, skipped = 0, conflict = false
      if (ready && planned !== null) for (const ex of exercises) {
        for (const [number, values] of rows.get(ex.id) || []) {
          if (number > ex.sets) continue
          if (values.size !== 1) { conflict = true; continue }
          if (values.has('skipped')) skipped++
          else confirmed++
        }
      }
      const dataMissing = !ready || planned === null || conflict
      const done = dataMissing ? null : confirmed + skipped
      const status = done !== null && planned > 0 && done === planned ? 'klaret'
        : done > 0 ? 'delvist'
          : today && (date ? date > today : start > today) ? 'fremtid' : 'mangler'
      return { sessionId: session?.id ?? null, title: session?.title ?? null, date, status,
        planned, done, confirmed: dataMissing ? null : confirmed,
        skipped: dataMissing ? null : skipped, dataMissing }
    }),
  }
}
