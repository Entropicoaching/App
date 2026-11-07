import { activityDay } from '../../../dashboard/coachInactive.mjs'

export const RADAR_WEIGHTS = Object.freeze({
  messages: 50, videos: 45, missed: 35, rpe: 30, pain: 55,
  readiness: 25, sleep: 20, block: 15, competition: 10, noLog: 20,
})
export const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0
export const civilDay = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && activityDay(value) === value
export const ordinal = day => civilDay(day) ? Date.parse(`${day}T00:00:00Z`) / 86400000 : null
export const shiftDay = (day, days) => civilDay(day) ? new Date((ordinal(day) + days) * 86400000).toISOString().slice(0, 10) : null
const positiveCount = n => Number.isSafeInteger(n) && n > 0
const signal = (key, reason, basis) => ({ key, points: RADAR_WEIGHTS[key], reason, basis })
const quantity = (n, one, many) => `${n} ${n === 1 ? one : many}`
const display = value => Number(value.toFixed(1)).toString().replace('.', ',')

export function unansweredMessages(facts) {
  const n = facts?.pendingMessages
  return positiveCount(n) ? signal('messages', quantity(n, 'samtale venter på svar', 'samtaler venter på svar'), `${n} samtaler med seneste besked fra atleten`) : null
}
export function unansweredVideos(facts) {
  const n = facts?.pendingVideos
  return positiveCount(n) ? signal('videos', quantity(n, 'video venter på feedback', 'videoer venter på feedback'), `${n} indsendte videoer i kladde`) : null
}
export function missedSessions(facts) {
  const n = facts?.missedSessions
  return positiveCount(n) ? signal('missed', quantity(n, 'pas uden log i afsluttet uge', 'pas uden log i afsluttet uge'), 'Planlagte pas i den senest afsluttede programuge sammenholdt med træningsloggen') : null
}

// Two adjacent seven-day windows, at least three observed days in each.
// Missing values never become zero. Duplicate dates are ambiguous, not extra votes.
export function trendBasis(series, today, min, max, threshold, direction = 1) {
  if (!civilDay(today) || !Array.isArray(series)) return null
  const seen = new Set(), previous = [], recent = [], T = ordinal(today)
  let latest = -Infinity
  for (const point of series) {
    if (!civilDay(point?.day) || ordinal(point.day) > T || seen.has(point.day)) return null
    seen.add(point.day)
    const age = T - ordinal(point.day)
    if (age > 13 || point.value == null) continue
    if (typeof point.value !== 'number' || !Number.isFinite(point.value) || point.value < min || point.value > max) return null
    latest = Math.max(latest, ordinal(point.day))
    const window = age <= 6 ? recent : previous
    window.push(point.value)
  }
  if (previous.length < 3 || recent.length < 3 || T - latest > 2) return null
  const mean = values => values.sort((a, b) => a - b).reduce((sum, n) => sum + n, 0) / values.length
  const before = mean(previous), after = mean(recent)
  if (direction * (after - before) + 1e-9 < threshold) return null
  return { before, after, previousDays: previous.length, recentDays: recent.length,
    from: shiftDay(today, -13), through: today }
}
const trendSignal = (key, reason, basis, unit) => basis ? signal(key, reason,
  `Ugesnit fra ${display(basis.before)} til ${display(basis.after)} ${unit}. ${basis.previousDays} og ${basis.recentDays} registrerede dage`) : null
export function risingRpe(facts, today) {
  return trendSignal('rpe', 'RPE stiger', trendBasis(facts?.rpe, today, 0, 10, 1), 'af 10')
}
export function risingPain(facts, today) {
  if (!Array.isArray(facts?.pain)) return null
  const candidates = facts.pain.flatMap(area => {
    if (typeof area?.location !== 'string' || !area.location.trim()) return []
    if (!Array.isArray(area.points) || area.points.some(p => p?.value != null && !Number.isInteger(p.value))) return []
    const basis = trendBasis(area.points, today, 0, 10, 2)
    return basis ? [{ location: area.location.trim(), basis }] : []
  }).sort((a, b) => (b.basis.after - b.basis.before) - (a.basis.after - a.basis.before) || compare(a.location, b.location))
  const first = candidates[0]
  return first ? trendSignal('pain', `Smerte stiger i ${first.location}`, first.basis, 'af 10') : null
}
export function fallingReadiness(facts, today) {
  return trendSignal('readiness', 'Dagsformen falder', trendBasis(facts?.readiness, today, 0, 100, 10, -1), 'af 100')
}
export function fallingSleep(facts, today) {
  return trendSignal('sleep', 'Søvnen falder', trendBasis(facts?.sleep, today, 0, 24, 1, -1), 'timer')
}
function upcoming(key, date, today, window, noun) {
  if (!civilDay(today) || !civilDay(date)) return null
  const days = ordinal(date) - ordinal(today)
  if (days < 0 || days > window) return null
  return signal(key, `${noun} ${days === 0 ? 'i dag' : `om ${quantity(days, 'dag', 'dage')}`}`, `Dato: ${date.split('-').reverse().join('.')}`)
}
export function endingBlock(facts, today) { return upcoming('block', facts?.blockEnd, today, 7, 'Blokken slutter') }
export function upcomingCompetition(facts, today) { return upcoming('competition', facts?.competitionDate, today, 21, 'Stævne') }
export function noRecentLog(facts) {
  return facts?.noLogFiveDays === true ? signal('noLog', 'Ingen træningslog i 5 dage', 'Komplet læsning uden træningslog i dag og de foregående 4 dage') : null
}
export const RADAR_RULES = Object.freeze([
  unansweredMessages, unansweredVideos, missedSessions, risingRpe, risingPain,
  fallingReadiness, fallingSleep, endingBlock, upcomingCompetition, noRecentLog,
])

// One contribution per rule and athlete. Total points, strongest reason, stable ID.
export function rankRadar(options = {}) {
  if (options.enabled !== true) return []
  const { entries, today } = options
  if (!civilDay(today) || !Array.isArray(entries)) return []
  const counts = new Map()
  for (const entry of entries) {
    const id = entry?.athlete?.id
    if (typeof id === 'string' && id.trim()) counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  return entries.flatMap(entry => {
    const athlete = entry?.athlete
    if (counts.get(athlete?.id) !== 1) return []
    const signals = RADAR_RULES.map(rule => rule(entry.facts, today)).filter(Boolean)
      .sort((a, b) => b.points - a.points || compare(a.key, b.key))
    return signals.length ? [{ athlete, signals, score: signals.reduce((sum, s) => sum + s.points, 0), reason: signals[0].reason }] : []
  }).sort((a, b) => b.score - a.score || b.signals[0].points - a.signals[0].points || compare(a.athlete.id, b.athlete.id))
}
