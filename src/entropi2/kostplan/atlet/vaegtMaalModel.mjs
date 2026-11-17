import { weightTrend, targetWeeklyPct, POLICY } from '../beregning.mjs'

// Vægtens tendens mod planens mål (kost virker det). Ren model: ingen læsning, ingen skrivning.
// Trend og tolerance er beregningens egne (kostplan/beregning.mjs); under det, den kræver, eller uden mål er svaret null.
export const VINDUE_DAGE = 14
const INTENSITETER = { 5: 'light', 10: 'moderate', 15: 'aggressive' }
const fmt = value => new Intl.NumberFormat('da-DK', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value)

export function vaegtRaekker(weightLogs, athleteId) {
  if (!Array.isArray(weightLogs)) return []
  return weightLogs.filter(row => row?.athlete_id === athleteId)
    .map(row => ({ date: row.logged_at, kg: Number(String(row.weight).replace(',', '.')) }))
}

// Planversionens mål: goal som i databasen ('vedligehold' er maintain), intensity 0,05 / 0,10 / 0,15.
export function planMaal(version) {
  const goal = version?.goal === 'vedligehold' ? 'maintain' : version?.goal
  const intensity = INTENSITETER[Math.round(Number(version?.intensity) * 100)]
  const pct = targetWeeklyPct(goal, intensity)
  return pct === null ? null : { goal, intensity, targetPct: pct }
}

// Er der nok målinger til at vise noget? Bruges også til at undlade den ekstra læsning af planversionen.
export function trendFor(rows, date) {
  try {
    const trend = weightTrend(rows, date, VINDUE_DAGE)
    return trend.sufficient && trend.weeklyKg !== null ? trend : null
  } catch { return null }
}

export function vaegtMaalLinje({ rows, date, version }) {
  const maal = planMaal(version)
  const trend = maal && trendFor(rows, date)
  if (!trend) return null
  const latest = rows.filter(r => trend.dates.includes(r.date)).sort((a, b) => b.date.localeCompare(a.date))[0]
  if (!latest) return null
  const observedPct = trend.weeklyKg / latest.kg * 100
  const error = maal.targetPct - observedPct
  const onTrack = Math.abs(error) <= POLICY.trendTolerancePct + 1e-9
  const direction = maal.targetPct < 0 ? -1 : 1
  const status = onTrack ? 'paa-sporet'
    : maal.goal === 'maintain' ? (error < 0 ? 'over' : 'under')
      : error * direction < 0 ? 'hurtigere' : 'langsommere'
  const label = { 'paa-sporet': 'På sporet', hurtigere: 'Hurtigere end målet', langsommere: 'Langsommere end målet',
    over: 'Højere end målet', under: 'Lavere end målet' }[status]
  const kg = Math.abs(trend.weeklyKg) < 0.05 ? 'Vægten er uændret' : `Vægten ${trend.weeklyKg < 0 ? 'falder' : 'stiger'} ${fmt(Math.abs(trend.weeklyKg))} kg pr. uge`
  return { status, label, weeklyKg: trend.weeklyKg, count: trend.count,
    text: `${kg} de seneste ${VINDUE_DAGE} dage. ${label}.` }
}
