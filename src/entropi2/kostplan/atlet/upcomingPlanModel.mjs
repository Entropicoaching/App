import { calendarTime } from '../../../athlete/kostNumbers.mjs'
import { createPlanAdapter } from '../planAdapter.mjs'
import { readAthletePlan } from './dayModel.mjs'

// Calendar arithmetic from the route's real day; never move the diary's clock.
export function upcomingDates(today) {
  const time = calendarTime(today)
  if (time === null) return []
  return Array.from({ length: 4 }, (_, i) => new Date(time + i * 86400000).toISOString().slice(0, 10))
    .filter(date => calendarTime(date) !== null)
}

// 1916: en sendt uge, der starter senere end de 3 dage, kan vælges via "Se planen".
const NEXT_DAYS = 13
const ahead = (today, date) => (calendarTime(date) - calendarTime(today)) / 86400000
export function previewDates(today, planStart) {
  const dates = upcomingDates(today)
  const n = calendarTime(today) === null || calendarTime(planStart) === null ? 0 : ahead(today, planStart)
  return n > 0 && n <= NEXT_DAYS && !dates.includes(planStart) ? [...dates, planStart] : dates
}

// 1916: den nærmeste sendte og godkendte uge, der starter efter i dag og inden for 13 dage.
// Samme tabeller som planAdapter og markSeen; ingen skrivning. Fejl eller ingen plan giver null.
export async function readNextPlanStart({ client, athleteId, today }) {
  try {
    if (typeof client?.from !== 'function' || typeof athleteId !== 'string' || !athleteId || calendarTime(today) === null) return null
    const last = new Date(calendarTime(today) + NEXT_DAYS * 86400000).toISOString().slice(0, 10)
    const ok = result => (result && !result.error && Array.isArray(result.data) ? result.data : null)
    const inWindow = value => calendarTime(value) !== null && value > today && value <= last
    const plans = (ok(await client.from('kostplan_v1_plans').select('id,athlete_id,valid_from,status').eq('athlete_id', athleteId)
      .eq('status', 'godkendt').gte('valid_from', today).lte('valid_from', last).limit(50)) || [])
      .filter(p => p.athlete_id === athleteId && p.status === 'godkendt' && inWindow(p.valid_from))
    if (!plans.length) return null
    const ids = plans.map(p => p.id)
    const versions = ok(await client.from('kostplan_v1_versions').select('id,plan_id,effective_from').in('plan_id', ids).limit(501))
    const approvals = ok(await client.from('kostplan_v1_approvals').select('version_id,plan_id,athlete_id').in('plan_id', ids).eq('athlete_id', athleteId).limit(501))
    if (!versions || !approvals) return null
    const sent = new Set(approvals.filter(a => a.athlete_id === athleteId).map(a => a.version_id))
    const starts = versions.filter(v => sent.has(v.id) && ids.includes(v.plan_id) && inWindow(v.effective_from)).map(v => v.effective_from).sort()
    return starts[0] ?? null
  } catch {
    return null
  }
}

const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }
  return value
}

// A read-only owner for one exact client/athlete/date. No diary contracts,
// storage, mutation methods or today-session callbacks enter this boundary.
export function createUpcomingPlan(options = {}) {
  if (options.enabled !== true) return null
  const { athleteId, today, date, client, planStart } = options
  if (date === today || !previewDates(today, planStart).includes(date)) throw new TypeError('Ugyldig forhåndsvisningsdato')
  const adapter = createPlanAdapter({ enabled: true, athleteId, date, client })
  const listeners = new Set()
  let disposed = false, token = 0, attempted = false
  let state = freeze({ athleteId, date, phase: 'idle', plan: null })
  const publish = (phase, plan = null) => {
    state = freeze({ athleteId, date, phase, plan })
    for (const fn of listeners) fn()
  }
  return Object.freeze({
    snapshot: () => state,
    subscribe(fn) { if (disposed) return () => {}; listeners.add(fn); return () => listeners.delete(fn) },
    async load() {
      if (disposed) return false
      const attempt = ++token, freshAvailability = attempted
      attempted = true; publish('loading')
      try {
        const value = await adapter.loadActive({ requireAvailable: true, freshAvailability })
        if (disposed || token !== attempt) return false
        const plan = readAthletePlan(value, athleteId, date)
        publish(plan ? 'ready' : 'empty', plan); return true
      } catch (error) {
        if (disposed || token !== attempt) return false
        // Before the migration (no plans table) there is honestly no plan.
        if (error?.code === 'KOSTPLAN_UNAVAILABLE' && error.table === 'kostplan_v1_plans') { publish('empty'); return true }
        publish(error?.code === 'KOSTPLAN_UNAVAILABLE' ? 'unavailable' : 'read-error'); return false
      }
    },
    dispose() { disposed = true; token++; listeners.clear() },
  })
}
