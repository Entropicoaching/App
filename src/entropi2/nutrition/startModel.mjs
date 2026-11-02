import { parseInputNumber, calendarTime } from '../../athlete/kostNumbers.mjs'

const positive = value => { const n = parseInputNumber(value); return n > 0 ? n : null }
export const displayNumber = value => value.toLocaleString('da-DK', { maximumFractionDigits: 1 })

// Advice describes the agreed targets; it never infers intake from missing logs.
export function startAdvice(targets) {
  const kcal = positive(targets.kcal), protein = positive(targets.protein)
  const tips = []
  if (protein) tips.push(`Fordel dit proteinmål på 4 måltider: cirka ${displayNumber(protein / 4)} g protein pr. måltid.`)
  if (kcal) tips.push(`Fordel dit energimål på 4 måltider: cirka ${displayNumber(kcal / 4)} kcal pr. måltid.`)
  if (protein && kcal) tips.push('Planlæg 4 måltider ud fra dine mål; du behøver ikke logge dem.')
  else if (protein) tips.push(`Planlæg 2 af dagens 4 måltider med tilsammen cirka ${displayNumber(protein / 2)} g protein.`)
  else if (kcal) tips.push(`Planlæg 2 af dagens 4 måltider med tilsammen cirka ${displayNumber(kcal / 2)} kcal.`)
  return { kcal, protein, tips }
}

// One measurement per calendar day; most recently created valid row wins.
// The week is the screen date and the preceding six days, not the last seven rows.
export function weightSummary(rows, athleteId, date) {
  const end = calendarTime(date), days = new Map()
  for (const row of Array.isArray(rows) ? rows : []) {
    const time = calendarTime(row?.logged_at), weight = positive(row?.weight)
    if (row?.athlete_id !== athleteId || time === null || time > end || !weight) continue
    const prior = days.get(row.logged_at)
    if (!prior || String(row.created_at || '') > String(prior.created_at || '')) days.set(row.logged_at, { ...row, weight })
  }
  const ordered = [...days.values()].sort((a, b) => b.logged_at.localeCompare(a.logged_at))
  const week = ordered.filter(row => calendarTime(row.logged_at) >= end - 6 * 86400000)
  // Divide before summing to keep even large finite fixtures finite.
  const average = week.length ? week.reduce((sum, row) => sum + row.weight / week.length, 0) : null
  return { latest: ordered[0] ? { weight: ordered[0].weight, date: ordered[0].logged_at } : null,
    average: Number.isFinite(average) ? average : null, days: week.length }
}
