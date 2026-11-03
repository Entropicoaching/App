import { addCalendarDays } from '../../../calendarDate.js'

export function fixture(count = 4) {
  const athleteId = 'synthetic-athlete', start = '2026-09-28', end = addCalendarDays(start, count * 7 - 1)
  const proof = { athleteId, blockId: 'synthetic-block', from: start, through: end, complete: true }
  const plan = Array.from({ length: count }, (_, i) => ({ athlete_id: athleteId, block_id: proof.blockId,
    start_date: addCalendarDays(start, i * 7), block_name: 'Syntetisk blok',
    sessions: [{ id: `s${i}`, exercises: [{ id: `e${i}`, name: 'Squat', sets: 2 }] }] }))
  const logs = plan.flatMap((w, i) => [1, 2].map(set => ({ id: `log${i}-${set}`, athlete_id: athleteId,
    exercise_id: `e${i}`, set_number: set, logged_at: w.start_date,
    weight: 100 + i * 5, reps_completed: 3, rpe_actual: 8, rpe_source: 'athlete' })))
  const weights = plan.flatMap((w, i) => [0, 1, 2].map(day => ({ athlete_id: athleteId,
    date: addCalendarDays(w.start_date, day), weight: 80 + i })))
  return { athleteId, blocks: { athleteId, through: '2026-11-10', complete: true,
    rows: [{ id: proof.blockId, athlete_id: athleteId, start_date: start, end_date: end, name: 'Syntetisk blok' }] },
    plan: { ...proof, rows: plan }, logs: { ...proof, rows: logs }, weights: { ...proof, rows: weights } }
}
export const today = '2026-11-10'
