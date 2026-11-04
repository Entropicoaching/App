import { addCalendarDays, calendarDaysBetween } from '../../calendarDate.js'

const validDay = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  calendarDaysBetween(value, value) === 0
const validMinute = value => Number.isInteger(value) && value >= 0 && value < 1440

// Explicit local calendar day/minute; no clock, persistence, notification or UI.
// Every snapshot must describe ONE athlete and be complete through `today`.
export function friendlyReminders(input = {}) {
  // OFF must not inspect snapshots, even via getters.
  if (input?.enabled !== true) return []
  const { today, minuteOfDay, window = { start: 540, end: 1200 } } = input
  if (!validDay(today) || !validMinute(minuteOfDay) || !window ||
      !validMinute(window.start) || !validMinute(window.end) || window.start === window.end) return []
  const inWindow = window.start < window.end
    ? minuteOfDay >= window.start && minuteOfDay < window.end
    : minuteOfDay >= window.start || minuteOfDay < window.end
  if (!inWindow || input.paused === true) return []

  const reminders = []
  const nutrition = input.nutrition
  const since = addCalendarDays(today, -3)
  // Three completed calendar days, plus no log today. Coverage is explicit so
  // an unloaded/partial history never becomes an accusation of inactivity.
  if (nutrition?.complete === true && validDay(nutrition.observedFrom) &&
      nutrition.observedFrom <= since && Array.isArray(nutrition.loggedDays) &&
      nutrition.loggedDays.every(day => validDay(day) && day <= today) &&
      !nutrition.loggedDays.some(day => day >= since)) {
    reminders.push({
      key: `nutrition:${today}`, kind: 'nutrition', date: today,
      title: 'Lyst til at notere et måltid?',
      text: 'Du kan starte med det næste måltid, hvis det passer dig. Du behøver ikke udfylde de tidligere dage.',
      action: 'nutrition',
    })
  }

  // Caller supplies only active planned sessions; registered=false is known
  // absence, not an unknown status. One reminder even with multiple sessions.
  const sessions = input.sessions
  if (sessions?.complete === true && Array.isArray(sessions.items)) {
    const pending = sessions.items.filter(item => item && typeof item.id === 'string' &&
      item.id.trim() === item.id && item.id.length > 0 && item.id.length <= 120 &&
      item.registered === false && validDay(item.date) &&
      calendarDaysBetween(item.date, today) >= 1 && calendarDaysBetween(item.date, today) <= 3)
      .sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
    const session = pending[0]
    if (session) reminders.push({
      key: `session:${session.date}:${session.id}`, kind: 'session', date: session.date,
      title: 'Vil du notere dit pas?',
      text: 'Hvis du trænede, kan du registrere passet, når det passer dig. Det er også okay, hvis planen ændrede sig.',
      action: 'session', sessionId: session.id,
    })
  }

  const checkin = input.checkin
  if (checkin?.complete === true && checkin.submitted === false && validDay(checkin.dueDate)) {
    const age = calendarDaysBetween(checkin.dueDate, today)
    if (age >= 0 && age < 7) reminders.push({
      key: `checkin:${checkin.dueDate}`, kind: 'checkin', date: checkin.dueDate,
      title: 'Har du lyst til at dele, hvordan det går?',
      text: 'Et kort check-in kan hjælpe med at tilpasse din plan. Du kan gøre det, når du har overskud.',
      action: 'checkin',
    })
  }

  // A local draft is a separate, explicit snapshot; never infer server submission
  // from it. Unknown/failed storage must not become a missing check-in reminder.
  const local = input.localCheckin
  if (!checkin && local?.complete === true && local.status === 'empty' && validDay(local.weekStart) &&
      new Date(`${local.weekStart}T00:00:00Z`).getUTCDay() === 1) {
    const age = calendarDaysBetween(local.weekStart, today)
    if (age >= 0 && age < 7) reminders.push({
      key: `local-checkin:${local.weekStart}`, kind: 'checkin', date: local.weekStart,
      title: 'Lyst til ugens check-in?',
      text: 'Du kan gemme en lokal kladde, når det passer dig.', action: 'checkin',
    })
  }

  // Dismissal is caller-owned and scoped to stable keys; no writes here.
  const dismissed = Array.isArray(input.dismissedKeys) ? input.dismissedKeys : []
  return reminders.filter(reminder => !dismissed.includes(reminder.key))
}
