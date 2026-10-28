// Only complete calendar data can establish a rest day. No writes or flags.
export const REST_DAY_TEXT = 'Ingen træning planlagt. Tag dagen i dit eget tempo.'
export const REST_WEEKDAYS = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag']
const fixed = s => Number.isInteger(s.weekday) && s.weekday >= 0 && s.weekday <= 6
export function restDays(week) {
  if (!Array.isArray(week?.sessions)) return []
  const sessions = week.sessions
  if (sessions.some(s => !s || !Array.isArray(s.exercises) || !fixed(s))) return []
  const note = typeof week.coach_note === 'string' ? week.coach_note.trim() : ''
  return Array.from({ length: 7 }, (_, weekday) => ({ weekday,
    text: note || REST_DAY_TEXT,
  })).filter(day => !sessions.some(s => s.weekday === day.weekday && s.exercises.length > 0))
}
export function isRestSession(week, session) {
  return Array.isArray(session?.exercises) && session.exercises.length === 0 &&
    restDays(week).some(day => day.weekday === session.weekday)
}
// Calendar arithmetic, never elapsed milliseconds across a clock change.
export function restDate(weekStart, weekday) {
  if (!weekStart) return ''
  const date = new Date(weekStart)
  if (!Number.isFinite(date.getTime())) return ''
  date.setDate(date.getDate() + weekday)
  return date.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })
}
