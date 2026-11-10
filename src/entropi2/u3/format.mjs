import { addCalendarDays } from '../../calendarDate.js'

// Fælles visning for U3: dansk talformat og uger fra mandag til søndag (R3).
const formats = new Map()
export function formatNumber(value, digits = 0) {
  const key = digits
  if (!formats.has(key)) formats.set(key, new Intl.NumberFormat('da-DK', { maximumFractionDigits: digits, minimumFractionDigits: digits }))
  return formats.get(key).format(value)
}
export const signed = (value, digits = 1) => {
  const rounded = Number(value.toFixed(digits))
  return `${rounded > 0 ? '+' : rounded < 0 ? '−' : ''}${formatNumber(Math.abs(rounded), digits)}`
}
export function mondayOf(day) {
  const weekday = (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7
  return addCalendarDays(day, -weekday)
}
const MONTHS = ['jan.', 'feb.', 'marts', 'april', 'maj', 'juni', 'juli', 'aug.', 'sep.', 'okt.', 'nov.', 'dec.']
export const shortDate = day => `${Number(day.slice(8, 10))}. ${MONTHS[Number(day.slice(5, 7)) - 1]}`
export function periodLabel(start, end) {
  return start.slice(5, 7) === end.slice(5, 7)
    ? `${Number(start.slice(8, 10))}. til ${shortDate(end)}` : `${shortDate(start)} til ${shortDate(end)}`
}
