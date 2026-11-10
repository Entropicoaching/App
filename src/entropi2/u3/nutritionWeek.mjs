import { isDayReceipt, confirmedMealDays } from '../../mealEvidence.mjs'
import { calendarDay } from '../../calendarDate.js'

// R5 (U3-planen 0.2): en kostdag er en afsluttet dato med mindst én måltidsrække,
// som ikke er en kvittering. En brugbar kostdag kræver kcal mindst 60 % af
// kcal_target eller en kvittering via confirmedMealDays. Dagen i dag tæller aldrig.
export const USABLE_KCAL_SHARE = 0.6

const finite = value => typeof value === 'number' && Number.isFinite(value)
const positive = value => finite(value) && value > 0

export function mealDays(rows, { today, kcalTarget } = {}) {
  const day = calendarDay(today)
  if (!day || !Array.isArray(rows)) return []
  const valid = rows.filter(r => r && typeof r.date === 'string' && calendarDay(r.date) === r.date && r.date < day)
  const confirmed = new Set(confirmedMealDays(valid).map(r => r.date))
  const byDate = new Map()
  for (const row of valid) {
    if (isDayReceipt(row)) continue
    const list = byDate.get(row.date) ?? []
    list.push(row)
    byDate.set(row.date, list)
  }
  return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, meals]) => {
    const kcalKnown = meals.every(r => finite(r.kcal) && r.kcal >= 0)
    const proteinKnown = meals.every(r => finite(r.protein) && r.protein >= 0)
    const kcal = kcalKnown ? meals.reduce((n, r) => n + r.kcal, 0) : null
    const protein = proteinKnown ? meals.reduce((n, r) => n + r.protein, 0) : null
    const isConfirmed = confirmed.has(date)
    const usable = isConfirmed || (positive(kcalTarget) && kcal !== null && kcal >= USABLE_KCAL_SHARE * kcalTarget)
    return { date, kcal, protein, confirmed: isConfirmed, usable }
  })
}

const average = values => values.length ? values.reduce((n, v) => n + v, 0) / values.length : null

// Kost pr. uge (afsnit 5.1). start og end er kalenderdage (begge med). Gennemsnit
// på kostdage og på brugbare kostdage holdes adskilt; et manglende tal er null, aldrig 0.
export function weekNutrition(rows, { start, end, today, kcalTarget, proteinTarget } = {}) {
  if (!calendarDay(start) || !calendarDay(end)) return null
  const days = mealDays(rows, { today, kcalTarget }).filter(d => d.date >= start && d.date <= end)
  const usable = days.filter(d => d.usable)
  const proteins = days.map(d => d.protein)
  const usableKcal = usable.map(d => d.kcal), usableProtein = usable.map(d => d.protein)
  const proteinGoal = positive(proteinTarget) ? proteinTarget : null
  return {
    start, end,
    days: days.length,
    usableDays: usable.length,
    dates: days.map(d => d.date),
    proteinAverage: proteins.length && proteins.every(finite) ? average(proteins) : null,
    usableKcalAverage: usableKcal.length && usableKcal.every(finite) ? average(usableKcal) : null,
    usableProteinAverage: usableProtein.length && usableProtein.every(finite) ? average(usableProtein) : null,
    proteinTarget: proteinGoal,
    proteinHitDays: proteinGoal === null || !proteins.every(finite) ? null : days.filter(d => d.protein >= proteinGoal).length,
  }
}
