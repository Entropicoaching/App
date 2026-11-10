import { addCalendarDays, calendarDay } from '../../calendarDate.js'

// L4 (U3-planen afsnit 1): atletens egne rækker til ugekortet og blok for blok.
// Hver del følger R2: der hentes loft plus 1, og findes række loft plus 1, eller
// fejler læsningen, er delen ukendt, ikke tom.
export const L4_CAPS = Object.freeze({ readiness: 100, meals: 1000, weeks: 60, logs: 1000 })
export const L4_MEAL_COLUMNS = 'id, date, meal, kcal, protein, carb, fat'
export const L4_WEEK_COLUMNS = 'id, week_number, start_date, block_name, athlete_id, sessions(id, exercises(id, name, sets))'
export const L4_LOG_COLUMNS = 'athlete_id, exercise_id, set_number, logged_at, weight, reps_completed, skipped'
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

export async function readAthleteU3(client, athleteId, today) {
  const day = calendarDay(today)
  if (!client || typeof client.from !== 'function' || !athleteId || !day) {
    return { day, readiness: unknown, meals: unknown, weeks: unknown, logs: unknown }
  }
  const since = addCalendarDays(day, -35)
  const [readiness, meals, weeks] = await Promise.all([
    capped(() => client.from('readiness_logs').select('logged_date, readiness_score')
      .eq('athlete_id', athleteId).gte('logged_date', since).order('logged_date'), L4_CAPS.readiness),
    capped(() => client.from('meal_logs').select(L4_MEAL_COLUMNS)
      .eq('athlete_id', athleteId).gte('date', since).order('date'), L4_CAPS.meals),
    capped(() => client.from('weeks').select(L4_WEEK_COLUMNS)
      .eq('athlete_id', athleteId).gte('start_date', addCalendarDays(day, -26 * 7)).order('start_date'), L4_CAPS.weeks),
  ])
  // Planrettelse: atletens exerciseLogs dækker kun den viste uge og har ikke
  // set_number for tidligere uger. Ugekortets pas og 50 %-reglen (5.3 nr. 5)
  // kræver sætlogs for de seneste programuger, så L4 læser dem her.
  let logs = unknown
  if (weeks.state === 'ready') {
    const recent = addCalendarDays(day, -42)
    const ids = weeks.rows.filter(w => typeof w?.start_date === 'string' && w.start_date >= recent && w.start_date <= day)
      .flatMap(w => (w.sessions ?? []).flatMap(s => (s?.exercises ?? []).map(e => e?.id))).filter(id => id != null)
    logs = ids.length === 0 ? { state: 'ready', rows: [] }
      : await capped(() => client.from('exercise_logs').select(L4_LOG_COLUMNS)
        .eq('athlete_id', athleteId).in('exercise_id', ids).order('logged_at'), L4_CAPS.logs)
  }
  return { day, readiness, meals, weeks, logs }
}

// Fremgang har to monteringer (ugekortet øverst og blok for blok nederst). De
// deler én L4-læsning pr. klient, atlet og dag i højst et minut.
const shared = new WeakMap()
export function readAthleteU3Shared(client, athleteId, today, { now = Date.now() } = {}) {
  if (!client || typeof client !== 'object') return readAthleteU3(client, athleteId, today)
  const cache = shared.get(client) ?? new Map()
  shared.set(client, cache)
  const key = `${athleteId}:${calendarDay(today)}`
  const hit = cache.get(key)
  if (hit && now - hit.at < 60000) return hit.promise
  const promise = readAthleteU3(client, athleteId, today)
  cache.set(key, { at: now, promise })
  return promise
}
