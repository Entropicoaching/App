import { antalOrd } from '../antalOrd.mjs'
import { activityDay } from '../../dashboard/coachInactive.mjs'
import { parseInputNumber } from '../../athlete/kostNumbers.mjs'
import { kostMaalModel } from './model.mjs'

const ordinal = day => Date.parse(day + 'T00:00:00Z') / 86400000
const civilDay = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && activityDay(value) === value
const id = value => typeof value === 'string' && value.trim().length > 0
const ids = values => Array.isArray(values) && values.every(id) && new Set(values).size === values.length

// Consume only the existing coach receipt; never initiate or widen a read.
// Keep receipt and calendar guards aligned with coachNutrition.mjs;
// malformed meal content is skipped locally rather than hiding all athletes.
// Distinguish unavailable receipts from a complete receipt with few logged days.
export function nutritionBasis(props = {}) {
  const { athlete, today, coachNutrition: source, readContext: context } = props
  const day = civilDay(today) ? today : null
  const unavailable = { state: 'unavailable', text: 'Kostgrundlaget er ikke tilgængeligt for den valgte atlet og dag.' }
  if (props.loadError) return { state: 'error', text: 'Kostgrundlaget kunne ikke hentes. Prøv igen fra coachens overblik.' }
  if (props.loading || !context || !source)
    return { state: 'loading', text: 'Kostgrundlaget er endnu ikke indlæst.' }
  if (!day || !id(athlete?.id) || !id(props.session?.user?.id) ||
    context?.coachId !== props.session.user.id || context.day !== day || !ids(context.athleteIds) ||
    !context.athleteIds.includes(athlete.id) ||
    source?.coachId !== context.coachId || source.day !== day ||
    !ids(source.athleteIds) || source.athleteIds.length !== context.athleteIds.length ||
    !context.athleteIds.every(a => source.athleteIds.includes(a))) return unavailable
  if (source.state === 'error') return { state: 'error', text: 'Kostgrundlaget kunne ikke hentes. Prøv igen fra coachens overblik.' }
  if (source.state === 'loading') return { state: 'loading', text: 'Kostgrundlaget er endnu ikke indlæst.' }
  if (source.state === 'partial' || source.state === 'ready' && source.complete !== true)
    return { state: 'partial', text: 'Kostgrundlaget er ufuldstændigt.' }
  if (source.state !== 'ready' ||
    !civilDay(source.from) || source.through !== day || ordinal(source.from) !== ordinal(day) - 6 ||
    !Array.isArray(source.rows) || !Array.isArray(source.targets)) return unavailable

  const allowed = new Set(source.athleteIds), totals = new Map(), seen = new Set(), targets = new Set()
  let skipped = 0
  for (const row of source.rows) {
    if (!allowed.has(row?.athlete_id) || !civilDay(row.date) || row.date < source.from || row.date > day ||
      !id(row.id) || seen.has(row.id)) return unavailable
    seen.add(row.id)
    if (typeof row.meal === 'string' && row.meal.trimStart().startsWith('[appData2-day-v1]')) continue
    const kcal = parseInputNumber(row.kcal), protein = parseInputNumber(row.protein)
    if (typeof row.meal !== 'string' || !row.meal.trim() || kcal === null || protein === null) {
      if (row.athlete_id === athlete.id) skipped++
      continue
    }
    if (!totals.has(row.athlete_id)) totals.set(row.athlete_id, new Map())
    const days = totals.get(row.athlete_id), sum = days.get(row.date) || { kcal: 0, protein: 0 }
    sum.kcal += kcal; sum.protein += protein
    if (!Number.isFinite(sum.kcal) || !Number.isFinite(sum.protein)) return unavailable
    days.set(row.date, sum)
  }
  for (const target of source.targets) {
    if (!allowed.has(target?.athlete_id) || targets.has(target.athlete_id)) return unavailable
    targets.add(target.athlete_id)
  }
  return { state: 'ready', days: totals.get(athlete.id) ?? new Map(), skipped }
}

export function nutritionWeek(props = {}, basis = nutritionBasis(props)) {
  const days = basis.state === 'ready' ? basis.days : null
  if (!days || days.size < 3) return null
  const kcal = [...days.values()].reduce((n, d) => n + d.kcal, 0) / days.size
  const protein = [...days.values()].reduce((n, d) => n + d.protein, 0) / days.size
  if (!Number.isFinite(kcal) || !Number.isFinite(protein)) return null
  const whole = value => Math.round(value).toLocaleString('da-DK')
  return { days: days.size, kcal, protein,
    text: `Seneste 7 dage: gns. ${whole(kcal)} kcal / ${whole(protein)} g protein (${days.size} ${antalOrd(days.size, 'logget dag', 'loggede dage')})` }
}

// Compare logged daily totals with the current saved goals, not historical goals
// or unsaved editor drafts. No logging is not evidence of reaching either goal.
export function nutritionGoalWeek(props = {}, basis = nutritionBasis(props)) {
  const days = basis.state === 'ready' ? basis.days : null
  if (!days) return null
  const model = kostMaalModel({ athlete: props.athlete })
  // Fixed absolute tolerance repairs binary decimal summation noise only.
  // It never scales with the goal or rounds a 0.01 shortfall up to attainment.
  const count = (key, target) => target === null ? null :
    [...days.values()].filter(day => target - day[key] <= 1e-9).length
  const kcal = count('kcal', model.kcal), protein = count('protein', model.protein)
  if (kcal === null && protein === null) return null
  const goals = [['energi', kcal], ['protein', protein]].filter(([, count]) => count !== null)
    .map(([label, count]) => `${label} ${count} af 7 dage`).join(' · ')
  const logged = `${days.size} ${antalOrd(days.size, 'logget dag', 'loggede dage')}`
  return { days: days.size, kcal, protein,
    text: `Seneste 7 dage med nuværende mål: ${goals} (${logged}).` }
}
