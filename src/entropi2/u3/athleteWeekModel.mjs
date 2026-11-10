import { addCalendarDays, calendarDay } from '../../calendarDate.js'
import { exerciseSetView } from '../../exerciseSetView.js'
import { buildStrengthTrend } from '../tracking/strengthTrend.mjs'
import { weightTrend } from '../tracking/weightTrend.mjs'
import { weeklyLoad } from '../analysis/weeklyLoad.mjs'
import { weekNutrition, mealDays } from './nutritionWeek.mjs'
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
  let onTrack = null
  if (goal) {
    onTrack = goal === 'cut' ? kg < 0 : goal === 'bulk' ? kg > 0 : Math.abs(percent) <= 0.5
    text += onTrack ? ' · på vej mod dit mål' : ' · ikke på vej mod dit mål'
  }
  // U3b: 28 dages vejninger til kurven. Dage uden vejning er huller.
  const byDay = new Map(trend.daily.map(d => [String(d.date).slice(0, 10), d.weight]))
  const series = Array.from({ length: 28 }, (_, i) => byDay.get(addCalendarDays(yesterday, i - 27)) ?? null)
  return { key: 'weight', label: 'Vægt', text, kg, percent, average: trend.average, goal, onTrack, series }
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
    return { key: lift.key, label: MAIN_KEYS.get(lift.key), text: `e1RM ${formatNumber(Math.round(e1rm))} kg · ${tail}`, tail,
      e1rm, slopeKgPerWeek: lift.slopeKgPerWeek, plateau: lift.plateau, drop: lift.drop }
  }).filter(Boolean)
}

export function athleteWeekCardModel({ today, athlete, data, weightLogs, fremgangLogs, now = new Date() } = {}) {
  const day = calendarDay(today)
  if (!day || !athlete?.id) return null
  const start = addCalendarDays(mondayOf(day), -7), end = addCalendarDays(start, 6)
  const lines = []
  let nutritionDays = null

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
      // U3b: protein pr. dag i ugen til søjlerne. En dag uden kost er et hul.
      const byDay = new Map(mealDays(data.meals.rows, { today: day, kcalTarget: athlete.kcal_target }).map(d => [d.date, d.protein]))
      const series = Array.from({ length: 7 }, (_, i) => byDay.get(addCalendarDays(start, i)) ?? null)
      lines.push({ key: 'nutrition', label: 'Kost', text: `${n.days} af 7 dage${protein}`, days: n.days,
        proteinAverage: n.proteinAverage, proteinTarget: n.proteinTarget, series })
    } else if (n) nutritionDays = n.days
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
      const series = Array.from({ length: 7 }, (_, i) => byDay.get(addCalendarDays(start, i)) ?? null)
      lines.push({ key: 'readiness', label: 'Readiness', text: `${formatNumber(Math.round(avg))} i snit`, average: avg, series })
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
    focus: lines.length > 0 ? athleteFocus(lines, { nutritionDays }) : null,
    strength: strength === null ? null : { lifts: strength, message: strength.length ? null : NO_STRENGTH },
  }
}

// U3b: ét fokuspunkt, der svarer på "hvad gør jeg anderledes i denne uge?".
// Rækkefølge: pas, at logge kost, protein, vægt mod mål. Ellers: hold kursen.
// Vægt mod mål henviser til coachen; atleten får aldrig et kcal-råd herfra.
export const PROTEIN_FOCUS_SHARE = 0.9
export function athleteFocus(lines, { nutritionDays = null } = {}) {
  const line = key => lines.find(l => l.key === key)
  const training = line('training')
  if (training && training.done < training.planned) {
    const missing = training.planned - training.done
    return { key: 'training', value: `${training.done} af ${training.planned} pas`,
      text: `Du manglede ${missing} pas sidste uge. Sæt tid af til alle ${training.planned} i denne uge.` }
  }
  if (!line('nutrition') && Number.isSafeInteger(nutritionDays)) {
    return { key: 'logging', value: `${nutritionDays} af 7 dage`,
      text: `med kost sidste uge. Log mindst ${KOST_MIN_DAYS} dage, så kan du se din kost her.` }
  }
  const nutrition = line('nutrition')
  if (nutrition && finite(nutrition.proteinAverage) && finite(nutrition.proteinTarget) &&
      nutrition.proteinAverage < PROTEIN_FOCUS_SHARE * nutrition.proteinTarget) {
    const more = Math.round((nutrition.proteinTarget - nutrition.proteinAverage) / 5) * 5
    return { key: 'protein', value: `+${formatNumber(more)} g protein`,
      text: `om dagen, så rammer du dit mål på ${formatNumber(nutrition.proteinTarget)} g.` }
  }
  const weight = line('weight')
  if (weight && weight.onTrack === false) {
    return { key: 'weight', value: `${signed(weight.kg)} kg/uge`, text: 'Vægten går ikke mod dit mål. Tal med din coach om kosten.' }
  }
  return { key: 'steady', value: null, text: 'Du fulgte planen sidste uge. Hold kursen.' }
}
