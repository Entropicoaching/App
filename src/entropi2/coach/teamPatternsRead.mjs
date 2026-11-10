import { addCalendarDays, calendarDay } from '../../calendarDate.js'
import { L3_LOG_COLUMNS } from '../analysis/blokforblok/readBlocks.mjs'

// L2 (U3-planen afsnit 3): kun når folden "Holdet samlet" åbnes. Skjulte atleter
// og atleter på ferie er fjernet af kalderen. R2: rammes loftet, er delen ukendt.
export const L2_CAPS = Object.freeze({ meals: 5000, logPage: 1000, logs: 10000 })
export const L2_LOG_COLUMNS = `athlete_id, ${L3_LOG_COLUMNS.replace(/^athlete_id, /, '')}`

export async function readTeamPatterns(client, athleteIds, today) {
  const day = calendarDay(today)
  const ids = [...new Set((athleteIds ?? []).filter(id => typeof id === 'string' && id))].sort()
  const empty = { day, ids, meals: null, logs: null }
  if (!client || typeof client.from !== 'function' || !day || !ids.length) return empty
  const meals = (async () => {
    try {
      const result = await client.from('meal_logs').select('id, athlete_id, date, meal, kcal, protein, carb, fat')
        .in('athlete_id', ids).gte('date', addCalendarDays(day, -7)).lte('date', addCalendarDays(day, -1)).order('date').limit(L2_CAPS.meals + 1)
      return result?.error || !Array.isArray(result?.data) || result.data.length > L2_CAPS.meals ? null : result.data
    } catch { return null }
  })()
  const logs = (async () => {
    const rows = []
    try {
      for (;;) {
        const size = rows.length >= L2_CAPS.logs ? 1 : L2_CAPS.logPage
        const result = await client.from('exercise_logs').select(L2_LOG_COLUMNS).in('athlete_id', ids)
          .gte('logged_at', `${addCalendarDays(day, -85)}T00:00:00Z`).order('logged_at').order('exercise_id').order('set_number')
          .range(rows.length, rows.length + size - 1)
        if (result?.error || !Array.isArray(result?.data) || result.data.length > size) return null
        if (rows.length >= L2_CAPS.logs) return result.data.length ? null : rows
        rows.push(...result.data)
        if (result.data.length < size) return rows
      }
    } catch { return null }
  })()
  return { day, ids, meals: await meals, logs: await logs }
}
