import { addCalendarDays, calendarDay } from '../../calendarDate.js'
import { draftKey } from '../checkin/weeklyDraft.mjs'

const time = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Copenhagen', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

// The calendar week is independent of the loaded training/program week.
export function homeCheckInScope(input = {}) {
  if (input.enabled !== true || input.onHoliday) return null
  const { athleteId, now } = input
  if (now == null) return null
  const today = calendarDay(now)
  if (!today) return null
  const weekStart = addCalendarDays(today, -((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7))
  const key = draftKey(athleteId, weekStart)
  if (!key) return null
  const parts = Object.fromEntries(time.formatToParts(new Date(typeof now === 'string' && now.length === 10 ? `${now}T12:00:00Z` : now)).map(p => [p.type, p.value]))
  return { key, today, weekStart, minuteOfDay: Number(parts.hour) * 60 + Number(parts.minute) }
}

