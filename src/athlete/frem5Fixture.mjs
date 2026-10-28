import { addCalendarDays, calendarDay } from '../calendarDate.js'
export function fixture(now = '2026-10-27') {
  const today = calendarDay(now)
  const date = new Date(today + 'T12:00:00Z')
  const monday = addCalendarDays(today, -((date.getUTCDay() + 6) % 7))
  const names = ['Squat', 'Baenkpres', 'Doedloeft', 'Front squat', 'Sumo deadlift', 'Squat backoff', 'Squat top set']
  const allWeeks = Array.from({ length: 8 }, (_, i) => ({
    id: `w${i}`, athlete_id: 'synthetic', week_number: i + 1,
    block_name: i === 0 || i >= 3 && i <= 6 ? 'Styrke' : i < 3 ? 'Teknik' : 'Næste',
    start_date: addCalendarDays(monday, (i - 5) * 7),
    sessions: [{ id: `s${i}`, exercises: names.map((name, n) => ({ id: `e${i}-${n}`, name })) }],
  }))
  const currentWeek = allWeeks[5]
  const row = (week = 3, lift = 0, extra = {}) => ({
    id: `log-${week}-${lift}`, athlete_id: 'synthetic', exercise_id: `e${week}-${lift}`, weight: 100,
    reps_completed: 3, logged_at: allWeeks[week].start_date + 'T12:00:00Z',
    exercises: { name: names[lift] }, ...extra,
  })
  return { allWeeks, currentWeek, fremgangLogs: [], now, row }
}
