import { addCalendarDays } from '../../../calendarDate.js'
export const athleteId = 'synthetic-athlete'
export const date = i => addCalendarDays('2026-10-08', i)
export const fixture = () => ({ status: 'ready', complete: true, athleteId, endDate: date(27),
  dailyRows: [], exerciseLogs: [], mealRows: [], weightRows: [], sessions: [] })
export const daily = (i, extra = {}) => ({ athlete_id: athleteId, source: 'athlete_manual',
  logged_date: date(i), sleep_hours: 7, energy: 2, stress: 3, soreness: 0, readiness_score: 60, ...extra })
export const set = (i, extra = {}) => ({ athlete_id: athleteId, id: `set-${i}`, exercise_id: `lift-${i}`,
  set_number: 1, logged_at: date(i), weight: 100, reps_completed: 5,
  reference_e1rm: 125, exercises: { name: 'Squat' }, ...extra })
export const meal = (i, extra = {}) => ({ athlete_id: athleteId, date: date(i),
  meal: 'Syntetisk måltid', kcal: 2000, protein: 100, carb: 200, fat: 80, ...extra })
export const weight = (i, extra = {}) => ({ athlete_id: athleteId, logged_at: date(i), weight: 80, ...extra })
export const session = (i, extra = {}) => ({ athlete_id: athleteId, id: `session-${i}`,
  day: date(i), planned: true, completed: true, ...extra })
export const populated = () => ({ ...fixture(),
  dailyRows: Array.from({ length: 28 }, (_, i) => daily(i)),
  exerciseLogs: [0, 7, 14, 21].map((i, n) => set(i, { weight: n === 3 ? 80 : 100 })),
  mealRows: Array.from({ length: 28 }, (_, i) => meal(i)),
  weightRows: Array.from({ length: 28 }, (_, i) => weight(i)),
  sessions: [0, 7, 14, 21].map(i => session(i)),
})
