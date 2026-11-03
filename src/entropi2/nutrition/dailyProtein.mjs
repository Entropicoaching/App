import { parseInputNumber } from '../../athlete/kostNumbers.mjs'
import { displayNumber } from './startModel.mjs'

// Existing snapshot.logs already contains only this diary date's meals.
// Preserve individual entries (including identical meals); unknown is never zero.
export function mealProtein(logs) {
  return logs.map(row => ({
    meal: typeof row.meal === 'string' ? row.meal : 'Ugyldigt måltid',
    protein: parseInputNumber(row.protein),
  }))
}

// Reuse the same remainingToday result as "Tilbage i dag" and its rounding.
// The clock is supplied by the view, so tests never depend on wall-clock time.
export function eveningProtein(remaining, now) {
  const protein = remaining?.protein
  if (!(now instanceof Date) || !Number.isFinite(now.getTime()) || now.getHours() < 18
    || !Number.isFinite(protein) || protein <= 0 || displayNumber(protein) === '0') return null
  return `Til resten af dagen: ca. ${displayNumber(protein)} g protein`
}
