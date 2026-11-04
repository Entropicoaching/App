// Synthetic replacement for the public bundle's omitted e2e/fixtures.mjs.
// Matches only the three current-week squat rows required by beregn.test.js.
export function buildSeed({ withLogs = true } = {}) {
  return { tables: {
    exercises: [{ id: 'synthetic-squat', name: 'Squat' }],
    exercise_logs: withLogs ? Array.from({ length: 3 }, (_, i) => ({
      exercise_id: 'synthetic-squat', set_number: i + 1,
      logged_at: new Date().toISOString(), skipped: false,
    })) : [],
  } }
}
