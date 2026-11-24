import { antalOrd } from '../antalOrd.mjs'
import { activityDay } from '../../dashboard/coachInactive.mjs'
import { parseInputNumber } from '../../athlete/kostNumbers.mjs'
import { kostMaalModel } from './model.mjs'
import { ugeDageModPlan } from '../analysis/kostDageModPlan.mjs'
import { friUge } from '../kostplan/friPulje.mjs'

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
// Ordre 2030 (valg A som 1587): dage med godkendt kostplan tælles mod planens dagsmål (samme dagsvurdering
// som kostlinjen og ugerapporten, kostDageModPlan.mjs), øvrige dage mod profilens mål som ugerapporten
// (weeklyReportModel.mjs:49-62). De to tal blandes aldrig. Uden plandage er teksten som før.
export function nutritionGoalWeek(props = {}, basis = nutritionBasis(props)) {
  const days = basis.state === 'ready' ? basis.days : null
  if (!days) return null
  const model = kostMaalModel({ athlete: props.athlete })
  const plan = Array.isArray(props.planDays) && civilDay(props.today)
    ? ugeDageModPlan({ planDays: props.planDays, through: props.today,
      meals: props.coachNutrition.rows.filter(row => row?.athlete_id === props.athlete.id) })
    : null
  const planDates = plan ? plan.planDates : new Set()
  const rest = new Map([...days].filter(([date]) => !planDates.has(date)))
  // Fixed absolute tolerance repairs binary decimal summation noise only.
  // It never scales with the goal or rounds a 0.01 shortfall up to attainment.
  const count = (key, target) => target === null ? null :
    [...rest.values()].filter(day => target - day[key] <= 1e-9).length
  const kcal = count('kcal', model.kcal), protein = count('protein', model.protein)
  const part = (kcalCount, proteinCount, of) => [['energi', kcalCount], ['protein', proteinCount]]
    .filter(([, n]) => n !== null).map(([label, n]) => `${label} ${n} af ${of} dage`).join(' · ')
  const logged = `${days.size} ${antalOrd(days.size, 'logget dag', 'loggede dage')}`
  if (!planDates.size) {
    if (kcal === null && protein === null) return null
    return { days: days.size, kcal, protein, text: `Seneste 7 dage mod profilens mål: ${part(kcal, protein, 7)} (${logged}).` }
  }
  const hits = map => [...map.values()].filter(Boolean).length
  const planPart = part(hits(plan.kcal), hits(plan.protein), planDates.size)
  const restDays = 7 - planDates.size
  const restPart = restDays > 0 ? part(kcal, protein, restDays) : ''
  // 2137: med en fri pulje i ugen kommer basemåltider fulgt og dage med puljen holdt (kun plandage med niveau over 0 %).
  const fri = friUge({ dage: props.planDays, raekker: props.coachNutrition.rows.filter(row => row?.athlete_id === props.athlete.id) })
  const friPart = fri ? ` Basemåltider fulgt: ${fri.basis} af ${fri.basisAf}. Fri pulje holdt: ${fri.holdt} af ${fri.vurderede} ${antalOrd(fri.vurderede, 'logget dag', 'loggede dage')}.` : ''
  return { days: days.size, mod: 'plan', kcal: hits(plan.kcal), protein: hits(plan.protein), ...(fri ? { fri } : {}),
    text: `Seneste 7 dage mod kostplanen: ${planPart}` +
      (restPart ? `; øvrige ${restDays} ${antalOrd(restDays, 'dag', 'dage')} mod profilens mål: ${restPart}` : '') + ` (${logged}).` + friPart }
}

// Seneste logdags måltider (navn og kcal) ud fra samme kvittering og samme gyldighed som
// nutritionBasis; ingen nyt kald. Datoen er en kalenderdag (Europe/Copenhagen), aldrig UTC-regnet.
export function nutritionLatestMeals(props = {}, basis = nutritionBasis(props)) {
  if (basis.state !== 'ready' || basis.days.size === 0) return null
  const day = [...basis.days.keys()].sort().at(-1)
  const meals = props.coachNutrition.rows.filter(row => row.athlete_id === props.athlete.id && row.date === day &&
    !(typeof row.meal === 'string' && row.meal.trimStart().startsWith('[appData2-day-v1]')) &&
    typeof row.meal === 'string' && row.meal.trim() &&
    parseInputNumber(row.kcal) !== null && parseInputNumber(row.protein) !== null)
    .map(row => ({ id: row.id, name: row.meal.trim(), kcal: parseInputNumber(row.kcal) }))
  if (!meals.length) return null
  const label = new Date(day + 'T12:00:00Z').toLocaleDateString('da-DK', { day: 'numeric', month: 'short', timeZone: 'Europe/Copenhagen' })
  return { day, label, meals }
}
