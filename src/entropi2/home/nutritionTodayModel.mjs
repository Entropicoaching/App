import { calendarTime, parseInputNumber, roundNutrition } from '../../athlete/kostNumbers.mjs'

const format = value => roundNutrition(value).toLocaleString('da-DK')

// Optional, read-only daily snapshot. Missing totals are never treated as zero.
// The date guard also hides yesterday's snapshot after the home clock advances.
export function nutritionTodayModel(snapshot, today) {
  if (!snapshot || calendarTime(today) === null || snapshot.date !== today) return null
  const parts = []
  for (const [totalKey, targetKey, unit] of [
    ['kcal', 'kcalTarget', 'kcal'], ['protein', 'proteinTarget', 'g protein'],
  ]) {
    const total = parseInputNumber(snapshot[totalKey])
    const target = parseInputNumber(snapshot[targetKey])
    if (total === null || target === null || target < 1 ||
        total > Number.MAX_SAFE_INTEGER || target > Number.MAX_SAFE_INTEGER) continue
    parts.push(`${format(total)} af ${format(target)} ${unit}`)
  }
  return parts.length ? { text: `Kost i dag: ${parts.join(' · ')}` } : null
}
