import { load } from '../load.mjs'
import { nutritionTrend } from '../nutritionTrend.mjs'
import { weightTrend } from '../weightTrend.mjs'
import { calendarTime } from '../../../athlete/kostNumbers.mjs'
import { addCalendarDays } from '../../../calendarDate.js'

export const BASIS_DOMAINS = Object.freeze(['training', 'nutrition', 'weight', 'readiness'])
const token = value => typeof value === 'string' && value.length > 0 && value === value.trim()
const finite = value => typeof value === 'number' && Number.isFinite(value)
const mondayOf = day => addCalendarDays(day, -((new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7))

function sourceState(source, athleteId) {
  if (!source) return 'missing'
  if (source.athleteId !== athleteId) return 'invalid'
  if (['missing', 'loading', 'error', 'partial'].includes(source.state)) return source.state
  if (source.state !== 'ready' || !Array.isArray(source.rows)) return 'invalid'
  return source.complete === true ? 'ready' : 'partial'
}

function observations(domain, rows, athleteId, asOf) {
  // Filter identities BEFORE upstream de-duplication. Never accept user_id as id.
  const scoped = rows.filter(row => row?.athlete_id === athleteId && !row._optimistic)
  if (domain === 'training') {
    return new Map(load(scoped, asOf).days.filter(day => day.sets > 0)
      .map(day => [day.date, day.tonnage !== null]))
  }
  if (domain === 'nutrition') {
    return new Map(nutritionTrend(scoped, null, asOf).days.map(day =>
      [day.date, finite(day.totals.kcal) && finite(day.totals.protein)]))
  }
  const field = domain === 'weight' ? 'logged_at' : 'logged_date'
  const grouped = new Map()
  for (const row of scoped) {
    if (calendarTime(row[field]) === null || row[field] > asOf) continue
    const group = grouped.get(row[field]) ?? []
    group.push(row)
    grouped.set(row[field], group)
  }
  if (domain === 'weight') {
    const valid = new Set(weightTrend(scoped, athleteId, asOf).daily.map(day => day.date))
    return new Map([...grouped.keys()].map(date => [date, valid.has(date)]))
  }
  // Repeated copies of the same score do not add days. Conflicting or invalid
  // scores cannot establish a day's value; no arbitrary input-order winner.
  return new Map([...grouped].map(([date, group]) => {
    const scores = group.map(row => row.readiness_score)
    return [date, scores.every(score => finite(score) && score >= 0 && score <= 100)
      && new Set(scores).size === 1]
  }))
}

/**
 * Read-only coverage for ONE authorized athlete, four Monday-Sunday weeks.
 * Explicit YYYY-MM-DD cutoff includes that whole Danish calendar day.
 * sources[domain]: { athleteId, state, complete, rows }.
 * Ready requires complete=true for the entire displayed date range. Unknown,
 * failed, loading or truncated reads never become seven missing days or zero.
 * Counts describe retained dated logs, NOT complete sessions/meals or fitness
 * for a particular signal. Existing trend modules still own signal evidence.
 * No clock, flags, IO, writes or raw records in output. OFF does not read sources.
 */
export function weeklyDataBasis(options = {}) {
  if (options?.enabled !== true) return null
  const { athleteId, asOf } = options
  if (!token(athleteId) || calendarTime(asOf) === null) return { state: 'invalid', weeks: [] }
  const monday = mondayOf(asOf)
  const start = addCalendarDays(monday, -21)
  const oldestLoadDay = addCalendarDays(asOf, -27)
  // load evaluates weeklyLoad on every trailing day; even its oldest day's
  // preceding three weeks must fit the existing four-digit date contract.
  if (!start || !addCalendarDays(monday, 6) || !oldestLoadDay
    || !addCalendarDays(mondayOf(oldestLoadDay), -21)) return { state: 'invalid', weeks: [] }
  const sources = options.sources
  const domains = Object.fromEntries(BASIS_DOMAINS.map(domain => {
    const source = sources?.[domain]
    const state = sourceState(source, athleteId)
    return [domain, { state, days: state === 'ready'
      ? observations(domain, source.rows, athleteId, asOf) : null }]
  }))
  const weeks = Array.from({ length: 4 }, (_, index) => {
    const weekStart = addCalendarDays(start, index * 7)
    const weekEnd = addCalendarDays(weekStart, 6)
    const through = weekEnd < asOf ? weekEnd : asOf
    const dates = Array.from({ length: 7 }, (_, i) => addCalendarDays(weekStart, i)).filter(date => date <= through)
    return { weekStart, weekEnd, through, elapsedDays: dates.length, partial: through < weekEnd,
      domains: Object.fromEntries(BASIS_DOMAINS.map(domain => {
        const { state, days } = domains[domain]
        if (state !== 'ready') return [domain, { state, recordedDays: null, valueDays: null,
          missingDays: null, invalidDays: null }]
        const missingDays = dates.filter(date => !days.has(date))
        const invalidDays = dates.filter(date => days.has(date) && !days.get(date))
        return [domain, { state, recordedDays: dates.length - missingDays.length,
          valueDays: dates.length - missingDays.length - invalidDays.length,
          missingDays, invalidDays }]
      })) }
  })
  return { state: 'ready', athleteId, asOf, weeks }
}
