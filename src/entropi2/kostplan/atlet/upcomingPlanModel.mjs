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

const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }
  return value
}

// A read-only owner for one exact client/athlete/date. No diary contracts,
// storage, mutation methods or today-session callbacks enter this boundary.
export function createUpcomingPlan(options = {}) {
  if (options.enabled !== true) return null
  const { athleteId, today, date, client } = options
  if (date === today || !upcomingDates(today).includes(date)) throw new TypeError('Ugyldig forhåndsvisningsdato')
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
        publish(error?.code === 'KOSTPLAN_UNAVAILABLE' ? 'unavailable' : 'read-error'); return false
      }
    },
    dispose() { disposed = true; token++; listeners.clear() },
  })
}
