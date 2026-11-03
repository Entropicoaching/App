import { calendarTime, parseInputNumber } from '../../athlete/kostNumbers.mjs'

const DAY = 86400000
const MIN_DAYS = 3

function average(rows) {
  if (rows.length < MIN_DAYS) return null
  const value = rows.reduce((sum, row) => sum + row.weight / rows.length, 0)
  return Number.isFinite(value) ? value : null
}

function change(current, previous) {
  if (current === null || previous === null) return null
  const kg = current - previous
  const percent = kg / previous * 100
  return Number.isFinite(kg) && Number.isFinite(percent) ? { kg, percent } : null
}

/**
 * Pure, unwired snapshot for one athlete, as of an explicit YYYY-MM-DD date.
 * Rows use the nutrition contract: athlete_id, logged_at, weight, created_at.
 * Latest valid created_at string wins each day; equal timestamps keep first input.
 * ISO creation timestamps must be normalized by the caller, as in weightSummary.
 * Each trailing seven-calendar-day average needs three distinct measured days.
 * Missing days are neither filled nor treated as zero. Weeks end at date, -7, -14.
 * fastChange is null without both comparisons, otherwise a boolean: both weekly
 * changes must exceed 1% of their previous average, in the same direction.
 */
export function weightTrend(rows, athleteId, date) {
  const end = calendarTime(date)
  const empty = { daily: [], average: null, days: 0, weeklyChange: null,
    previousWeeklyChange: null, fastChange: null }
  if (end === null || typeof athleteId !== 'string' || !athleteId.trim()) return empty

  const days = new Map()
  for (const row of Array.isArray(rows) ? rows : []) {
    const time = calendarTime(row?.logged_at)
    const weight = parseInputNumber(row?.weight)
    if (row?.athlete_id !== athleteId || time === null || time > end || !(weight > 0)) continue
    const created = String(row.created_at || '')
    const prior = days.get(row.logged_at)
    if (!prior || created > prior.created) days.set(row.logged_at, { date: row.logged_at, time, weight, created })
  }
  const ordered = [...days.values()].sort((a, b) => a.time - b.time)
  let left = 0
  const daily = ordered.map((row, index) => {
    while (ordered[left].time < row.time - 6 * DAY) left++
    const window = ordered.slice(left, index + 1)
    return { date: row.date, weight: row.weight, average: average(window), days: window.length }
  })
  const windows = [0, 7, 14].map(offset => {
    const until = end - offset * DAY
    const window = ordered.filter(row => row.time >= until - 6 * DAY && row.time <= until)
    return { average: average(window), days: window.length }
  })
  const weeklyChange = change(windows[0].average, windows[1].average)
  const previousWeeklyChange = change(windows[1].average, windows[2].average)
  // Suppress floating-point noise at exactly 1%, without rounding display values.
  const exceeds = percent => Math.abs(percent) > 1 + Number.EPSILON * 128
  const fastChange = weeklyChange === null || previousWeeklyChange === null ? null
    : exceeds(weeklyChange.percent) && exceeds(previousWeeklyChange.percent)
      && Math.sign(weeklyChange.kg) === Math.sign(previousWeeklyChange.kg)
  return { daily, average: windows[0].average, days: windows[0].days,
    weeklyChange, previousWeeklyChange, fastChange }
}
