// Synthetic, anonymous fixtures shared by Node and real React tests.
export const names = ['Squat', 'Bænkpres', 'Dødløft', 'Sumo dødløft']
export function snapshot(extra = {}) {
  const weeks = ['2026-10-19', '2026-10-26', '2026-11-02'].map((start_date, i) => ({
    start_date, block_name: 'Styrke', sessions: [{ id: `session-${i}`, exercises:
      names.map((name, j) => ({ id: `ex-${i}-${j}`, name, sets: 1 })) }],
  }))
  const exerciseLogs = weeks.flatMap((week, i) => names.map((_, j) => ({
    id: `log-${i}-${j}`, exercise_id: `ex-${i}-${j}`, set_number: 1,
    logged_at: week.start_date, weight: 100 + j * 10 + i * 5, reps_completed: 3,
  })))
  return { entropi2: true, now: '2026-11-04T12:00:00Z',
    block: { start_date: '2026-10-19', end_date: '2026-11-08', weeks }, exerciseLogs, ...extra }
}
