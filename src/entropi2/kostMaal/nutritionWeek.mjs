import { activityDay } from '../../dashboard/coachInactive.mjs'
import { parseInputNumber } from '../../athlete/kostNumbers.mjs'
import { kostMaalModel } from './model.mjs'

const ordinal = day => Date.parse(day + 'T00:00:00Z') / 86400000
const civilDay = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && activityDay(value) === value
const id = value => typeof value === 'string' && value.trim().length > 0
const ids = values => Array.isArray(values) && values.every(id) && new Set(values).size === values.length

// Consume only the existing coach receipt; never initiate or widen a read.
// Keep receipt, meal and calendar rules aligned with coachNutrition.mjs.
// Return validated daily totals independently of any display threshold.
function nutritionDays(props = {}) {
  const { athlete, today, coachNutrition: source, readContext: context } = props
  const day = civilDay(today) ? today : null
  if (props.loading || props.loadError || !day || !id(athlete?.id) || !id(props.session?.user?.id) ||
    context?.coachId !== props.session.user.id || context.day !== day || !ids(context.athleteIds) ||
    !context.athleteIds.includes(athlete.id) ||
    source?.coachId !== context.coachId || source.day !== day ||
    !ids(source.athleteIds) || source.athleteIds.length !== context.athleteIds.length ||
    !context.athleteIds.every(a => source.athleteIds.includes(a)) ||
    source.state !== 'ready' || source.complete !== true ||
    !civilDay(source.from) || source.through !== day || ordinal(source.from) !== ordinal(day) - 6 ||
    !Array.isArray(source.rows) || !Array.isArray(source.targets)) return null

  const allowed = new Set(source.athleteIds), totals = new Map(), seen = new Set(), targets = new Set()
  for (const row of source.rows) {
    if (!allowed.has(row?.athlete_id) || !civilDay(row.date) || row.date < source.from || row.date > day ||
      !id(row.id) || seen.has(row.id)) return null
    seen.add(row.id)
    if (typeof row.meal === 'string' && row.meal.trimStart().startsWith('[appData2-day-v1]')) continue
    const kcal = parseInputNumber(row.kcal), protein = parseInputNumber(row.protein)
    if (typeof row.meal !== 'string' || !row.meal.trim() || kcal === null || protein === null) return null
    if (!totals.has(row.athlete_id)) totals.set(row.athlete_id, new Map())
    const days = totals.get(row.athlete_id), sum = days.get(row.date) || { kcal: 0, protein: 0 }
    sum.kcal += kcal; sum.protein += protein
    if (!Number.isFinite(sum.kcal) || !Number.isFinite(sum.protein)) return null
    days.set(row.date, sum)
  }
  for (const target of source.targets) {
    if (!allowed.has(target?.athlete_id) || targets.has(target.athlete_id)) return null
    targets.add(target.athlete_id)
  }
  return totals.get(athlete.id) ?? new Map()
}

export function nutritionWeek(props = {}) {
  const days = nutritionDays(props)
  if (!days || days.size < 3) return null
  const kcal = [...days.values()].reduce((n, d) => n + d.kcal, 0) / days.size
  const protein = [...days.values()].reduce((n, d) => n + d.protein, 0) / days.size
  if (!Number.isFinite(kcal) || !Number.isFinite(protein)) return null
  const whole = value => Math.round(value).toLocaleString('da-DK')
  return { days: days.size, kcal, protein,
    text: `Seneste 7 dage: gns. ${whole(kcal)} kcal / ${whole(protein)} g protein (${days.size} loggede dage)` }
}

// Compare logged daily totals with the current saved goals, not historical goals
// or unsaved editor drafts. No logging is not evidence of reaching either goal.
export function nutritionGoalWeek(props = {}) {
  const days = nutritionDays(props)
  if (!days) return null
  const model = kostMaalModel({ athlete: props.athlete })
  // Fixed absolute tolerance repairs binary decimal summation noise only.
  // It never scales with the goal or rounds a 0.01 shortfall up to attainment.
  const count = (key, target) => target === null ? null :
    [...days.values()].filter(day => target - day[key] <= 1e-9).length
  const kcal = count('kcal', model.kcal), protein = count('protein', model.protein)
  const goal = (label, count) => count === null ? `${label}: mål mangler` : `${label} ${count} af 7 dage`
  const logged = days.size === 1 ? '1 logget dag' : `${days.size} loggede dage`
  return { days: days.size, kcal, protein,
    text: `Seneste 7 dage med nuværende mål: ${goal('energi', kcal)} · ${goal('protein', protein)} (${logged}).` }
}
