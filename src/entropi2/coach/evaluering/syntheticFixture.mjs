export function syntheticWeek() {
  const athleteId = 'synthetic-athlete'
  const row = extra => ({ athlete_id: athleteId, ...extra })
  const receipt = rows => ({ athleteId, from: '2026-10-26', through: '2026-11-01', state: 'ready', complete: true, rows })
  const log = (exercise_id, set_number, extra) => row({ id: `${exercise_id}-${set_number}`, exercise_id, set_number,
    logged_at: '2026-10-26T12:00:00Z', weight: 100, reps_completed: 3, ...extra })
  return { athleteId, athleteName: 'Syntetisk atlet', today: '2026-11-03',
    training: { ...receipt([
      log('squat', 1, { rpe_actual: 6, rpe_source: 'athlete', note: 'Smerte i knæet, stoppede.' }),
      log('squat', 2, { skipped: true, weight: null, reps_completed: null }),
      log('bench', 1, { weight: 50, reps_completed: 5, rpe_actual: 8 }),
    ]), week: { athlete_id: athleteId, start_date: '2026-10-26', block_name: 'Styrke', sessions: [
      { id: 'session-1', title: 'Pas 1', athlete_comment: 'Roligt pas', exercises: [
        { id: 'squat', name: 'Squat', sets: 2 }, { id: 'bench', name: 'Bænkpres', sets: 1 }] },
      { id: 'session-2', title: 'Pas 2', exercises: [{ id: 'row', name: 'Row', sets: 1 }] },
    ] } },
    nutrition: { ...receipt([
      row({ id: 'meal-1', date: '2026-10-26', meal: 'Syntetisk måltid', kcal: 1000, protein: 50 }),
      row({ id: 'meal-2', date: '2026-10-26', meal: 'Syntetisk måltid', kcal: 1000, protein: 50 }),
      row({ id: 'meal-3', date: '2026-10-28', meal: 'Syntetisk måltid', kcal: 2500, protein: 150 }),
    ]), target: row({ kcal_target: 2400, protein_target: 160 }) },
    weights: { ...receipt([
      row({ id: 'weight-0', logged_at: '2026-10-19T12:00:00Z', weight: 79 }),
      row({ id: 'weight-1', logged_at: '2026-10-26T08:00:00Z', weight: 80 }),
      row({ id: 'weight-2', logged_at: '2026-10-26T12:00:00Z', weight: 82 }),
      row({ id: 'weight-3', logged_at: '2026-10-28T12:00:00Z', weight: 83 }),
    ]), from: '2026-10-19' },
    messages: receipt([row({ id: 'message-1', created_at: '2026-10-30T12:00:00Z', sender_role: 'athlete', content: 'En syntetisk besked.' })]),
  }
}
