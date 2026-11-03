import { calendarTime, parseInputNumber } from '../../athlete/kostNumbers.mjs'
import { historyDays } from './historyDays.mjs'

// The screen date and its six preceding calendar days, independent of clock/DST.
// Duplicate meals remain meals; historyDays counts each calendar date once.
// Unknown daily nutrients invalidate the average rather than masquerading as zero.
export function weekSummary(historyRows, targets, date) {
  const end = calendarTime(date)
  const days = end === null ? [] : historyDays(historyRows, targets).filter(day => {
    const time = calendarTime(day.date)
    return time >= end - 6 * 86400000 && time <= end
  })
  const average = key => {
    if (!days.length || days.some(day => day[key] === null)) return null
    // Divide first to avoid overflow when individually finite daily totals are large.
    const value = days.reduce((sum, day) => sum + day[key] / days.length, 0)
    return Number.isFinite(value) ? value : null
  }
  const proteinGoal = parseInputNumber(targets?.protein) > 0
  return {
    loggedDays: days.length,
    averages: { kcal: average('kcal'), protein: average('protein') },
    protein: proteinGoal ? {
      reached: days.some(day => day.reached.protein === null) ? null
        : days.filter(day => day.reached.protein === true).length,
      days: days.length,
    } : null,
  }
}
