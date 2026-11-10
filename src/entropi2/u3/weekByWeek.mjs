import { addCalendarDays, calendarDay } from '../../calendarDate.js'
import { exerciseSetView } from '../../exerciseSetView.js'
import { buildStrengthTrend } from '../tracking/strengthTrend.mjs'
import { weightTrend } from '../tracking/weightTrend.mjs'
import { weeklyLoad } from '../analysis/weeklyLoad.mjs'
import { weekNutrition } from './nutritionWeek.mjs'
import { k1EnergyWeight, k2ProteinReadiness, excludedDays } from './couplings.mjs'
import { formatNumber, mondayOf } from './format.mjs'

// K3 (U3-planen 5.2): kost, belastning, e1RM og vægt side om side for 4
// afsluttede uger. Kun coach. Ingen pile, ingen tekst om årsag. "·" betyder, at
// tallet ikke kan regnes ud fra ugens data, ikke nul.
export const WEEKS = 4
export const DOT = '·'
const MAIN = ['Squat', 'Bænkpres', 'Dødløft', 'Sumo dødløft'].map(name => ({ key: exerciseSetView(name).key, name }))
const ready = part => part?.state === 'ready' && Array.isArray(part.rows)
const finite = value => typeof value === 'number' && Number.isFinite(value)

function isoWeek(day) {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7))
  const jan4 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4))
  return 1 + Math.round(((d - jan4) / 86400000 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7)
}

export function weekByWeek({ data, athlete, today, now = new Date() } = {}) {
  const day = calendarDay(today)
  if (!day || !athlete?.id || !data) return null
  const firstMonday = addCalendarDays(mondayOf(day), -7 * WEEKS)
  const weeks = Array.from({ length: WEEKS }, (_, i) => {
    const start = addCalendarDays(firstMonday, 7 * i)
    return { start, end: addCalendarDays(start, 6), label: `uge ${isoWeek(start)}` }
  })
  const kcalTarget = athlete.kcal_target, proteinTarget = athlete.protein_target
  const meals = ready(data.meals) ? data.meals.rows : null
  const logs = ready(data.logs) ? data.logs.rows : null
  const weights = ready(data.weights) ? data.weights.rows.map(r => ({ ...r, athlete_id: athlete.id })) : null
  const readiness = ready(data.readiness) ? data.readiness.rows : null
  const nutrition = weeks.map(w => meals ? weekNutrition(meals, { start: w.start, end: w.end, today: day, kcalTarget, proteinTarget }) : null)
  const load = logs ? weeklyLoad(logs, addCalendarDays(weeks.at(-1).end, 0), { weeks: WEEKS }) : null
  const strength = logs ? buildStrengthTrend(logs, { today: day }) : null
  const cell = value => value ?? DOT
  const fmt = (value, digits = 0) => finite(value) ? formatNumber(digits ? value : Math.round(value), digits) : null
  // U3b: tallene holdes som tal til graferne; tabellen formaterer de samme tal.
  const series = [
    { key: 'kostdage', label: 'Kostdage', values: nutrition.map(n => n && n.days > 0 ? n.days : null), unit: '/7', target: 7 },
    { key: 'protein', label: 'Protein g', values: nutrition.map(n => n && finite(n.usableProteinAverage) ? n.usableProteinAverage : null),
      target: finite(Number(proteinTarget)) && Number(proteinTarget) > 0 ? Number(proteinTarget) : null },
    { key: 'kcal', label: 'kcal', values: nutrition.map(n => n && finite(n.usableKcalAverage) ? n.usableKcalAverage : null),
      target: finite(Number(kcalTarget)) && Number(kcalTarget) > 0 ? Number(kcalTarget) : null },
    { key: 'tonnage', label: 'Tonnage t', digits: 1, values: weeks.map((_, i) => {
      const w = load?.weeks?.[i]
      return w && w.sets > 0 && finite(w.tonnage) ? w.tonnage / 1000 : null
    }) },
    ...MAIN.map(lift => {
      const trend = strength?.lifts?.find(l => l.key === lift.key)
      const values = weeks.map(w => {
        const v = trend?.weeks?.find(x => x.weekStart === w.start && !x.provisional)?.e1rm
        return finite(v) ? v : null
      })
      return values.some(v => v !== null) ? { key: lift.key, label: `${lift.name} e1RM`, lift: lift.name, values, relative: true } : null
    }).filter(Boolean),
    { key: 'vaegt', label: 'Vægt kg', digits: 1, relative: true, values: weeks.map(w => {
      const avg = weights ? weightTrend(weights, athlete.id, w.end).average : null
      return finite(avg) ? avg : null
    }) },
    { key: 'readiness', label: 'Readiness', relative: true, values: weeks.map(w => {
      if (!readiness) return null
      const byDay = new Map(readiness.filter(r => r?.logged_date >= w.start && r.logged_date <= w.end && finite(r.readiness_score)).map(r => [r.logged_date, r.readiness_score]))
      return byDay.size >= 4 ? [...byDay.values()].reduce((n, v) => n + v, 0) / byDay.size : null
    }) },
  ]
  const rows = series.map(row => [row.label, row.values.map(v => row.key === 'kostdage'
    ? (v === null ? DOT : `${v}/7`) : cell(fmt(v, row.digits ?? 0)))])
  // K1 og K2 for coachen: tal og antal dage, kun når minimum er nået.
  const couplings = []
  if (meals && logs && ready(data.weeks)) {
    const excluded = excludedDays({ weeks: data.weeks.rows, logs, athlete, today: day, now })
    const k1 = weights ? k1EnergyWeight({ meals, weights, today: day, excluded }) : null
    if (k1) couplings.push(`Energi og vægt: cirka ${formatNumber(Math.round(k1.averageKcal / 100) * 100)} kcal om dagen og ${formatNumber(k1.weeklyChangeKg, 2)} kg pr. uge giver et estimeret vedligehold på cirka ${formatNumber(Math.round(k1.maintenanceKcal / 50) * 50)} kcal (${k1.mealDays} bekræftede kostdage, ${k1.weighDays} vejedage, 28 dage).`)
    const k2 = readiness ? k2ProteinReadiness({ meals, readiness, today: day, kcalTarget, proteinTarget, excluded }) : null
    if (k2) couplings.push(`Protein og readiness dagen efter: ${formatNumber(Math.round(k2.hitAverage))} på dage med protein mod nuværende mål og ${formatNumber(Math.round(k2.missAverage))} på dage under (${k2.hitPairs} og ${k2.missPairs} par, samme retning i begge halvdele af 28 dage).`)
  }
  const goals = [finite(Number(proteinTarget)) && Number(proteinTarget) > 0 ? `${formatNumber(Number(proteinTarget))} g protein` : null,
    finite(Number(kcalTarget)) && Number(kcalTarget) > 0 ? `${formatNumber(Number(kcalTarget))} kcal` : null].filter(Boolean)
  return {
    weeks, rows, series, couplings, focus: coachWeekFocus(series, weeks),
    note: `Stiplet linje: mod nuværende mål${goals.length ? `: ${goals.join(' og ')}` : ''}. Grå streg: ingen data.`,
  }
}

// U3b: ét fokuspunkt til coachen ud fra den seneste afsluttede uge. Rækkefølge:
// kostlogning, protein, e1RM der står stille over 4 uger, readiness der dykker.
export function coachWeekFocus(series, weeks) {
  const get = key => series.find(s => s.key === key)
  const last = list => list?.values?.at(-1) ?? null
  const label = weeks.at(-1)?.label ?? 'sidste uge'
  const days = last(get('kostdage'))
  if (days !== null && days < 4) return { key: 'kostdage', value: `${days}/7 kostdage`,
    text: `i ${label}. Spørg ind til, hvad der gør det svært at logge.` }
  const protein = get('protein'), p = last(protein)
  if (finite(p) && finite(protein.target) && p < 0.9 * protein.target) return { key: 'protein',
    value: `${formatNumber(Math.round(p))} g protein`, text: `mod målet på ${formatNumber(protein.target)} g i ${label}. Giv en konkret proteinkilde til hverdagen.` }
  const stalled = series.filter(s => s.lift).find(s => {
    const v = s.values.filter(finite)
    return s.values.every(finite) && v.at(-1) <= v[0]
  })
  if (stalled) return { key: 'e1rm', value: `${stalled.lift} står stille`, text: 'over 4 uger. Se på belastning og variation i næste blok.' }
  const ready = get('readiness')?.values ?? []
  const earlier = ready.slice(0, -1).filter(finite)
  if (finite(ready.at(-1)) && earlier.length >= 2) {
    const avg = earlier.reduce((n, v) => n + v, 0) / earlier.length
    if (ready.at(-1) <= avg - 5) return { key: 'readiness', value: `Readiness ${formatNumber(Math.round(ready.at(-1)))}`,
      text: `i ${label} mod ${formatNumber(Math.round(avg))} ugerne før. Tjek søvn og belastning.` }
  }
  return { key: 'steady', value: null, text: 'Ugerne følger planen. Intet kræver en ændring lige nu.' }
}
