import { dayNumber, requireId } from '../trackingDates.mjs'
import { addCalendarDays } from '../../../calendarDate.js'
import { parseInputNumber } from '../../../athlete/kostNumbers.mjs'
import { mealTemplateItems } from '../../../athlete/kostSkabeloner.mjs'
import { isDayReceipt } from '../../../mealEvidence.mjs'

// Same scales and required scores as the existing readiness save path.
// No notes, zones, cycle data or derived health score are copied.
export const SCORE_FIELDS = Object.freeze(['energy', 'motivation', 'stress', 'soreness_level'])
const fields = ['sleep_hours', ...SCORE_FIELDS]
const emptyReadiness = () => Object.fromEntries(fields.map(key => [key, '']))
const blank = value => value == null || (typeof value === 'string' && !value.trim())

export function readinessValue(draft) {
  const result = {}
  for (const key of fields) {
    const value = blank(draft[key]) ? null : parseInputNumber(draft[key])
    if (key === 'sleep_hours') {
      if (!blank(draft[key]) && (value === null || value > 24)) throw new TypeError('Søvn skal være mellem 0 og 24 timer.')
    } else if (!Number.isInteger(value) || value < 1 || value > 5) {
      throw new TypeError('Vælg energi, motivation, stress og ømhed fra 1 til 5. Søvn er valgfri.')
    }
    result[key] = value
  }
  return result
}

export function weightValue(value) {
  const number = parseInputNumber(value)
  if (number === null || number <= 0) throw new TypeError('Skriv en vægt over 0 kg.')
  return number
}

export function cleanMeal(row) {
  const value = mealTemplateItems([row])?.[0]
  if (!value) return null
  value.meal = value.meal.trim()
  return isDayReceipt(value) ? null : value
}
export const mealKey = row => JSON.stringify([row.meal, row.kcal, row.protein, row.carb, row.fat])
export const preferenceKey = athleteId => 'entropi2:tracking:hurtig:last-meal:v1:' + encodeURIComponent(requireId(athleteId))

function daily(rows, athleteId, date, dateField) {
  const found = rows.filter(row => row?.athlete_id === athleteId && row[dateField] === date)
  if (found.length > 1) throw new TypeError('Conflicting daily entries')
  return found[0] ?? null
}
function readinessDraft(row) {
  if (!row) return emptyReadiness()
  // Partial historical answers stay blank; they never become zero or a guess.
  const draft = emptyReadiness()
  for (const key of fields) {
    if (blank(row[key])) continue
    const n = parseInputNumber(row[key])
    if (n === null || (key === 'sleep_hours' ? n > 24 : !Number.isInteger(n) || n < 1 || n > 5)) throw new TypeError('Invalid readiness history')
    draft[key] = String(n)
  }
  return draft
}

/** Pure projection of already authorized, complete snapshots. Never loads data. */
export function buildQuickModel({ athleteId, date, readinessRows, weightRows, mealRows }) {
  requireId(athleteId); dayNumber(date)
  if (![readinessRows, weightRows, mealRows].every(Array.isArray)) throw new TypeError('Complete arrays required')
  const yesterday = addCalendarDays(date, -1)
  dayNumber(yesterday)
  const previousReadiness = daily(readinessRows, athleteId, yesterday, 'logged_date')
  const currentReadiness = daily(readinessRows, athleteId, date, 'logged_date')
  const previousWeight = daily(weightRows, athleteId, yesterday, 'logged_at')
  const currentWeight = daily(weightRows, athleteId, date, 'logged_at')
  const yesterdayDraft = { readiness: readinessDraft(previousReadiness),
    weight: previousWeight ? String(weightValue(previousWeight.weight)) : '' }
  const ranked = new Map(), seenIds = new Map()
  let ignoredMeals = 0
  for (const row of mealRows) {
    if (row?.athlete_id !== athleteId) continue
    dayNumber(row.date)
    if (row.date > date) continue
    if (typeof row.meal === 'string' && isDayReceipt({ meal: row.meal.trim() })) continue
    const value = cleanMeal(row)
    if (!value) { ignoredMeals++; continue }
    if (typeof row.id === 'string' && row.id) {
      const signature = JSON.stringify([row.date, mealKey(value)])
      if (seenIds.has(row.id)) {
        if (seenIds.get(row.id) !== signature) throw new TypeError('Conflicting meal identity')
        continue
      }
      seenIds.set(row.id, signature)
    }
    const key = mealKey(value), entry = ranked.get(key)
    if (entry) { entry.count++; if (row.date > entry.lastDate) entry.lastDate = row.date }
    else ranked.set(key, { key, value, count: 1, lastDate: row.date })
  }
  const meals = [...ranked.values()].sort((a, b) => b.count - a.count || b.lastDate.localeCompare(a.lastDate) || a.key.localeCompare(b.key))
  return { athleteId, date, yesterday, yesterdayDraft, meals, ignoredMeals,
    canRepeat: fields.some(key => yesterdayDraft.readiness[key] !== '') || yesterdayDraft.weight !== '',
    readinessSource: currentReadiness ? 'today' : previousReadiness ? 'yesterday' : 'empty',
    weightSource: currentWeight ? 'today' : previousWeight ? 'yesterday' : 'empty',
    draft: { readiness: readinessDraft(currentReadiness ?? previousReadiness),
      weight: currentWeight ? String(weightValue(currentWeight.weight)) : yesterdayDraft.weight } }
}
