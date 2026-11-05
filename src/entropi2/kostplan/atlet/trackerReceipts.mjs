import { mealKey, metrics, namespace } from './dayModel.mjs'
import { parseInputNumber } from '../../../athlete/kostNumbers.mjs'

const identifier = value => typeof value === 'string' && value.trim() && value.length <= 200
const invalid = () => { throw new TypeError('Kostplanens lokale kvitteringer kunne ikke læses') }

// Only this athlete/day namespace is read or written. The diary itself remains
// in the existing meal_logs contract; these are local links to returned row IDs.
export function trackerReceipts(storage, athleteId, date) {
  const key = `${namespace}:${encodeURIComponent(athleteId)}:${date}`
  const read = () => {
    const raw = storage.getItem(key)
    if (raw === null) return []
    if (typeof raw !== 'string' || raw.length > 450000) invalid()
    const value = JSON.parse(raw)
    if (value?.namespace !== namespace || value.athlete_id !== athleteId || value.date !== date
      || !Array.isArray(value.receipts) || value.receipts.length > 300) invalid()
    const entries = value.receipts
    for (const entry of entries) {
      if (!identifier(entry?.meal_id) || !identifier(entry.plan_id) || !identifier(entry.plan_revision)
        || entry.key !== mealKey(athleteId, date, { id: entry.plan_id, revision: entry.plan_revision }, entry.meal_id)
        || !['pending', 'confirmed'].includes(entry.state)
        || (entry.state === 'confirmed' && (!identifier(entry.log_id) || entry.log_id.startsWith('local:')))
        || !identifier(entry.log?.meal) || metrics.some(metric => parseInputNumber(entry.log[metric]) === null)
        || !Array.isArray(entry.foods) || !entry.foods.length || entry.foods.length > 100
        || entry.foods.some(food => !identifier(food?.id) || parseInputNumber(food.grams) === null)
        || new Set(entry.foods.map(food => food.id)).size !== entry.foods.length) invalid()
    }
    if (new Set(entries.map(entry => entry.key)).size !== entries.length
      || new Set(entries.filter(entry => entry.state === 'confirmed').map(entry => entry.log_id)).size
        !== entries.filter(entry => entry.state === 'confirmed').length) invalid()
    return entries
  }
  const write = entries => {
    if (entries.length > 300) invalid()
    const raw = JSON.stringify({ namespace, athlete_id: athleteId, date, receipts: entries })
    if (raw.length > 450000) invalid()
    storage.setItem(key, raw)
    // A storage adapter that silently drops writes must not enable an insert.
    if (storage.getItem(key) !== raw) throw new Error('Kvitteringen blev ikke gemt')
  }
  return { read, write }
}

export const sameLoggedMeal = (row, entry) => row.meal === entry.log.meal
  && metrics.every(metric => parseInputNumber(row[metric]) === parseInputNumber(entry.log[metric]))
