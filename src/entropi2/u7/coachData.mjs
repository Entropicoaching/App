import { addCalendarDays, calendarDay } from '../../calendarDate.js'
import { parseInputNumber } from '../../athlete/kostNumbers.mjs'
import { formatNumber, mondayOf, shortDate } from '../u3/format.mjs'
import { DAILY, TARGETS, tableState, readTargets, targetOn, appendTarget } from './dayData.mjs'

// U7 del 4: coachen ser søvn og smerte som tal og ugens kost mod det mål, der gjaldt den uge.
// Rene funktioner plus to læsninger. Kun når data findes; ellers vises intet (som U6).
export const PAIN_ATTENTION = 4
export const SLEEP_ATTENTION = 2
export const DAILY_CAP = 1000
export const DAILY_DAYS = 7

const dayOf = value => typeof value === 'string' ? calendarDay(value.slice(0, 10)) : null
const within = (rows, day, days) => {
  // days dage tilbage fra i dag, i dag medregnet: 7 betyder i dag og de 6 dage før.
  const from = addCalendarDays(day, -(days - 1))
  return (Array.isArray(rows) ? rows : []).filter(r => { const d = dayOf(r?.logged_date); return d && d >= from && d <= day })
}
const painValue = r => Number.isInteger(r?.pain) && r.pain >= 0 && r.pain <= 10 ? r.pain : null
const sleepValue = r => Number.isInteger(r?.sleep_quality) && r.sleep_quality >= 1 && r.sleep_quality <= 5 ? r.sleep_quality : null
const place = r => typeof r?.pain_location === 'string' && r.pain_location.trim() ? ` (${r.pain_location.trim().slice(0, 40)})` : ''

// Til "Kræver dit blik": tracking_daily_v1 for de synlige atleter de seneste 7 dage. null,
// når tabellen mangler, læsningen fejler eller loftet nås; så bruges kun U6's grunde.
export async function readCoachDaily(client, ids, day) {
  if (!ids.length || !day) return []
  if (await tableState(client, DAILY) !== 'ready') return null
  try {
    const result = await client.from(DAILY).select('athlete_id, logged_date, sleep_quality, pain, pain_location')
      .in('athlete_id', ids).gte('logged_date', addCalendarDays(day, -(DAILY_DAYS - 1))).order('logged_date').limit(DAILY_CAP + 1)
    if (result?.error || !Array.isArray(result?.data) || result.data.length > DAILY_CAP) return null
    return result.data
  } catch { return null }
}

// Smerte som tal: seneste dag med smerte på mindst 4 de sidste 7 dage.
export function painFromDaily(rows, today) {
  const day = calendarDay(today)
  if (!day) return null
  const hits = within(rows, day, DAILY_DAYS).filter(r => painValue(r) >= PAIN_ATTENTION).sort((a, b) => a.logged_date.localeCompare(b.logged_date))
  const last = hits.at(-1)
  return last ? { date: last.logged_date, pain: last.pain, location: place(last).slice(2, -1) || null,
    reason: `Smerte ${last.pain}/10${place(last)} ${shortDate(last.logged_date)}` } : null
}

// Søvn som tal: snit af søvnkvalitet de seneste 3 dage (mindst 2 svar) på 2 eller derunder.
export function sleepFromDaily(rows, today) {
  const day = calendarDay(today)
  if (!day) return null
  const values = within(rows, day, 3).map(sleepValue).filter(v => v !== null)
  if (values.length < 2) return null
  const mean = values.reduce((n, v) => n + v, 0) / values.length
  return mean <= SLEEP_ATTENTION ? { mean, days: values.length, reason: `Søvn ${formatNumber(mean, 1)}/5 i snit de sidste 3 dage` } : null
}

// Tallene under rækken: snit af søvn og seneste smerte de sidste 7 dage, kun det der findes.
export function dayNumbersLine(rows, today) {
  const day = calendarDay(today)
  if (!day) return null
  const recent = within(rows, day, DAILY_DAYS)
  const sleep = recent.map(sleepValue).filter(v => v !== null)
  const pains = recent.filter(r => painValue(r) !== null).sort((a, b) => a.logged_date.localeCompare(b.logged_date))
  const parts = []
  if (sleep.length) parts.push(`Søvn ${formatNumber(sleep.reduce((n, v) => n + v, 0) / sleep.length, 1)}/5 (${sleep.length} ${sleep.length === 1 ? 'dag' : 'dage'})`)
  if (pains.length) parts.push(`Smerte ${pains.at(-1).pain}/10${place(pains.at(-1))} ${shortDate(pains.at(-1).logged_date)}`)
  return parts.length ? `${parts.join(' · ')} · sidste 7 dage` : null
}

// ===== Ugens kost mod det mål, der gjaldt =====
const MEAL_CAP = 400
export async function readWeekNutrition({ client, athleteId, day }) {
  const from = addCalendarDays(mondayOf(day), -7)
  const targets = await readTargets({ client, athleteIds: [athleteId] })
  if (targets.state !== 'ready') return null
  try {
    const result = await client.from('meal_logs').select('date, meal, kcal, protein').eq('athlete_id', athleteId)
      .gte('date', from).lte('date', day).limit(MEAL_CAP + 1)
    if (result?.error || !Array.isArray(result?.data) || result.data.length > MEAL_CAP) return null
    return { targets: targets.rows, meals: result.data }
  } catch { return null }
}

// Forrige hele uge, hvis den har både dateret mål og loggede dage; ellers ugen indtil nu.
// Hver dag sammenlignes med det mål, der gjaldt netop den dag.
export function weekTargetLine({ targets, meals, athleteId, day }) {
  const today = calendarDay(day)
  if (!today || !Array.isArray(targets) || !Array.isArray(meals)) return null
  const totals = new Map()
  for (const row of meals) {
    const d = calendarDay(row?.date)
    if (!d || typeof row.meal !== 'string' || !row.meal.trim() || row.meal.trimStart().startsWith('[appData2-day-v1]')) continue
    const kcal = parseInputNumber(row.kcal), protein = parseInputNumber(row.protein)
    if (kcal === null || protein === null) continue
    const sum = totals.get(d) ?? { kcal: 0, protein: 0 }
    sum.kcal += kcal; sum.protein += protein; totals.set(d, sum)
  }
  const monday = mondayOf(today)
  for (const [start, end, label] of [[addCalendarDays(monday, -7), addCalendarDays(monday, -1), 'sidste uge'], [monday, today, 'denne uge']]) {
    const days = [...totals.keys()].filter(d => d >= start && d <= end).sort()
    const covered = days.filter(d => targetOn(targets, athleteId, d, 'protein_g') || targetOn(targets, athleteId, d, 'kcal'))
    if (!covered.length) continue
    const avg = (field, goalField) => {
      const hit = covered.filter(d => targetOn(targets, athleteId, d, goalField))
      if (!hit.length) return null
      const goals = hit.map(d => targetOn(targets, athleteId, d, goalField).value)
      return { actual: hit.reduce((n, d) => n + totals.get(d)[field], 0) / hit.length, goal: goals.reduce((n, v) => n + v, 0) / goals.length,
        changed: new Set(goals).size > 1, from: targetOn(targets, athleteId, hit.at(-1), goalField).from }
    }
    const protein = avg('protein', 'protein_g'), kcal = avg('kcal', 'kcal')
    const parts = []
    if (protein) parts.push(`protein ${formatNumber(protein.actual)} g mod mål ${formatNumber(protein.goal)} g`)
    if (kcal) parts.push(`${formatNumber(kcal.actual)} kcal mod ${formatNumber(kcal.goal)}`)
    const since = protein?.from ?? kcal?.from
    const note = protein?.changed || kcal?.changed ? 'målet blev ændret i ugen' : `mål fra ${shortDate(since)}`
    return { period: label, text: `Kost ${label}: ${parts.join(', ')} i snit pr. logget dag (${covered.length} af 7 dage, ${note})` }
  }
  return null
}

// Coachens mål på athletes (kcal_target/protein_target) dateres: afviger det fra det daterede mål,
// der gælder i dag, lægges en ny række med dagens dato. Den eksisterende formular røres ikke.
export async function syncCoachTargets({ client, targets, day }) {
  const current = (Array.isArray(targets) ? targets : []).filter(t => typeof t?.athlete_id === 'string')
  if (!current.length || !calendarDay(day)) return 'none'
  if (await tableState(client, TARGETS) !== 'ready') return 'missing'
  const dated = await readTargets({ client, athleteIds: current.map(t => t.athlete_id) })
  if (dated.state !== 'ready') return dated.state
  let wrote = 0
  for (const t of current) {
    const fields = {}
    for (const [field, column] of [['kcal', 'kcal_target'], ['protein_g', 'protein_target']]) {
      const value = parseInputNumber(t[column])
      if (value === null || value <= 0 || Math.round(value) > (field === 'kcal' ? 20000 : 1000)) continue
      if (targetOn(dated.rows, t.athlete_id, day, field)?.value !== Math.round(value)) fields[field] = Math.round(value)
    }
    if (Object.keys(fields).length && await appendTarget({ client, athleteId: t.athlete_id, day, fields }) === 'saved') wrote++
  }
  return wrote ? 'saved' : 'none'
}
