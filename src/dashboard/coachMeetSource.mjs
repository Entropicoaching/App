const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Copenhagen', year: 'numeric', month: '2-digit', day: '2-digit' })
export function dayNumber(day) {
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
  const stamp = Date.parse(`${day}T00:00:00Z`)
  return Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0, 10) === day ? stamp / 86400000 : null
}
export function meetToday(now = new Date()) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) return null
  const parts = Object.fromEntries(formatter.formatToParts(now).map(p => [p.type, p.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}
// Capture the existing reads, without changing their query or return contract.
// Tokens stop an older response replacing a newer request for the same source.
export function readMeetSource(enabled, key, ids, setData, run) {
  if (enabled !== true) return run()
  const token = {}, day = meetToday(), scope = ids.slice()
  setData(previous => ({ ...previous, [key]: { token, state: 'loading' } }))
  return (async () => {
    let result
    try { result = await run() } catch (error) {
      setData(previous => previous[key]?.token === token ? { ...previous, [key]: { token, state: 'error' } } : previous)
      throw error
    }
    const rows = Array.isArray(result?.data) ? result.data : []
    const source = { token, day, ids: scope, rows,
      state: result?.error || !Array.isArray(result?.data) ? 'error' : rows.length >= 1000 ? 'partial' : 'ready' }
    setData(previous => previous[key]?.token === token ? { ...previous, [key]: source } : previous)
    return result
  })()
}
