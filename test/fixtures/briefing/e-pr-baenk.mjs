// E: Slog PR paa baenk mandag 22. sep. (100x3 mod tidligere 97,5x3).
import { buildAthlete, defaultSession, mainLift } from './helpers.mjs'

export default buildAthlete({
  id: 'syn-e', name: 'Atlet E',
  about: 'PR paa baenk 100x3 (tidligere bedste 97,5x3)',
  session: (w, p) => {
    const sets = defaultSession(w, p)
    if (w !== 7 || p !== 0) return sets
    return [...sets.slice(0, 3), ...mainLift('Bænk', 100, { reps: 3, rpe: 9, actual: 9, backoffActual: 7 })]
  },
  personal_records: [
    { exercise_name: 'Bænk', weight: 97.5, reps: 3, created_at: '2026-06-18T17:00:00Z' },
    { exercise_name: 'Bænk', weight: 100, reps: 3, created_at: '2026-09-22T17:05:00Z' },
  ],
})
