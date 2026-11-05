// Synthetic records only; no clock, storage, service or athlete data.
import { dayReceipt } from '../../../mealEvidence.mjs'
import { on, ago, plan } from '../justering/fixture.mjs'
export { on, ago }
export function adjustmentFixture() {
  const athleteId = 'synthetic-athlete', coachId = 'synthetic-coach'
  const mealLogs = Array.from({ length: 27 }, (_, i) => {
    const date = ago(27 - i)
    const meal = { id: `synthetic-meal-${i}`, athlete_id: athleteId, date,
      meal: 'Syntetisk dagskost', kcal: 2800, protein: 180, carb: 340, fat: 80 }
    return [meal, { id: `synthetic-confirmation-${i}`, athlete_id: athleteId, ...dayReceipt([meal], date, on) }]
  }).flat()
  return { enabled: true, coachId, athleteId, date: on,
    receipt: { coachId, athleteId, date: on, state: 'ready', complete: true, from: ago(27), through: on,
      mealLogs, weightLogs: Array.from({ length: 28 }, (_, i) => ({ id: `synthetic-weight-${i}`,
        athlete_id: athleteId, logged_at: ago(27 - i) + 'T07:00:00Z', weight: 80 })),
      adjustmentBasis: { plan: plan(), adult: true, goal: 'cut', intensity: 'moderate',
        training: { volume: 'moderate', intensity: 'moderate' }, readiness: { energy: 3, hunger: 3 } } } }
}
export const hostProps = f => ({ enabled: true, athlete: { id: f.athleteId, kcal_target: 2800 },
  today: f.date, session: { user: { id: f.coachId } }, nutritionRead: f.receipt,
  weightStatus: { athleteId: f.athleteId, state: 'ready', rows: f.receipt.weightLogs } })
