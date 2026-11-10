import { addCalendarDays, calendarDay } from '../../calendarDate.js'
import { confirmedMealDays } from '../../mealEvidence.mjs'
import { hasEnoughData } from '../../dataEnough.mjs'
import { erDeloadBlok } from '../../exerciseProgress.js'
import { mealDays } from './nutritionWeek.mjs'
import { sessionCounts } from './sessionCounts.mjs'

// U3-planen afsnit 5: kun tre faste koblinger. Denne fil har K1 og K2; K3 er en
// tabel uden tekst. Der søges aldrig efter andre par. Teksten siger "sammenhæng",
// aldrig "fordi", og giver aldrig et kostråd.
export const WINDOW_DAYS = 28
export const K2_MIN_PAIRS = 12
export const K2_MIN_GROUP = 6
export const K2_MIN_DIFFERENCE = 5
const KCAL_PER_KG = 7700

const finite = value => typeof value === 'number' && Number.isFinite(value)
const positive = value => finite(value) && value > 0
const average = values => values.reduce((n, v) => n + v, 0) / values.length
const number = digits => new Intl.NumberFormat('da-DK', { maximumFractionDigits: digits, minimumFractionDigits: digits })

// Ferie som coachBriefingRules.js l.85 og l.439: status 'ferie' eller
// vacation_until mindst den dag, der regnes for.
export function onVacation(athlete, day) {
  if (!athlete) return false
  if (athlete.status === 'ferie') return true
  const until = athlete.vacation_until ? calendarDay(String(athlete.vacation_until).slice(0, 10)) : null
  return !!until && until >= day
}

// 5.3 nr. 5: dage i uger med deload, ferie eller under 50 % gennemførte pas
// udelades fra K1 og K2. Kun afsluttede uger bedømmes på pas.
export function excludedDays({ weeks = [], logs = [], athlete = null, today, now } = {}) {
  const day = calendarDay(today), out = new Set()
  if (!day) return out
  for (let i = 1; i <= WINDOW_DAYS + 1; i++) {
    const d = addCalendarDays(day, -i)
    if (onVacation(athlete, d)) out.add(d)
  }
  for (const week of Array.isArray(weeks) ? weeks : []) {
    const start = calendarDay(week?.start_date)
    if (!start) continue
    const counts = sessionCounts(week, logs, { today: day, now })
    const weak = counts.complete === true && counts.planned > 0 && counts.done !== null && counts.done * 2 < counts.planned
    const vacation = Array.from({ length: 7 }, (_, i) => addCalendarDays(start, i)).some(d => d < day && onVacation(athlete, d))
    if (erDeloadBlok(week.block_name) || weak || vacation) {
      for (let i = 0; i < 7; i++) out.add(addCalendarDays(start, i))
    }
  }
  return out
}

function windowDays(today) {
  const day = calendarDay(today)
  return day ? { day, from: addCalendarDays(day, -WINDOW_DAYS), through: addCalendarDays(day, -1) } : null
}

// K1. Energi og vægt. Kun bekræftede kostdage (confirmedMealDays) og D48 uændret.
export function k1EnergyWeight({ meals = [], weights = [], today, excluded = new Set() } = {}) {
  const w = windowDays(today)
  if (!w || !Array.isArray(meals) || !Array.isArray(weights)) return null
  const inWindow = date => typeof date === 'string' && date >= w.from && date <= w.through && !excluded.has(date)
  const confirmed = confirmedMealDays(meals.filter(r => inWindow(r?.date)))
  const confirmedDates = new Set(confirmed.map(r => r.date))
  const weighIns = new Map()
  for (const row of weights) {
    const date = typeof row?.logged_at === 'string' ? calendarDay(row.logged_at.slice(0, 10)) : null
    const weight = typeof row?.weight === 'string' ? Number(row.weight.replace(',', '.')) : row?.weight
    if (!date || !confirmedDates.has(date) || !positive(weight)) continue
    const previous = weighIns.get(date)
    if (!previous || String(row.created_at ?? '') > String(previous.created_at ?? '')) weighIns.set(date, { logged_at: date, weight, created_at: row.created_at })
  }
  const weightRows = [...weighIns.values()].sort((a, b) => a.logged_at.localeCompare(b.logged_at))
  if (!hasEnoughData('D48', { rows: confirmed, weights: weightRows, today: w.day })) return null
  const dates = [...confirmedDates].sort()
  const first = weightRows.filter(r => r.logged_at < addCalendarDays(dates[0], 7))
  const last = weightRows.filter(r => r.logged_at > addCalendarDays(dates.at(-1), -7))
  const dayIndex = date => Date.parse(`${date}T00:00:00Z`) / 86400000
  const span = average(last.map(r => dayIndex(r.logged_at))) - average(first.map(r => dayIndex(r.logged_at)))
  if (!(span > 0)) return null
  const weeklyChangeKg = (average(last.map(r => r.weight)) - average(first.map(r => r.weight))) / span * 7
  const averageKcal = average(confirmed.map(r => r.kcal))
  const maintenanceKcal = averageKcal - weeklyChangeKg * KCAL_PER_KG / 7
  if (![weeklyChangeKg, averageKcal, maintenanceKcal].every(finite)) return null
  return { averageKcal, weeklyChangeKg, maintenanceKcal, mealDays: confirmed.length, weighDays: weightRows.length }
}

// K2. Protein på en brugbar kostdag og readiness dagen efter.
export function k2ProteinReadiness({ meals = [], readiness = [], today, kcalTarget, proteinTarget, excluded = new Set() } = {}) {
  const w = windowDays(today)
  if (!w || !positive(proteinTarget) || !Array.isArray(readiness)) return null
  const scores = new Map()
  for (const row of readiness) {
    const date = typeof row?.logged_date === 'string' ? calendarDay(row.logged_date.slice(0, 10)) : null
    if (date && finite(row.readiness_score)) scores.set(date, row.readiness_score)
  }
  const pairs = []
  for (const meal of mealDays(meals, { today: w.day, kcalTarget })) {
    const next = addCalendarDays(meal.date, 1)
    if (!meal.usable || meal.protein === null || meal.date < w.from || next > w.through) continue
    if (excluded.has(meal.date) || excluded.has(next) || !scores.has(next)) continue
    pairs.push({ date: meal.date, hit: meal.protein >= proteinTarget, readiness: scores.get(next) })
  }
  const split = list => ({ hit: list.filter(p => p.hit).map(p => p.readiness), miss: list.filter(p => !p.hit).map(p => p.readiness) })
  const all = split(pairs)
  if (pairs.length < K2_MIN_PAIRS || all.hit.length < K2_MIN_GROUP || all.miss.length < K2_MIN_GROUP) return null
  const difference = average(all.hit) - average(all.miss)
  if (Math.abs(difference) < K2_MIN_DIFFERENCE) return null
  // Genfund: samme retning i både første og anden halvdel af perioden.
  const middle = addCalendarDays(w.day, -WINDOW_DAYS / 2)
  for (const half of [pairs.filter(p => p.date < middle), pairs.filter(p => p.date >= middle)]) {
    const g = split(half)
    if (!g.hit.length || !g.miss.length) return null
    if (Math.sign(average(g.hit) - average(g.miss)) !== Math.sign(difference)) return null
  }
  return { difference, pairs: pairs.length, hitPairs: all.hit.length, missPairs: all.miss.length,
    hitAverage: average(all.hit), missAverage: average(all.miss) }
}

export function k1Sentence(k1) {
  if (!k1) return null
  const kg = Math.round(k1.weeklyChangeKg * 10) / 10
  const kcal = number(0).format(Math.round(k1.averageKcal / 100) * 100)
  if (kg === 0) return `Din vægt er stabil ved cirka ${kcal} kcal om dagen.`
  return `Din vægt ${kg > 0 ? 'stiger' : 'falder'} med ${number(1).format(Math.abs(kg))} kg om ugen ved cirka ${kcal} kcal om dagen.`
}

// Atleten får kun planens sætning ("højere"). En negativ sammenhæng ses kun af
// coachen i "Uge for uge", så teksten aldrig kan læses som et kostråd.
export function k2Sentence(k2) {
  if (!k2 || !(k2.difference > 0)) return null
  return `De dage, du ramte protein, var din readiness næste dag i snit ${Math.round(k2.difference)} point højere. Det er en sammenhæng, ikke et bevis.`
}

// 5.3 nr. 2: højst én koblingssætning til atleten. K1 vinder over K2.
export function athleteCouplingSentence({ k1, k2 } = {}) {
  return k1Sentence(k1) ?? k2Sentence(k2) ?? null
}
