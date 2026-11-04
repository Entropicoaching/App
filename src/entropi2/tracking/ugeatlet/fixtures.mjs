// Synthetic fixtures only; no names, accounts or external data.
export const athleteId = 'synthetic-athlete'
export const day = index => `2026-11-0${index + 1}`
export const session = (id, extra = {}) => ({ athleteId, id, day: day(0), planned: true, completed: true, ...extra })
export const daily = (index, extra = {}) => ({ athleteId, day: day(index), source: 'athlete_manual', sleepHours: 7, energy: 3, ...extra })
export const set = (id, extra = {}) => ({ athleteId, id, day: day(0), exerciseId: 'synthetic-squat',
  variantId: 'synthetic-variant', unit: 'kg', kg: 100, reps: 5,
  confirmed: true, skipped: false, warmup: false, ...extra })
export const nutrition = (index, extra = {}) => ({ athleteId, day: day(index), complete: true,
  kcal: 1800, proteinG: 90, kcalTarget: 2000, proteinTargetG: 100, targetVersion: 'synthetic-v1', ...extra })
export const emptySnapshot = () => ({ status: 'ready', complete: true, athleteId,
  endDate: '2026-11-07', sessions: [], daily: [], nutritionDays: [], strength: null })
export const populatedSnapshot = () => ({ ...emptySnapshot(),
  sessions: [session('session-1'), session('session-2', { day: day(2), completed: false }),
    session('session-3', { day: day(3), planned: false })],
  daily: [0, 1, 2, 3].map(index => daily(index)),
  nutritionDays: [0, 1, 2, 3].map(index => nutrition(index)),
  strength: { exerciseId: 'synthetic-squat', variantId: 'synthetic-variant', label: 'Squat · testvariant',
    sets: [set('set-1'), set('set-2', { day: day(2), kg: 110, reps: 3 })] } })
