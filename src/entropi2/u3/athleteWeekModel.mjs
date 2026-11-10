import { addCalendarDays, calendarDay } from '../../calendarDate.js'
import { exerciseSetView } from '../../exerciseSetView.js'
import { buildStrengthTrend } from '../tracking/strengthTrend.mjs'
import { weightTrend } from '../tracking/weightTrend.mjs'
import { weeklyLoad } from '../analysis/weeklyLoad.mjs'
import { weekNutrition } from './nutritionWeek.mjs'
import { sessionCounts } from './sessionCounts.mjs'
import { k1EnergyWeight, k2ProteinReadiness, excludedDays, athleteCouplingSentence } from './couplings.mjs'
import { formatNumber, signed, mondayOf, periodLabel } from './format.mjs'

// U3-planen afsnit 1: "Min uge" for den seneste afsluttede uge og "Udvikling".
// Planen kalder filen athleteWeekCard.mjs, men på Windows er det samme fil som
// komponenten AthleteWeekCard.mjs. Derfor hedder modellen athleteWeekModel.mjs.
// Hver linje vises kun, når dens minimum er nået. Ellers udelades linjen helt.
export const KOST_MIN_DAYS = 4
export const READINESS_MIN_DAYS = 4
export const GOALS = Object.freeze(['cut', 'maintain', 'bulk'])
export const NO_STRENGTH = 'Kommer, når du har logget tunge sæt i 4 uger.'
export const COUPLING_PENDING = 'Vi viser en sammenhæng, når der er nok dage.'
const MAIN = ['Squat', 'Bænkpres', 'Dødløft', 'Sumo dødløft']
const MAIN_KEYS = new Map(MAIN.map(name => [exerciseSetView(name).key, name]))

const ready = part => part?.state === 'ready' && Array.isArray(part.rows)
const finite = value => typeof value === 'number' && Number.isFinite(value)

export function validGoal(goal) {
  return GOALS.includes(goal) ? goal : null
}

// A2: weightTrend kaldes med i går (R3 og D46: kun afsluttede perioder).
export function weightLine(weightLogs, athlete, today) {
  const yesterday = addCalendarDays(today, -1)
  if (!Array.isArray(weightLogs) || !athlete?.id || !yesterday) return null
  const trend = weightTrend(weightLogs, athlete.id, yesterday)
  if (!trend.weeklyChange || trend.average === null) return null
  const { kg, percent } = trend.weeklyChange
  let text = `${formatNumber(trend.average, 1)} kg · ${signed(kg)} kg/uge`
  const goal = validGoal(athlete.goal)
  if (goal) {
    const onTrack = goal === 'cut' ? kg < 0 : goal === 'bulk' ? kg > 0 : Math.abs(percent) <= 0.5
    text += onTrack ? ' · på vej mod dit mål' : ' · ikke på vej mod dit mål'
  }
  return { key: 'weight', label: 'Vægt', text, kg, percent, average: trend.average }
}

export function strengthLines(fremgangLogs, today) {
  if (!Array.isArray(fremgangLogs)) return null
  const trend = buildStrengthTrend(fremgangLogs, { today })
  if (!trend) return null
  return trend.lifts.filter(lift => MAIN_KEYS.has(lift.key) && finite(lift.slopeKgPerWeek)).map(lift => {
    const done = lift.weeks.filter(w => !w.provisional && finite(w.e1rm))
    const e1rm = done.at(-1)?.e1rm
    if (!finite(e1rm)) return null
    const slope = Math.round(lift.slopeKgPerWeek * 10) / 10
    const tail = lift.drop === true ? 'falder' : lift.plateau === true ? 'står stille'
      : slope > 0 ? `↑ ${formatNumber(slope, 1)} kg/uge` : slope < 0 ? `↓ ${formatNumber(-slope, 1)} kg/uge` : 'uændret'
    return { key: lift.key, label: MAIN_KEYS.get(lift.key), text: `e1RM ${formatNumber(Math.round(e1rm))} kg · ${tail}`,
      e1rm, slopeKgPerWeek: lift.slopeKgPerWeek, plateau: lift.plateau, drop: lift.drop }
  }).filter(Boolean)
}

export function athleteWeekCardModel({ today, athlete, data, weightLogs, fremgangLogs, now = new Date() } = {}) {
  const day = calendarDay(today)
  if (!day || !athlete?.id) return null
  const start = addCalendarDays(mondayOf(day), -7), end = addCalendarDays(start, 6)
  const lines = []

  // Træning: pas gennemført af planlagt og tonnage.
  if (ready(data?.weeks) && ready(data?.logs)) {
    const week = data.weeks.rows.find(w => w?.start_date === start)
    const counts = week ? sessionCounts(week, data.logs.rows, { today: day, now }) : null
    if (counts && counts.planned > 0 && counts.done !== null) {
      const load = weeklyLoad(data.logs.rows, end, { weeks: 1 })
      const tonnage = load?.weeks?.[0]?.tonnage
      const tons = finite(tonnage) && tonnage > 0 ? ` · ${formatNumber(tonnage / 1000, 1)} t` : ''
      lines.push({ key: 'training', label: 'Træning', text: `${counts.done} af ${counts.planned} pas${tons}`, done: counts.done, planned: counts.planned })
    }
  }

  // Kost: kostdage ud af 7 og gennemsnitligt protein på kostdage mod protein_target.
  if (ready(data?.meals)) {
    const n = weekNutrition(data.meals.rows, { start, end, today: day, kcalTarget: athlete.kcal_target, proteinTarget: athlete.protein_target })
    if (n && n.days >= KOST_MIN_DAYS) {
      const protein = n.proteinAverage === null ? '' : ` · ${formatNumber(Math.round(n.proteinAverage))} g protein` +
        (n.proteinTarget ? ` (mål ${formatNumber(n.proteinTarget)} g)` : '')
      lines.push({ key: 'nutrition', label: 'Kost', text: `${n.days} af 7 dage${protein}`, days: n.days })
    }
  }

  const weight = weightLine(weightLogs, athlete, day)
  if (weight) lines.push(weight)

  // Readiness: gennemsnit med mindst 4 dage i ugen.
  if (ready(data?.readiness)) {
    const byDay = new Map()
    for (const row of data.readiness.rows) {
      if (typeof row?.logged_date === 'string' && row.logged_date >= start && row.logged_date <= end && finite(row.readiness_score)) byDay.set(row.logged_date, row.readiness_score)
    }
    if (byDay.size >= READINESS_MIN_DAYS) {
      const avg = [...byDay.values()].reduce((n, v) => n + v, 0) / byDay.size
      lines.push({ key: 'readiness', label: 'Readiness', text: `${formatNumber(Math.round(avg))} i snit`, average: avg })
    }
  }

  // A3: højst én koblingssætning. Ukendte kilder giver ingen kobling.
  let sentence = null
  if (ready(data?.meals) && ready(data?.weeks) && ready(data?.logs)) {
    const excluded = excludedDays({ weeks: data.weeks.rows, logs: data.logs.rows, athlete, today: day, now })
    const k1 = Array.isArray(weightLogs) ? k1EnergyWeight({ meals: data.meals.rows, weights: weightLogs, today: day, excluded }) : null
    const k2 = ready(data?.readiness) ? k2ProteinReadiness({ meals: data.meals.rows, readiness: data.readiness.rows, today: day,
      kcalTarget: athlete.kcal_target, proteinTarget: athlete.protein_target, excluded }) : null
    sentence = athleteCouplingSentence({ k1, k2 })
  }

  const strength = strengthLines(fremgangLogs, day)
  return {
    start, end, label: `Min uge · ${periodLabel(start, end)}`,
    lines, sentence, showCard: lines.length > 0,
    strength: strength === null ? null : { lifts: strength, message: strength.length ? null : NO_STRENGTH },
  }
}
