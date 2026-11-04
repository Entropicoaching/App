// Calendar weeks in Denmark, including the 167/169-hour DST weeks.
const calendar = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Copenhagen', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
})
const parts = date => Object.fromEntries(calendar.formatToParts(date).map(p => [p.type, p.value]))
const localUTC = p => Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second)
function midnight(day) {
  // Solve Copenhagen wall time rather than adding fixed 24-hour durations.
  let at = day
  for (let i = 0; i < 3; i++) at += day - localUTC(parts(new Date(at)))
  return new Date(at).toISOString()
}
export function conversationWeek(now = new Date()) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw Error('Ugen kunne ikke bestemmes.')
  const p = parts(now), today = Date.UTC(+p.year, +p.month - 1, +p.day)
  const monday = today - ((new Date(today).getUTCDay() + 6) % 7) * 86400000
  return { start: midnight(monday), end: midnight(monday + 7 * 86400000) }
}
