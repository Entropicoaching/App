import { addCalendarDays, calendarDay } from '../../../calendarDate.js'
import { L4_WEEK_COLUMNS, L4_MEAL_COLUMNS } from '../../u3/readAthleteU3.mjs'

// L3 (U3-planen afsnit 4): én atlets blokke. Køres først, når sektionen eller
// folden åbnes. Hver del følger R2: loft plus 1 eller en fejl gør delen ukendt.
export const L3_CAPS = Object.freeze({ weeks: 60, logPage: 1000, logs: 5000, weights: 500, readiness: 500, meals: 1000 })
export const L3_LOG_COLUMNS = 'athlete_id, exercise_id, set_number, logged_at, weight, reps_completed, skipped, exercises(name, sessions(weeks(block_name)))'
const unknown = { state: 'unknown', rows: null }

async function capped(build, cap) {
  try {
    const result = await build().limit(cap + 1)
    if (result?.error || !Array.isArray(result?.data) || result.data.length > cap) return unknown
    return { state: 'ready', rows: result.data }
  } catch {
    return unknown
  }
}

// Sidevis i sider af 1000 og højst 5000 rækker. Findes række 5001, er kilden ufuldstændig.
async function paged(build, page, max) {
  const rows = []
  try {
    for (;;) {
      const size = rows.length >= max ? 1 : page
      const result = await build().range(rows.length, rows.length + size - 1)
      if (result?.error || !Array.isArray(result?.data) || result.data.length > size) return unknown
      if (rows.length >= max) return result.data.length ? unknown : { state: 'ready', rows }
      rows.push(...result.data)
      if (result.data.length < size) return { state: 'ready', rows }
    }
  } catch {
    return unknown
  }
}

export async function readBlocks(client, athleteId, today, { withMeals = false, weeks = null } = {}) {
  const day = calendarDay(today)
  const empty = { day, weeks: unknown, logs: unknown, weights: unknown, readiness: unknown, meals: withMeals ? unknown : null }
  if (!client || typeof client.from !== 'function' || !athleteId || !day) return empty
  // Hos atleten genbruges ugerne fra L4.
  const weekPart = weeks?.state ? weeks : await capped(() => client.from('weeks').select(L4_WEEK_COLUMNS)
    .eq('athlete_id', athleteId).gte('start_date', addCalendarDays(day, -26 * 7)).order('start_date'), L3_CAPS.weeks)
  if (weekPart.state !== 'ready') return { ...empty, weeks: weekPart }
  const first = weekPart.rows.map(w => w?.start_date).filter(d => calendarDay(d)).sort()[0] ?? day
  const [logs, weights, readiness, meals] = await Promise.all([
    paged(() => client.from('exercise_logs').select(L3_LOG_COLUMNS).eq('athlete_id', athleteId)
      .gte('logged_at', `${addCalendarDays(first, -1)}T00:00:00Z`).order('logged_at').order('exercise_id').order('set_number'), L3_CAPS.logPage, L3_CAPS.logs),
    capped(() => client.from('weight_logs').select('weight, logged_at, created_at')
      .eq('athlete_id', athleteId).gte('logged_at', first).order('logged_at'), L3_CAPS.weights),
    capped(() => client.from('readiness_logs').select('logged_date, readiness_score')
      .eq('athlete_id', athleteId).gte('logged_date', first).order('logged_date'), L3_CAPS.readiness),
    withMeals ? capped(() => client.from('meal_logs').select(L4_MEAL_COLUMNS)
      .eq('athlete_id', athleteId).gte('date', addCalendarDays(day, -35)).order('date'), L3_CAPS.meals) : Promise.resolve(null),
  ])
  return { day, weeks: weekPart, logs, weights, readiness, meals }
}
