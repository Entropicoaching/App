export const today = '2026-11-04'
export function fixture() {
  const athleteId = 'synthetic-athlete'
  const receipt = (from, through, rows) => ({ athleteId, from, through, state: 'ready', complete: true, rows })
  const week = (start, through, kg, rpe) => ({ start,
    training: receipt(start, through, [
      { id: `${start}-set1`, athlete_id: athleteId, exercise_id: `${start}-ex`, set_number: 1,
        logged_at: `${start}T10:00:00Z`, weight: kg, reps_completed: 5, skipped: false,
        rpe_actual: rpe, rpe_source: 'athlete',
        exercises: { name: 'Squat', sessions: { id: `${start}-session`, weeks: { block_name: 'Basis' } } } },
      { id: `${start}-set2`, athlete_id: athleteId, exercise_id: `${start}-ex`, set_number: 2,
        logged_at: `${start}T10:01:00Z`, weight: kg, reps_completed: 3, skipped: false,
        rpe_actual: rpe + 1, rpe_source: 'athlete',
        exercises: { name: 'Squat backoff', sessions: { id: `${start}-session`, weeks: { block_name: 'Basis' } } } },
    ]),
    nutrition: receipt(start, through, [
      { id: `${start}-meal1`, athlete_id: athleteId, date: start, meal: 'Syntetisk måltid', kcal: kg * 10, protein: kg },
      { id: `${start}-meal2`, athlete_id: athleteId, date: start, meal: 'Syntetisk måltid', kcal: 500, protein: 30 },
    ]),
    weight: receipt(start, through, [
      { id: `${start}-weight1`, athlete_id: athleteId, logged_at: start, weight: kg / 2 + 30 },
      { id: `${start}-weight2`, athlete_id: athleteId, logged_at: start, weight: kg / 2 + 30 },
    ]),
  })
  return { athleteId, first: week('2026-10-26', '2026-11-01', 100, 7),
    second: week('2026-11-02', today, 110, 8) }
}
export const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }
  return value
}
