export const DEFAULT_ENABLED = false
const DAY = 86400000
const zone = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Copenhagen', year: 'numeric', month: '2-digit', day: '2-digit' })

export function civilDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const time = Date.parse(value + 'T00:00:00Z')
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? value : null
}
export function loggedDay(value) {
  if (civilDay(value)) return value
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !civilDay(value.slice(0, 10))) return null
  if (Number(value.slice(11, 13)) > 23 || Number(value.slice(14, 16)) > 59 || Number(value.slice(17, 19)) > 59) return null
  const time = Date.parse(value)
  return Number.isFinite(time) ? zone.format(new Date(time)) : null
}
export function positive(value) {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : null
  if (typeof value !== 'number' && typeof value !== 'string') return null
  const text = String(value).trim()
  if (!/^\d+(?:[.,]\d+)?$/.test(text)) return null
  const number = Number(text.replace(',', '.'))
  return Number.isFinite(number) && number > 0 ? number : null
}
export const displayNumber = value => value.toLocaleString('da-DK', { maximumFractionDigits: 1 })
const target = value => { const n = positive(value); return Number.isSafeInteger(n) && n <= 2147483647 ? n : null }
const mean = rows => {
  if (!rows.length) return null
  const scale = Math.max(...rows.map(row => row.weight))
  return scale * Math.min(1, rows.reduce((sum, row) => sum + (row.weight / scale) / rows.length, 0))
}

// The adapter supplies already scoped rows; explicit foreign IDs are rejected too.
// One row per Copenhagen calendar day: latest timestamp wins; equal dates use
// the last supplied row (adapter should retain ascending creation order).
export function kostMaalModel({ athlete = {}, weightLogs = [], today } = {}) {
  const kcal = target(athlete?.kcal_target), protein = target(athlete?.protein_target)
  const bodyweight = positive(athlete?.bodyweight)
  const day = civilDay(today), end = day ? Date.parse(day + 'T00:00:00Z') : null
  const days = new Map()
  if (day && athlete?.id != null) for (const row of Array.isArray(weightLogs) ? weightLogs : []) {
    if (!row || row.athlete_id != null && row.athlete_id !== athlete.id) continue
    const date = loggedDay(row.logged_at), weight = positive(row.weight)
    if (!date || date > day || weight === null) continue
    const stamp = civilDay(row.logged_at) ? Date.parse(date + 'T00:00:00Z') : Date.parse(row.logged_at)
    if (!days.has(date) || stamp >= days.get(date).stamp) days.set(date, { date, weight, stamp })
  }
  const ordered = [...days.values()].sort((a, b) => b.date.localeCompare(a.date))
  const current = ordered.filter(row => Date.parse(row.date + 'T00:00:00Z') >= end - 6 * DAY)
  const previous = ordered.filter(row => {
    const t = Date.parse(row.date + 'T00:00:00Z')
    return t >= end - 13 * DAY && t < end - 6 * DAY
  })
  const average = mean(current), previousAverage = mean(previous)
  const trend = current.length >= 2 && previous.length >= 2 ? average - previousAverage : null
  const actions = []
  if (!day) actions.push('Vælg en gyldig dagsdato for vægtgrundlaget.')
  else if (!current.length) actions.push('Atleten kan logge sin vægt i kg i dag for at få et aktuelt ugegennemsnit.')
  if (day && trend === null) actions.push('For at se en trend skal atleten logge vægt på mindst 2 forskellige dage i hver af to på hinanden følgende 7-dagesperioder.')
  if (bodyweight === null) actions.push('Angiv atletens kropsvægt i profilen; vejninger logges i vægtloggen.')
  return { day, kcal, protein, bodyweight, latest: ordered[0] ?? null,
    average, days: current.length, previousDays: previous.length, trend, actions }
}

// The existing saveEdit handler stores integer targets. Blank clears to null;
// zero, negative, fractional and malformed targets must never become a goal.
export function validTargetDraft(data = {}) {
  return ['kcal_target', 'protein_target'].every(key => {
    const value = data?.[key]
    if (value == null || typeof value === 'string' && !value.trim()) return true
    const number = positive(value)
    return Number.isSafeInteger(number) && number <= 2147483647
  })
}
