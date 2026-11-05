import { antalOrd } from '../../antalOrd.mjs'
import { coachAthleteList } from '../athleteListModel.mjs'

const DAY = 86400000
const ordinal = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const stamp = Date.parse(`${value}T00:00:00Z`)
  return Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0, 10) === value ? stamp / DAY : null
}
const text = value => typeof value === 'string' && value.trim() ? value.trim() : null
const count = value => Number.isSafeInteger(value) && value >= 0
const decimal = value => value.toFixed(1).replace('.', ',')

// Normalized facts only. Every source carries its captured athleteId and Danish
// civil day. The caller must authorize/scoped-read these facts before adapting.
// No clock, I/O, authorization, diagnosis or inferred nutrition compliance.
export function athleteCardModel({ athlete, today, session, nutrition, weight, messages, signals } = {}) {
  const day = ordinal(today)
  if (day === null) throw new TypeError('today must be a valid YYYY-MM-DD')
  if (!text(athlete?.id)) throw new TypeError('athlete.id is required')
  const id = athlete.id
  const usable = source => source?.athleteId === id && source.day === today &&
    source.state === 'ready' && source.complete === true
  const unavailable = (source, label) => ({ state: source?.athleteId === id && source.day === today &&
    source.state === 'error' ? 'error' : 'unknown', text: `${label} ukendt` })

  let lastSession = unavailable(session, 'Seneste pas')
  if (usable(session)) {
    const last = ordinal(session.lastDay)
    if (session.lastDay === null) lastSession = { state: 'empty', text: 'Ingen registrerede pas' }
    else if (last !== null && last <= day) {
      const ago = day - last
      lastSession = { state: 'ready', day: session.lastDay,
        text: `Seneste pas ${ago === 0 ? 'i dag' : ago === 1 ? 'i går' : `for ${ago} ${antalOrd(ago, 'dag', 'dage')} siden`}` }
    }
  }
  let food = unavailable(nutrition, 'Koststatus')
  if (usable(nutrition) && count(nutrition.loggedDays) && nutrition.loggedDays <= 7 &&
    ordinal(nutrition.from) === day - 6 && nutrition.through === today) {
    food = { state: 'ready', loggedDays: nutrition.loggedDays,
      text: `Kost logget ${nutrition.loggedDays}/7 dage` }
  }
  let trend = unavailable(weight, 'Vægttrend')
  if (usable(weight) && ordinal(weight.from) === day - 13 && weight.through === today &&
    Array.isArray(weight.points)) {
    const seen = new Set(), weeks = [[], []]
    const valid = weight.points.every(point => {
      const date = ordinal(point?.day)
      if (date === null || date < day - 13 || date > day || seen.has(point.day) ||
        typeof point.kg !== 'number' || !Number.isFinite(point.kg) || point.kg <= 0) return false
      seen.add(point.day); weeks[date < day - 6 ? 0 : 1].push(point.kg)
      return true
    })
    if (valid && weeks.every(week => week.length >= 4)) {
      const mean = week => week.reduce((sum, kg) => sum + kg / week.length, 0)
      const delta = Math.round((mean(weeks[1]) - mean(weeks[0])) * 10) / 10
      if (Number.isFinite(delta)) trend = { state: 'ready', deltaKg: delta === 0 ? 0 : delta,
        samples: weeks.map(week => week.length),
        text: `Vægttrend ${delta > 0 ? '+' : ''}${decimal(delta === 0 ? 0 : delta)} kg · ugesnit` }
    } else if (valid) trend = { state: 'insufficient', text: 'Vægttrend: for få vejninger' }
  }
  let unread = unavailable(messages, 'Ulæste beskeder')
  if (usable(messages) && count(messages.count)) unread = { state: 'ready', count: messages.count,
    text: `${messages.count} ${antalOrd(messages.count, 'ulæst besked', 'ulæste beskeder')}` }

  const reportsUsable = usable(signals)
  const signalKnown = reportsUsable && typeof signals.painReported === 'boolean' &&
    typeof signals.deviationReported === 'boolean'
  const fact = { id, unreadMessages: unread.count,
    painReported: reportsUsable && signals.painReported === true,
    deviationReported: reportsUsable && signals.deviationReported === true }
  const result = coachAthleteList({ today, athletes: [fact] })[0]
  const signal = result.kind !== 'none'
    ? { state: 'ready', kind: result.kind, text: result.reason }
    : signalKnown && unread.state === 'ready'
      ? { state: 'ready', kind: 'none', text: result.reason }
      : { state: 'unknown', kind: 'unknown', text: 'Opfølgningssignal ukendt' }
  return { id, name: text(athlete.name) || 'Atlet', lastSession, nutrition: food, weight: trend,
    messages: unread, signal }
}
