export const COACH_MORNING_ENABLED = false
export function coachMorningFlag(search = '') {
  const values = new URLSearchParams(search).getAll('coachMorgen')
  return values.length === 1 && values[0] === '1'
}
const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Copenhagen', year: 'numeric', month: '2-digit', day: '2-digit' })
export function morningDay(value = new Date()) {
  if (!(value instanceof Date) && (typeof value !== 'string' || !/(Z|[+-]\d\d:\d\d)$/.test(value))) return null
  if (typeof value === 'string') {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null
    const day = value.slice(0, 10)
    const stamp = Date.parse(`${day}T00:00:00Z`)
    if (!Number.isFinite(stamp) || new Date(stamp).toISOString().slice(0, 10) !== day) return null
  }
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return null
  const parts = Object.fromEntries(formatter.formatToParts(date).map(p => [p.type, p.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}
export function yesterday(value = new Date()) {
  const day = morningDay(value)
  return day ? new Date(Date.parse(`${day}T00:00:00Z`) - 86400000).toISOString().slice(0, 10) : null
}
// Capture existing reads only. The disabled path returns the original operation untouched.
export function readMorningSource(enabled, key, ids, setData, run) {
  if (enabled !== true) return run()
  // Entropi 2 runde 12: the source belongs to the day the read STARTED. A read that starts
  // before midnight and finishes after it keeps yesterday's day and is rejected by today's model.
  const token = {}, day = morningDay()
  setData(previous => ({ ...previous, [key]: { token, state: 'loading' } }))
  return (async () => {
    let result
    try { result = await run() } catch (error) { result = { data: null, error } }
    const rows = Array.isArray(result?.data) ? result.data : []
    const cap = key === 'videos' ? 50 : 1000
    const source = { token, ids: ids?.slice() ?? null, rows, day,
      state: result?.error || !Array.isArray(result?.data) ? 'error' : rows.length >= cap ? 'partial' : 'ready' }
    setData(previous => previous[key]?.token === token ? { ...previous, [key]: source } : previous)
    return result || { data: null, error: new Error('Missing result') }
  })()
}
