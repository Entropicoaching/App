// Synthetic adult and energy basis. No athlete records, service or clock.
export const on = '2026-11-04'
export const ago = days => new Date(Date.parse(on + 'T00:00:00Z') - days * 86400000).toISOString().slice(0, 10)
export const plan = patch => ({ id: 'synthetic-plan', athleteId: 'synthetic-athlete', coachId: 'synthetic-coach',
  status: 'active', version: 1, kcal: 2800, createdOn: ago(28), ...patch })
export const nutrition = (patch = {}, kgPerWeek = 0) => ({ date: on, adult: true, weightKg: 80,
  goal: 'cut', intensity: 'moderate', training: { volume: 'moderate', intensity: 'moderate' },
  weights: Array.from({ length: 28 }, (_, i) => ({ date: ago(27 - i), kg: 80 + kgPerWeek * i / 7 })),
  dietDays: Array.from({ length: 28 }, (_, i) => ({ date: ago(27 - i), kcal: 2800, complete: true })), ...patch })
export const actor = { role: 'coach', id: 'synthetic-coach' }
export const setup = (p = {}, n = {}) => ({ enabled: true, plan: plan(p), nutrition: nutrition(n) })
export const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }
  return value
}
