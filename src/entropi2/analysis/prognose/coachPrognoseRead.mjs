import { addCalendarDays, calendarDay } from '../../../calendarDate.js'

const columns = 'id, athlete_id, exercise_id, set_number, logged_at, weight, reps_completed, skipped, exercises(name, sessions(weeks(block_name)))'
const pageSize = 250

// Read-only, athlete-scoped snapshot. An incomplete or failed read is never
// passed to the forecast as an empty/successful history.
export async function readCoachPrognose(client, athleteId, now, isCurrent = () => true) {
  const today = calendarDay(now)
  if (typeof athleteId !== 'string' || !athleteId.trim() || !today || !Number.isFinite(new Date(now).getTime()))
    throw new Error('Invalid forecast scope')
  const rows = []
  // One extra calendar day covers the Copenhagen/UTC boundary. The model owns
  // the exact 84-day eligibility window and future-date rejection.
  const since = addCalendarDays(today, -85)
  for (let page = 0; page < 20; page++) {
    if (!isCurrent()) return null
    const { data, error } = await client.from('exercise_logs').select(columns)
      .eq('athlete_id', athleteId).gte('logged_at', `${since}T00:00:00Z`)
      .lte('logged_at', new Date(now).toISOString())
      .order('logged_at', { ascending: true }).order('id', { ascending: true })
      .range(page * pageSize, (page + 1) * pageSize - 1)
    if (!isCurrent()) return null
    if (error || !Array.isArray(data) || data.length > pageSize ||
        data.some(row => !row || row.athlete_id !== athleteId))
      throw new Error('Forecast history unavailable')
    rows.push(...data)
    if (data.length < pageSize) return rows
  }
  throw new Error('Forecast history incomplete')
}
