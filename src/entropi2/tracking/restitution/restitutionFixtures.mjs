// Synthetic rows only. No application client, clock or real identities.
import { addCalendarDays } from '../../../calendarDate.js'
export const athleteId = 'synthetic-restitution-athlete'
export const date = index => addCalendarDays('2026-10-22', index)
export const readiness = (index, extra = {}) => ({ athlete_id: athleteId,
  logged_date: date(index), sleep_hours: 8, energy: 4, stress: 2, soreness_level: 2, ...extra })
export const set = (index, extra = {}) => ({ athlete_id: athleteId,
  id: `synthetic-set-${index}`, exercise_id: `synthetic-exercise-${index}`, set_number: 1,
  logged_at: date(index), weight: 100, reps_completed: 3, ...extra })
export const fixture = () => ({ status: 'ready', complete: true, dailySource: 'readiness_logs',
  athleteId, endDate: date(13), readinessRows: [7, 8, 9, 13].map(i => readiness(i)),
  exerciseLogs: [0, 6, 7, 13].map(i => set(i)) })
