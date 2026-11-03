import { calendarDay } from '../../calendarDate.js'
import { adaptPublicContract, uniqueLogs } from './publicContract.mjs'

function recordedDay(value, now) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:$|T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$)/.test(value)) return null
  const day = calendarDay(value)
  return day && (!value.includes('T') || Date.parse(value) <= new Date(now).getTime()) ? day : null
}

/**
 * One descriptive sentence for the active, dated seven-day program week.
 * Pass the public currentWeek/exerciseLogs props and an explicit clock value.
 * As in weekOverview, a session is closed when every planned position is
 * confirmed or skipped; skipped positions never count as confirmed sets.
 * At least one confirmed set is required. No history, names, advice or trend
 * inference is included, and this function is deliberately not wired into UI.
 */
export function weekProgressSentence(props = {}, now) {
  // No implicit wall clock: equal snapshots and clock values give equal text.
  if (!(now instanceof Date) && typeof now !== 'string') return null
  if (!calendarDay(now)) return null
  const snapshot = props?.exerciseLogs
  const pending = Array.isArray(snapshot) ? snapshot.filter(row => row?._optimistic) : []
  // The shared deduplicator ignores optimistic metadata. Suppress a pending
  // position before adapting so a saved retry cannot win by array order.
  const exerciseLogs = Array.isArray(snapshot) ? snapshot.filter(row =>
    !pending.some(p => p.exercise_id === row?.exercise_id && p.set_number === row?.set_number)) : snapshot
  const contract = adaptPublicContract({
    currentWeek: props?.currentWeek, exerciseLogs,
  }, now)
  const sessions = contract.week?.sessions
  if (!contract.activeWeek || !contract.weekLogs || !Array.isArray(sessions)) return null

  const ids = new Set()
  for (const session of sessions) {
    if (!Array.isArray(session?.exercises)) return null
    for (const exercise of session.exercises) {
      if (exercise?.id == null || ids.has(exercise.id) ||
          !Number.isSafeInteger(exercise.sets) || exercise.sets <= 0) return null
      ids.add(exercise.id)
    }
  }

  // Ignore retry IDs: conflicting values at one planned position are unknown.
  const logs = uniqueLogs(contract.weekLogs.map(row => ({ ...row, id: undefined })))
    .filter(row => {
      const day = recordedDay(row.logged_at, now)
      return !row._optimistic && day && day >= contract.start && day <= contract.today
    })
  let closed = 0, confirmed = 0
  for (const session of sessions.filter(session => session.exercises.length)) {
    let complete = true
    for (const exercise of session.exercises) {
      const positions = logs.filter(row => row.exercise_id === exercise.id &&
        Number.isSafeInteger(row.set_number) && row.set_number >= 1 && row.set_number <= exercise.sets)
      if (positions.length !== exercise.sets) complete = false
      confirmed += positions.filter(row => !row.skipped).length
    }
    if (complete) closed++
  }
  if (!confirmed) return null
  return `Denne uge: ${closed} afslutte${closed === 1 ? 't' : 'de'} pas og ${confirmed} bekræfte${confirmed === 1 ? 't sæt' : 'de sæt'}.`
}
