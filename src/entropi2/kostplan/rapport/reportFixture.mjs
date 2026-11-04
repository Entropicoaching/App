// Synthetic data only; plans go through the actual copied public lifecycle.
import { createDraft, transitionPlan } from '../plan.mjs'

export const athleteId = 'synthetic-athlete'
export const coach = { id: 'synthetic-coach', role: 'coach' }
export const targets = { kcal: 2000, protein: 150, carb: 250, fat: 60 }

export function activePlan({ id = 'synthetic-plan', on = '2026-11-01', dailyTargets = targets } = {}) {
  return transitionPlan(createDraft({ id, athleteId, coachId: coach.id, createdOn: on, dailyTargets,
    meals: [{ id: 'synthetic-meal', name: 'Syntetisk måltid', items: [{ grams: 100,
      food: { name: 'Syntetisk mad', kcal100: 100, protein100: 10, carb100: 10, fat100: 2 } }] }] }),
  { to: 'active', actor: coach, on })
}

export function meal(date, id, amounts = {}) {
  return { id, athlete_id: athleteId, date, meal: 'Syntetisk måltid',
    kcal: 1000, protein: 100, carb: 100, fat: 25, ...amounts }
}

export function input(patch = {}) {
  return { enabled: true, athleteId, date: '2026-11-08', plans: [activePlan()],
    mealLogs: [meal('2026-11-02', 'log-1'), meal('2026-11-04', 'log-2', { kcal: 2500, protein: 180, carb: 220, fat: 60 })],
    weightLogs: [['2026-10-26', 78], ['2026-10-28', 79], ['2026-10-30', 80],
      ['2026-11-02', 80], ['2026-11-04', 81], ['2026-11-06', 82]]
      .map(([logged_at, weight]) => ({ athlete_id: athleteId, logged_at, weight, created_at: logged_at + 'T10:00:00Z' })),
    ...patch }
}

export function deepFreeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(deepFreeze); Object.freeze(value) }
  return value
}
