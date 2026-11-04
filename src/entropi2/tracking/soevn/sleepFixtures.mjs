// Synthetic records only; shared by the leaf's model and renderer tests.
import { addCalendarDays } from '../../../calendarDate.js'
export const athleteId = 'synthetic-sleep-athlete'
export const date = index => addCalendarDays('2026-09-24', index)
export const fixture = () => ({ status: 'ready', complete: true, athleteId,
  endDate: date(41), readinessRows: [], qualityRows: [], exerciseLogs: [] })
export const readiness = (index, extra = {}) => ({ athlete_id: athleteId,
  logged_date: date(index), sleep_hours: 7.5, ...extra })
export const quality = (index, extra = {}) => ({ athlete_id: athleteId,
  logged_date: date(index), sleep_quality: 4, ...extra })
export const set = (index, extra = {}) => ({ athlete_id: athleteId, id: `synthetic-set-${index}`,
  exercise_id: `synthetic-exercise-${index}`, session_id: `synthetic-session-${index}`,
  set_number: 1, logged_at: date(index), weight: 100, reps_completed: 3,
  rpe_actual: 8, rpe_source: 'athlete', exercises: { name: 'Squat' }, ...extra })
