import { day, identifier } from './model.mjs'
import { inspectPortalDraft } from './portalModel.mjs'

// Calendar arithmetic uses the supplied existing today, never the device clock.
// UTC represents a date only; Copenhagen DST cannot skip or repeat a day.
export function overviewDates(today) {
  if (!day(today)) return null
  const start = Date.parse(`${today}T00:00:00Z`)
  const dates = Array.from({ length: 4 }, (_, index) => new Date(start + index * 86400000).toISOString().slice(0, 10))
  return dates.every(day) ? dates : null
}

export function danishPlanDate(date) {
  if (!day(date)) return ''
  return new Intl.DateTimeFormat('da-DK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${date}T12:00:00Z`))
}

export function readPlanDayOverview(options = {}) {
  if (options.enabled !== true) return null
  const { coachId, athleteId, today } = options
  if (!identifier(coachId) || !identifier(athleteId)) return null
  const dates = overviewDates(today)
  if (!dates) return null
  return dates.map(date => ({ date, ...inspectPortalDraft({ enabled: true, coachId, athleteId, date, storage: options.storage }) }))
}
