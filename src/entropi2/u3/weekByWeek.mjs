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
  const rows = [
    ['Kostdage', nutrition.map(n => n && n.days > 0 ? `${n.days}/7` : DOT)],
    ['Protein g', nutrition.map(n => cell(n && finite(n.usableProteinAverage) ? formatNumber(Math.round(n.usableProteinAverage)) : null))],
    ['kcal', nutrition.map(n => cell(n && finite(n.usableKcalAverage) ? formatNumber(Math.round(n.usableKcalAverage)) : null))],
    ['Tonnage t', weeks.map((_, i) => {
      const w = load?.weeks?.[i]
      return cell(w && w.sets > 0 && finite(w.tonnage) ? formatNumber(w.tonnage / 1000, 1) : null)
    })],
    ...MAIN.map(lift => {
      const series = strength?.lifts?.find(l => l.key === lift.key)
      const values = weeks.map(w => {
        const v = series?.weeks?.find(x => x.weekStart === w.start && !x.provisional)?.e1rm
        return finite(v) ? formatNumber(Math.round(v)) : null
      })
      return values.some(v => v !== null) ? [`${lift.name} e1RM`, values.map(cell)] : null
    }).filter(Boolean),
    ['Vægt kg', weeks.map(w => {
      const avg = weights ? weightTrend(weights, athlete.id, w.end).average : null
      return cell(finite(avg) ? formatNumber(avg, 1) : null)
    })],
    ['Readiness', weeks.map(w => {
      if (!readiness) return DOT
      const byDay = new Map(readiness.filter(r => r?.logged_date >= w.start && r.logged_date <= w.end && finite(r.readiness_score)).map(r => [r.logged_date, r.readiness_score]))
      return byDay.size >= 4 ? formatNumber(Math.round([...byDay.values()].reduce((n, v) => n + v, 0) / byDay.size)) : DOT
    })],
  ]
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
    weeks, rows, couplings,
    note: `Kost tæller dage med mindst 60 % af kcal-målet eller en bekræftet dag. Sammenlignes mod nuværende mål${goals.length ? `: ${goals.join(' og ')}` : ''}; der findes ingen historik for mål. "${DOT}" betyder, at tallet ikke kan regnes ud fra ugens data.`,
  }
}
