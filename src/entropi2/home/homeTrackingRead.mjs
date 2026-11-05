import { calendarDay, addCalendarDays } from '../../calendarDate.js'

const columns = ['athlete_id', 'logged_date', 'sleep_hours', 'energy', 'motivation', 'stress', 'soreness_level']
export const HOME_READ_CAP = 100

// This boundary reuses the app client, with no auth lookup or new persistence.
// Tests inject a synthetic client; the default is loaded only after Home's own
// write-capability gate, never at module import, in OFF, or in another preview.
export async function readHomeReadiness({ athleteId, today, client } = {}) {
  if (typeof athleteId !== 'string' || !athleteId.trim() || typeof today !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(today) || calendarDay(today) !== today) return { status: 'error' }
  const from = addCalendarDays(today, -7)
  if (!from) return { status: 'error' }
  try {
    const database = client ?? (await import('../../supabase.js')).supabase
    const result = await database.from('readiness_logs').select(columns.join(','))
      .eq('athlete_id', athleteId).gte('logged_date', from).lte('logged_date', today)
      .order('logged_date').limit(HOME_READ_CAP)
    if (result?.error || !Array.isArray(result?.data) || result.data.length >= HOME_READ_CAP) throw Error()
    const dates = new Set()
    const readinessRows = Array.from(result.data, row => {
      if (!row || row.athlete_id !== athleteId || calendarDay(row.logged_date) !== row.logged_date ||
          row.logged_date < from || row.logged_date > today || dates.has(row.logged_date)) throw Error()
      dates.add(row.logged_date)
      return Object.fromEntries(columns.map(key => [key, row[key]]))
    })
    return { status: 'ready', complete: true, athleteId, today, readinessRows }
  } catch { return { status: 'error', athleteId, today } }
}

// Only wellbeing is loaded here. Home's compact presentation omits domains for
// which this adapter has no complete source; it never invents zero sessions or
// historical nutrition targets. Keep the existing seven COMPLETED days contract.
export function homeWeekSnapshot(data, athleteId, today) {
  if (data?.status !== 'ready' || data.complete !== true || data.athleteId !== athleteId || data.today !== today ||
      !Array.isArray(data.readinessRows)) return null
  const from = addCalendarDays(today, -7), dates = new Set()
  if (!from) return null
  for (const row of data.readinessRows) {
    if (!row || row.athlete_id !== athleteId || typeof row.logged_date !== 'string' ||
        calendarDay(row.logged_date) !== row.logged_date || row.logged_date < from || row.logged_date > today ||
        dates.has(row.logged_date)) return null
    dates.add(row.logged_date)
  }
  return { status: 'ready', complete: true, athleteId, endDate: addCalendarDays(today, -1),
    sessions: [], nutritionDays: [], strength: null,
    daily: data.readinessRows.filter(row => row.logged_date < today).map(row => ({
      athleteId, day: row.logged_date, source: 'athlete_manual', sleepHours: row.sleep_hours, energy: row.energy,
    })) }
}
