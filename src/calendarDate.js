import { calendarTime } from './athlete/kostNumbers.mjs'

const DAY = 86400000
const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Copenhagen', year: 'numeric', month: '2-digit', day: '2-digit',
})

// Kalenderdatoer valideres uden normalisering. Tidsstempler bliver dansk dato.
export function calendarDay(value = new Date()) {
  if (typeof value === 'string') value = value.trim()
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return calendarTime(value) === null ? null : value
  }
  if (!(value instanceof Date) && typeof value !== 'string') return null
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value) && calendarTime(value.slice(0, 10)) === null) return null
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return null
  const parts = Object.fromEntries(formatter.formatToParts(date).map(p => [p.type, p.value]))
  const day = `${parts.year}-${parts.month}-${parts.day}`
  return calendarTime(day) === null ? null : day
}

export function addCalendarDays(day, count) {
  const time = calendarTime(day)
  if (time === null || !Number.isSafeInteger(count)) return null
  const date = new Date(time + count * DAY)
  if (!Number.isFinite(date.getTime())) return null
  const result = date.toISOString().slice(0, 10)
  return calendarTime(result) === null ? null : result
}

export function calendarDaysBetween(from, to) {
  const a = calendarTime(from), b = calendarTime(to)
  return a === null || b === null ? null : (b - a) / DAY
}
