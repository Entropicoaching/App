import { bestHeavySetPerDay, HOVEDLOEFT_FAMILIER } from '../exerciseProgress.js'
import { tidligereSaet, ugensSaet } from './rekorder.js'
import { parseInputNumber } from '../inputValues.js'
import { calendarDay } from '../calendarDate.js'

// Current program-week rows are authoritative, including pending local edits.
// Remove history for those exercise IDs before combining; never count it twice.
export function fokusModel({ fremgangLogs, exerciseLogs, currentWeek, allWeeks, weightLogs }) {
  const current = currentWeek ? ugensSaet(exerciseLogs, currentWeek, allWeeks) : []
  const unique = new Map(current.map(row => [row.noegle, row]))
  const rows = [...tidligereSaet((fremgangLogs || []).filter(row => row && !row.skipped), currentWeek), ...unique.values()]
    .map(row => ({ ...row, exercises: { name: row.navn }, reps_completed: row.reps, logged_at: row.dato }))
  const lifts = HOVEDLOEFT_FAMILIER.map(family => ({
    key: family.key, label: family.label,
    points: bestHeavySetPerDay(rows.filter(row => !row.deload && family.match(row.navn))),
  }))
  const completed = [...unique.values()].filter(row => !row.skipped && parseInputNumber(row.reps) > 0).length
  const weights = (weightLogs || []).map(row => ({ day: calendarDay(row.logged_at), weight: parseInputNumber(row.weight) }))
    .filter(row => row.day && row.weight > 0).sort((a, b) => a.day.localeCompare(b.day))
  return { lifts, completed, weights }
}
