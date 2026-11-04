// Synthetic, deterministic fixtures only. No names, IO, clock or private fields.
export const asOf = '2026-11-04'
const day = offset => new Date(Date.UTC(2026, 10, 4 + offset)).toISOString().slice(0, 10)
const days = (n, fn) => Array.from({ length: n }, (_, i) => ({ day: day(i - n + 1), ...fn(i) }))

export function athlete(athleteId) {
  const rows = days(28, () => ({}))
  return { athleteId,
    coachWeek: { state: 'ready', complete: true, athleteId, asOf,
      daily: days(7, () => ({ source: 'athlete_manual', pain: 0, soreness: 0,
        sleepHours: 7, sleepQuality: 3, energy: 3, stress: 3 })),
      loadDays: days(28, () => ({ known: true, tonnageKg: 100 })),
      strength: { exerciseId: 'synthetic-lift', variantId: 'synthetic-variant',
        sets: [-83, -82, -81, -2, -1, 0].map((offset, i) => ({ id: `synthetic-set-${i}`, day: day(offset),
          exerciseId: 'synthetic-lift', variantId: 'synthetic-variant', unit: 'kg',
          kg: 100, reps: 3, confirmed: true, skipped: false, deload: false })) },
      nutritionDays: days(28, () => ({ complete: true, proteinG: 100, targetG: 100, targetVersion: 'synthetic-target' })),
      weightDays: days(14, () => ({ kg: 80 })),
      compliance: { complete: true, programVersion: 'synthetic-program', plannedIds: ['synthetic-session'],
        completedIds: ['synthetic-session'], extraIds: [] } },
    sources: Object.fromEntries(['training', 'nutrition', 'weight', 'readiness'].map(domain => [domain,
      { athleteId, state: 'ready', complete: true, rows: rows.map(({ day }, i) => {
        const base = { athlete_id: athleteId, id: `synthetic-${domain}-${i}` }
        if (domain === 'training') return { ...base, logged_at: day, weight: 60, reps_completed: 5 }
        if (domain === 'nutrition') return { ...base, date: day, meal: 'synthetic-meal', kcal: 500, protein: 30, carb: 50, fat: 10 }
        if (domain === 'weight') return { ...base, logged_at: day, weight: 80 }
        return { ...base, logged_date: day, readiness_score: 60 }
      }) }])) }
}

export function options(athletes = []) {
  return { enabled: true, asOf, roster: { state: 'ready', complete: true,
    athleteIds: athletes.map(a => a.athleteId) }, athletes }
}
