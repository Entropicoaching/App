import { calendarDay } from '../calendarDate.js'
// APP-STAEVNE2: explicit presentation flag. No storage or URL activation.
export const DEFAULT_STAEVNEDAG_FOKUS = false
export function isMeetDay(enabled, competitionDate, now) {
  if (enabled !== true || typeof competitionDate !== 'string') return false
  if (!/^\d{4}-\d{2}-\d{2}$/.test(competitionDate)) return false
  const today = now ?? new Date()
  if (!(today instanceof Date) || !Number.isFinite(today.getTime())) return false
  return competitionDate === calendarDay(today)
}
