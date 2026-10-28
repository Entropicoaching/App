import { calendarDay } from '../calendarDate.js'

// Calendar comparison avoids elapsed-hour errors at either DST transition.
// Unknown dates retain the existing relative week ordering.
export function upcomingProgramWeek(start, fallback = false, now = new Date()) {
  const day = calendarDay(start)
  const today = calendarDay(now)
  return day && today ? day > today : fallback === true
}

export function programDayPreview(exercises = []) {
  const rows = Array.isArray(exercises) ? exercises.filter(Boolean) : []
  const compact = value => String(value ?? '').replace(/\s+/g, ' ').trim()
  return {
    lines: rows.slice(0, 4).map(ex => `${compact(ex.name) || 'Øvelse'}: ${compact(ex.sets) || '?'} x ${compact(ex.reps) || '?'}`),
    more: Math.max(0, rows.length - 4),
  }
}
