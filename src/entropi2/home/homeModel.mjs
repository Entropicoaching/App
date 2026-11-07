import { nextTrainingHome } from '../../athlete/nextTrainingHome.mjs'
import { findDagensPas, sessionLoggedCount, sessionSetTotal } from '../../nextSet.js'
import { calendarDay, addCalendarDays } from '../../calendarDate.js'
import { calendarTime } from '../../athlete/kostNumbers.mjs'

export const DEFAULT_ENTROPI2_HOME = false

// Same anchor rules as nextTrainingHome; never normalize an invalid explicit date.
function startOfWeek(weeks, active, week, today) {
  if (calendarTime(week.start_date) !== null) return week.start_date
  if (week.start_date) return null
  const monday = addCalendarDays(today, -(new Date(calendarTime(today)).getUTCDay() + 6) % 7)
  if (!Number.isInteger(week.week_number)) return week === active ? monday : null
  const anchor = [...weeks].sort((a, b) => a.week_number - b.week_number)
    .find(w => calendarTime(w.start_date) !== null && Number.isInteger(w.week_number))
  return anchor ? addCalendarDays(anchor.start_date, (week.week_number - anchor.week_number) * 7)
    : Number.isInteger(active.week_number) ? addCalendarDays(monday, (week.week_number - active.week_number) * 7) : null
}

const validId = id => (typeof id === 'string' && id.length > 0 && id.length <= 200 && !/[\s\x00-\x1f\x7f]/.test(id)) ||
  (Number.isSafeInteger(id) && id > 0)

function validSession(session) {
  return validId(session?.id) && Array.isArray(session.exercises) && session.exercises.length > 0 &&
    session.exercises.every(e => validId(e?.id) && Number.isSafeInteger(e.sets) && e.sets > 0) &&
    new Set(session.exercises.map(e => e.id)).size === session.exercises.length
}

export function homeModel({ allWeeks = [], currentWeek, exerciseLogs, now = new Date(), onHoliday = false, programError = false, programLoading = false, offlineSnapshotAt, athlete,
  pendingSyncKeys = [], parkedSets = [] } = {}) {
  const today = calendarDay(now)
  const unavailable = kind => ({ kind, today, target: null })
  if (programLoading) return unavailable('loading')
  if (onHoliday) return unavailable('holiday')
  if (programError || offlineSnapshotAt != null) return unavailable('missing')
  if (!today || !Array.isArray(allWeeks) || !Array.isArray(exerciseLogs)) return unavailable('missing')
  if (!allWeeks.length && !currentWeek) return unavailable('no-program')
  const originalActive = allWeeks.find(w => w?.id != null && w.id === currentWeek?.id)
  if (!originalActive || !Array.isArray(originalActive.sessions) || !Array.isArray(currentWeek.sessions)) return unavailable('missing')
  if (allWeeks.some(w => !w || !validId(w.id) || !Array.isArray(w.sessions) || w.sessions.some(s => !s || !Array.isArray(s.exercises) || s.exercises.some(e => !e)))) return unavailable('missing')
  if (allWeeks.some(w => new Set(w.sessions.map(s => s.id)).size !== w.sessions.length)) return unavailable('missing')
  if (new Set(allWeeks.map(w => w.id)).size !== allWeeks.length || exerciseLogs.some(l => !l)) return unavailable('missing')
  // Advance the calendar anchor without mutating the parent's stale currentWeek.
  const dated = allWeeks.filter(w => {
    const start = startOfWeek(allWeeks, originalActive, w, today)
    return start && start <= today && today <= addCalendarDays(start, 6)
  })
  if (dated.length > 1) return unavailable('missing')
  const active = dated[0] || originalActive
  // Match weekSessions: queued/parked positions are not confirmed or skipped yet.
  // Use the existing exerciseId_setNumber key and the parked slot's exact fields.
  const pending = new Set(Array.isArray(pendingSyncKeys) ? pendingSyncKeys : [])
  const parked = Array.isArray(parkedSets) ? parkedSets : []
  const logs = exerciseLogs.filter(l => !l._optimistic && (l.athlete_id == null || l.athlete_id === athlete?.id) &&
    !pending.has(`${l.exercise_id}_${l.set_number}`) &&
    !parked.some(s => s?.exerciseId === l.exercise_id && s.setNumber === l.set_number))
  // The public calendar selector returns a presentation projection, without IDs.
  // A second read-only projection tags titles, which never affect its ranking.
  // This recovers the chosen original object even when titles/dates are identical.
  const originals = new Map()
  const tagged = allWeeks.map((w, wi) => ({ ...w, sessions: w.sessions.map((s, si) => {
    const tag = `home:${wi}:${si}`
    originals.set(tag, { week: w, session: s })
    return { ...s, title: tag }
  }) }))
  const args = { enabled: true, allWeeks, currentWeek: active, exerciseLogs: logs, now }
  const calendar = nextTrainingHome(args)
  let target, date, kind
  if (calendar?.kind === 'next') {
    const selected = nextTrainingHome({ ...args, allWeeks: tagged, currentWeek: tagged[allWeeks.indexOf(active)] })
    target = originals.get(selected?.title)
    date = calendar.date
    kind = 'next'
  } else if (calendar) return unavailable(calendar.kind)
  else {
    const start = startOfWeek(allWeeks, active, active, today)
    if (!start || start > today || addCalendarDays(start, 6) < today) return unavailable('missing')
    const sessions = active.sessions.filter(s => s.weekday == null ||
      (Number.isInteger(s.weekday) && s.weekday >= 0 && s.weekday <= 6 && addCalendarDays(start, s.weekday) === today))
    const pas = findDagensPas(allWeeks, { ...active, sessions }, logs)
    if (pas?.status !== 'open' || !pas.next) return unavailable(pas?.status === 'done' ? 'done' : 'no-next')
    target = { week: active, session: pas.session }
    date = target.session.weekday == null ? null : today
    kind = 'today'
  }
  if (!target || !validSession(target.session)) return unavailable('missing')
  if (target.week === originalActive && !currentWeek.sessions.some(s => s.id === target.session.id)) return unavailable('missing')
  if (target.session.week_id != null && target.session.week_id !== target.week.id) return unavailable('missing')
  return { kind, today, date, target,
    stamp: JSON.stringify([athlete?.id, allWeeks, currentWeek]),
    logged: sessionLoggedCount(target.session, logs), total: sessionSetTotal(target.session) }
}

export function startHomeSession(props, shown, now) {
  if (props.enabled !== true || typeof props.onStartSession !== 'function' || !props.athlete?.id) return false
  const fresh = homeModel({ ...props, now })
  const a = shown?.target, b = fresh.target
  // Retained DOM events must not start a replacement program or yesterday's card.
  if (!a || !b || (b.week.athlete_id != null && b.week.athlete_id !== props.athlete.id) || shown.stamp !== fresh.stamp || shown.today !== fresh.today || a.week.id !== b.week.id || a.session.id !== b.session.id ||
      a.week.athlete_id !== b.week.athlete_id || a.week.program_id !== b.week.program_id || shown.date !== fresh.date) return false
  return props.onStartSession(b.session.id, b.week.id) !== false
}
