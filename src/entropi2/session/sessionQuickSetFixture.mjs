// Synthetic identities and supplied rows only; never storage or services.
export function quickSetFixture() {
  const exercise = { id: 'quick-a', name: 'Løft A', sets: 3, reps: '5', recommended_weight: 80 }
  const other = { ...exercise, id: 'quick-b', name: 'Løft B', sets: 1, recommended_weight: 30, reps: '8' }
  const week = { id: 'quick-week', athlete_id: 'quick-athlete', sessions: [{ id: 'quick-session', exercises: [exercise, other] }] }
  const calls = []
  const p = { enabled: true, athleteId: 'quick-athlete', currentWeek: week, allWeeks: [week],
    exerciseLogs: [], logInputs: {}, pendingSyncKeys: [], parkedSets: [],
    setLogInputs(update) { p.logInputs = update(p.logInputs) }, parsePlannedRpe: () => 8,
    onLogSet(ex, set_number, total, reps, planned, input, options) {
      calls.push({ ex, set_number, total, reps, planned, input, options })
      p.exerciseLogs.push({ athlete_id: p.athleteId, exercise_id: ex.id, set_number,
        weight: Number(input.weight), reps_completed: reps, rpe_actual: input.rpe === '' ? null : Number(input.rpe),
        note: input.note, logged_at: new Date().toISOString() })
      return { phase: 'saved' }
    } }
  return { p, exercise, other, calls }
}
