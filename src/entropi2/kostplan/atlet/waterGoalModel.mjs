import { vaeskeForslag } from '../anbefalinger.mjs'

// Atletens eget daglige væskemål (U1). Gemmes kun på enheden, ligesom væskeloggen.
// Grænserne er tekniske værn mod tastefejl, ikke en anbefaling. Et forslag vises
// først, når kostbilaget har et tal med kilde; appen opfinder intet tal.
export const waterGoalLimits = Object.freeze({ min: 500, max: 8000 })
const schema = 'entropi2-water-goal/v1'

export const waterGoalKey = athleteId => typeof athleteId === 'string' && athleteId.trim() && athleteId.length <= 128
  ? `entropi2:water-goal:v1:${encodeURIComponent(athleteId)}` : null

export function waterGoalValue(value) {
  const text = typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim().replace(/\./g, '') : ''
  if (!/^\d{3,4}$/.test(text)) return null
  const ml = Number(text)
  return ml >= waterGoalLimits.min && ml <= waterGoalLimits.max ? ml : null
}

export function readWaterGoal(storage, athleteId) {
  const key = waterGoalKey(athleteId)
  if (!key) return null
  try {
    const raw = storage?.getItem(key)
    if (raw == null) return null
    const value = JSON.parse(raw)
    if (value?.schema !== schema || value.athleteId !== athleteId) return null
    return waterGoalValue(value.ml)
  } catch { return null }
}

// Returnerer det gemte tal, eller null hvis enheden ikke kunne bekræfte gemningen.
export function saveWaterGoal(storage, athleteId, input) {
  const key = waterGoalKey(athleteId), ml = waterGoalValue(input)
  if (!key || ml === null) return null
  try {
    const value = JSON.stringify({ schema, athleteId, ml })
    storage.setItem(key, value)
    return storage.getItem(key) === value ? ml : null
  } catch { return null }
}

export function waterProgress(totalMl, goalMl) {
  const total = Number.isFinite(totalMl) && totalMl > 0 ? totalMl : 0
  if (!goalMl) return { total, goal: null, fraction: 0, reached: false, missing: null }
  return { total, goal: goalMl, fraction: Math.min(1, total / goalMl), reached: total >= goalMl,
    missing: Math.max(0, goalMl - total) }
}

export function waterSuggestion(weightKg) {
  return vaeskeForslag(weightKg)
}
