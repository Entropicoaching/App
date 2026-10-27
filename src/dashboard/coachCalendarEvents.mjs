import { calendarTime } from '../athlete/kostNumbers.mjs'

// Stævne uses athletes.competition_date too. There is no separate test-day
// field in the pinned model. Never infer event types from names or notes.
export function coachCalendarDays(athletes = []) {
  const days = new Map()
  for (const athlete of athletes) {
    const date = athlete?.competition_date
    if (!athlete?.id || calendarTime(date) === null) continue
    if (!days.has(date)) days.set(date, [])
    days.get(date).push(athlete)
  }
  return [...days].sort(([a], [b]) => a.localeCompare(b))
    .map(([date, athletes]) => ({ date, athletes }))
}
