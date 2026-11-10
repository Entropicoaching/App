import { addCalendarDays, calendarDay } from '../../calendarDate.js'

// L1 (U3-planen afsnit 2): readiness og noter for coachens synlige atleter.
// R2: der hentes loft plus 1. Rammer en af de to dele loftet eller fejler den,
// er hele L1 ufuldstændig, og ingen af de nye grunde vises for nogen.
export const L1_CAPS = Object.freeze({ readiness: 2000, notes: 1000 })

async function capped(build, cap) {
  try {
    const result = await build().limit(cap + 1)
    if (result?.error || !Array.isArray(result?.data) || result.data.length > cap) return null
    return result.data
  } catch {
    return null
  }
}

export async function readCoachAttention(client, athleteIds, today) {
  const day = calendarDay(today)
  const ids = Array.isArray(athleteIds) ? [...new Set(athleteIds.filter(id => typeof id === 'string' && id))].sort() : []
  const base = { day, ids, complete: false, readiness: null, notes: null }
  if (!client || typeof client.from !== 'function' || !day) return base
  if (!ids.length) return { ...base, complete: true, readiness: [], notes: [] }
  const [readiness, notes] = await Promise.all([
    capped(() => client.from('readiness_logs').select('athlete_id, logged_date, readiness_score, soreness_level')
      .in('athlete_id', ids).gte('logged_date', addCalendarDays(day, -35)).order('logged_date'), L1_CAPS.readiness),
    // Danske dage: hent fra dagen før, så tidszonen aldrig taber en note. Modellen filtrerer på dansk dato.
    capped(() => client.from('exercise_logs').select('athlete_id, logged_at, note')
      .in('athlete_id', ids).not('note', 'is', null).gte('logged_at', `${addCalendarDays(day, -15)}T00:00:00Z`).order('logged_at'), L1_CAPS.notes),
  ])
  return { ...base, complete: readiness !== null && notes !== null, readiness, notes }
}

// Rækkerne for én atlet, eller null når L1 ikke er komplet for netop dette sæt atleter og denne dag.
export function attentionFor(result, athleteId, day) {
  if (!result?.complete || result.day !== day || !result.ids.includes(athleteId)) return null
  return {
    readiness: result.readiness.filter(r => r?.athlete_id === athleteId),
    notes: result.notes.filter(r => r?.athlete_id === athleteId),
  }
}

// Takten fra U2's forside: ved start, ved focus og visibilitychange til synlig,
// og hvert 60. sekund, mens siden er synlig. Singleflight; et svar, der kommer
// efter stop eller efter et nyere svar, kasseres.
export const ATTENTION_REFRESH_MS = 60 * 1000
export function startAttentionRefresh(load, onResult, {
  doc = globalThis.document, win = globalThis.window, timers = globalThis, intervalMs = ATTENTION_REFRESH_MS,
} = {}) {
  let stopped = false, inFlight = null, issued = 0, applied = 0
  const visible = () => !doc || doc.visibilityState === undefined || doc.visibilityState === 'visible'
  const run = () => {
    if (stopped || inFlight) return inFlight
    const ticket = ++issued
    let started
    try { started = Promise.resolve(load()) } catch (error) { started = Promise.reject(error) }
    inFlight = started.then(result => {
      if (!stopped && ticket > applied) { applied = ticket; onResult(result) }
    }, () => {}).finally(() => { inFlight = null })
    return inFlight
  }
  const whenVisible = () => { if (visible()) run() }
  run()
  win?.addEventListener?.('focus', whenVisible)
  doc?.addEventListener?.('visibilitychange', whenVisible)
  const interval = timers.setInterval(whenVisible, intervalMs)
  return {
    refresh: whenVisible,
    stop() {
      stopped = true
      win?.removeEventListener?.('focus', whenVisible)
      doc?.removeEventListener?.('visibilitychange', whenVisible)
      timers.clearInterval(interval)
    },
  }
}
