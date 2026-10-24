import { calendarDay } from './calendarDate.js'

export function formatMessageTime(ts, now = new Date()) {
  if (ts == null || ts === '' || !calendarDay(ts)) return ''
  const d = new Date(ts)
  if (!Number.isFinite(d.getTime()) || !Number.isFinite(now.getTime())) return ''
  const ordinal = date => {
    const day = new Date(0)
    day.setUTCFullYear(date.getFullYear(), date.getMonth(), date.getDate())
    day.setUTCHours(0, 0, 0, 0)
    return day.getTime() / 86400000
  }
  const dayDiff = ordinal(now) - ordinal(d)
  const time = d.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })
  if (dayDiff === 0) return time
  if (dayDiff === 1) return `I går ${time}`
  if (dayDiff < 7) return d.toLocaleDateString('da-DK', { weekday: 'long' }) + ' ' + time
  return d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' }) + ' ' + time
}
