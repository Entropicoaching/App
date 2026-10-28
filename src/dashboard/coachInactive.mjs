// APP-COACH9: reuse the existing non-skipped activity read. No additional I/O.
const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Copenhagen', year: 'numeric', month: '2-digit', day: '2-digit' })
export function activityDay(value = new Date()) {
  if (typeof value === 'string') {
    if (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)) return null
    const day = value.slice(0, 10), stamp = Date.parse(day + 'T00:00:00Z')
    if (!Number.isFinite(stamp) || new Date(stamp).toISOString().slice(0, 10) !== day) return null
    if (value.length === 10) return day
    // Reject normalized invalid clock fields as well as timezone-less strings.
    const [hour, minute, second] = value.slice(11, 19).split(':').map(Number)
    if (hour > 23 || minute > 59 || second > 59) return null
  } else if (!(value instanceof Date)) return null
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return null
  const parts = Object.fromEntries(formatter.formatToParts(date).map(p => [p.type, p.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}
const ordinal = day => Date.parse(day + 'T00:00:00Z') / 86400000
export function inactiveTraining({ enabled = false, athletes = [], source, today = new Date(), loading = false, hasError = false } = {}) {
  if (enabled !== true) return { rows: [], unknown: 0, noSessions: 0 }
  const day = activityDay(today)
  // The existing query sorts newest first. A cap cannot hide a newer row
  // for an athlete already present, but absence from that window proves nothing.
  const usable = !loading && !hasError && day && ['ready', 'partial'].includes(source?.state) && source.day === day && Array.isArray(source.ids) && Array.isArray(source.rows)
  const latest = new Map(), invalid = new Set()
  if (usable) for (const log of source.rows) {
    if (!source.ids.includes(log?.athlete_id) || log.skipped === true) continue
    const loggedDay = typeof log.logged_at === 'string' ? activityDay(log.logged_at) : null
    if (!loggedDay || loggedDay > day) { invalid.add(log.athlete_id); continue }
    if (!latest.has(log.athlete_id) || latest.get(log.athlete_id) < loggedDay) latest.set(log.athlete_id, loggedDay)
  }
  const rows = [], seen = new Set()
  let unknown = 0, noSessions = 0
  for (const athlete of athletes) {
    if (!athlete?.id || seen.has(athlete.id)) continue
    seen.add(athlete.id)
    if (!usable || !source.ids.includes(athlete.id) || invalid.has(athlete.id)) { unknown++; continue }
    const lastDay = latest.get(athlete.id)
    if (!lastDay) { if (source.state === 'partial') unknown++; else noSessions++; continue }
    const days = ordinal(day) - ordinal(lastDay)
    if (days >= 3) rows.push({ athlete, days, lastDay })
  }
  rows.sort((a, b) => b.days - a.days || String(a.athlete.name).localeCompare(String(b.athlete.name), 'da') || String(a.athlete.id).localeCompare(String(b.athlete.id)))
  return { rows, unknown, noSessions }
}
export function readCoachActivity(enabled, ids, setStatus, run) {
  if (enabled !== true) return run()
  const token = {}, day = activityDay(), scope = ids.slice()
  const update = source => setStatus(previous => previous.activity?.token === token ? { ...previous, activity: { token, ...source } } : previous)
  setStatus(previous => ({ ...previous, activity: { token, state: 'loading' } }))
  return (async () => {
    try {
      const result = await run()
      update({ ids: scope, day, rows: result?.data,
        state: result?.error || !Array.isArray(result?.data) ? 'error' : result.data.length >= 1000 ? 'partial' : 'ready' })
      return result
    } catch (error) { update({ state: 'error' }); throw error }
  })()
}
