export const asOf = '2026-11-01'
const days = (n, fn) => Array.from({ length: n }, (_, i) => ({
  day: new Date(Date.UTC(2026, 10, 2 - n + i)).toISOString().slice(0, 10), ...fn(i),
}))
export function letterFixture() {
  return { state: 'ready', complete: true, athleteId: 'synthetic-athlete', asOf,
    daily: days(7, () => ({ source: 'athlete_manual', pain: 0, sleepHours: 7,
      sleepQuality: 3, energy: 3, stress: 3, soreness: 0 })),
    loadDays: [], weightDays: [],
    nutritionDays: days(28, () => ({ complete: true, proteinG: 100, targetG: 100, targetVersion: 'synthetic-v1' })),
    compliance: { complete: true, programVersion: 'synthetic-program',
      plannedIds: ['s1', 's2'], completedIds: ['s1'], extraIds: [] } }
}
export function emptyFixture() {
  return { ...letterFixture(), daily: [], nutritionDays: [], compliance: null }
}
