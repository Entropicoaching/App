import { calendarDay, addCalendarDays } from '../../../calendarDate.js'

const validDay = day => typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day)
  && calendarDay(day) === day
const text = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 120
const mean = rows => rows.reduce((sum, row) => sum + row.value, 0) / rows.length
const order = (a, b) => a < b ? -1 : a > b ? 1 : 0

/** Existing coach readiness projection (coachuge/evaluate.mjs):
 * data = {state, complete, athleteId, asOf, daily:[{day, source, pain?, painLocation?}]}.
 * Caller supplies an authorized single-athlete snapshot; this module performs no IO.
 * Legacy soreness_level/sore_zones are NOT pain observations.
 */
export function buildPainHistory(options = {}) {
  if (options?.enabled !== true) return { state: 'off' }
  const { data, weeks = 6 } = options
  if (data?.state === 'loading') return { state: 'loading' }
  if (!data || data.state !== 'ready' || data.complete !== true || !text(data.athleteId)
    || !validDay(data.asOf) || !Number.isInteger(weeks) || weeks < 4 || weeks > 8
    || !Array.isArray(data.daily) || data.daily.length > 10000) return { state: 'error' }
  const from = addCalendarDays(data.asOf, 1 - weeks * 7)
  if (!from) return { state: 'error' }
  const recentFrom = addCalendarDays(data.asOf, -13)
  const previousFrom = addCalendarDays(data.asOf, -27)
  const previousTo = addCalendarDays(data.asOf, -14)
  const dates = new Set(), groups = new Map()
  let missingDays = 0, unlocatedDays = 0
  for (const row of data.daily) {
    if (!row || !validDay(row.day) || (row.athleteId != null && row.athleteId !== data.athleteId)
      || (row.athlete_id != null && row.athlete_id !== data.athleteId)) return { state: 'error' }
    if (row.day < from || row.day > data.asOf) continue
    if (row.source !== 'athlete_manual' || dates.has(row.day)) return { state: 'error' }
    dates.add(row.day)
    if (row.pain == null) { missingDays++; continue }
    if (!Number.isInteger(row.pain) || row.pain < 0 || row.pain > 10) return { state: 'error' }
    if (row.painLocation == null || row.painLocation === '') {
      if (row.pain > 0) return { state: 'error' }
      // A global zero does not establish zero pain for each body area.
      unlocatedDays++; continue
    }
    if (!text(row.painLocation)) return { state: 'error' }
    const area = row.painLocation.trim()
    if (!groups.has(area)) groups.set(area, [])
    groups.get(area).push({ day: row.day, value: row.pain })
  }
  const areas = [...groups].map(([name, observations]) => {
    observations.sort((a, b) => order(a.day, b.day))
    const high = observations.filter(row => row.value >= 7)
    const previous = observations.filter(row => row.day >= previousFrom && row.day <= previousTo)
    const recent = observations.filter(row => row.day >= recentFrom)
    const sufficient = previous.length >= 3 && recent.length >= 3
    const before = previous.length ? mean(previous) : null
    const after = recent.length ? mean(recent) : null
    const rising = sufficient && after - before >= 2 - Number.EPSILON * 16
    const history = Array.from({ length: weeks }, (_, index) => {
      const start = addCalendarDays(from, index * 7), end = addCalendarDays(start, 6)
      const rows = observations.filter(row => row.day >= start && row.day <= end)
      return { from: start, to: end, count: rows.length, average: rows.length ? mean(rows) : null }
    })
    return { name, count: observations.length, latest: observations.at(-1), high, rising,
      trend: { sufficient, previousFrom, previousTo, recentFrom, recentTo: data.asOf,
        previous, recent, before, after }, history, observations }
  }).sort((a, b) => Number(b.high.length > 0) - Number(a.high.length > 0)
    || Number(b.rising) - Number(a.rising) || order(a.name, b.name))
  return { state: areas.length ? 'ready' : 'empty', from, to: data.asOf, weeks, areas,
    missingDays, unlocatedDays, absentDays: weeks * 7 - dates.size }
}
