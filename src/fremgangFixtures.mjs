export const today = '2026-10-27'
export const weeks = [
  ['2026-10-05', 'Grundstyrke'], ['2026-10-12', 'Grundstyrke'],
  ['2026-10-19', 'Intensificering'], ['2026-10-26', 'Intensificering'],
].map(([start_date, block_name], i) => ({ id: `w${i + 1}`, athlete_id: 'a', week_number: i + 1, start_date, block_name,
  sessions: [{ exercises: ['Squat', 'Bænkpres', 'Dødløft', 'Sumo dødløft'].map((name, k) => ({ id: `e${i + 1}-${k}`, name })) }] }))
export function log(week, day, weight = 100, lift = 0, extra = {}) {
  return { id: `${week}-${day}-${lift}`, athlete_id: 'a', exercise_id: `e${week}-${lift}`, weight, reps_completed: 3,
    logged_at: `${day}T10:00:00Z`, exercises: { name: weeks[week - 1].sessions[0].exercises[lift].name }, ...extra }
}
export const logs = [log(1, '2026-10-05', 100), log(2, '2026-10-12', 105), log(3, '2026-10-19', 110), log(4, '2026-10-27', 115)]
export const options = { enabled: true, weeks, logs, today, athleteId: 'a' }
