import { createPlanSnapshot } from './planSnapshot.mjs'
import { syntheticTables, tableNames } from './coach/activation.fixture.mjs'
export const athleteId = 'synthetic-history-athlete', coachId = 'synthetic-history-coach', date = '2026-11-07'
export const uuid = n => `30000000-0000-4000-8000-${String(n).padStart(12, '0')}`
export function storedSnapshot(kcal = 100, protein = 10) {
  return createPlanSnapshot({ goal: 'vedligehold', intensity: 0.1, meals: [{ name: 'Synthetic snapshot', portions: [{ grams: 100,
    food: { id: 'synthetic-stored', name: 'Stored synthetic food', preparation: 'synthetic', basisGrams: 100,
      nutrientsPer100g: { energyKcal: kcal, proteinG: protein, carbohydrateG: 0, fatG: null },
      source: { citation: 'synthetic fixture only', verification: 'synthetic' } } }] }] })
}
export function historyFixture(options = {}) {
  const f = syntheticTables(options)
  const plan = (n = 1, from = '2026-11-01', status = 'godkendt', athlete = athleteId) => {
    const row = { id: uuid(n), athlete_id: athlete, valid_from: from, status }; f.data[tableNames[0]].push(row); return row
  }
  const version = (n = 10, parent = uuid(1), effective = '2026-11-01', number = 1, kcal = 100, protein = 10) => {
    const row = { id: uuid(n), plan_id: parent, version_no: number, effective_from: effective, ...storedSnapshot(kcal, protein) }
    f.data[tableNames[1]].push(row); return row
  }
  const approve = (n = 10, parent = uuid(1), at = '2026-11-01T10:00:00.000001Z', athlete = athleteId) => {
    // Actual SQL columns: no fabricated approvals.id.
    const row = { version_id: uuid(n), plan_id: parent, athlete_id: athlete, approved_at: at, approval_kind: 'coach' }
    f.data[tableNames[2]].push(row); return row
  }
  return { ...f, plan, version, approve }
}
