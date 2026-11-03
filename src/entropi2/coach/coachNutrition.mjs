import { activityDay } from '../../dashboard/coachInactive.mjs'
import { parseInputNumber } from '../../athlete/kostNumbers.mjs'

const ordinal = day => Date.parse(day + 'T00:00:00Z') / 86400000
const civilDay = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && activityDay(value) === value
const id = value => typeof value === 'string' && value.trim().length > 0
const ids = values => Array.isArray(values) && values.every(id) && new Set(values).size === values.length

// A completed read receipt belongs to its captured owner, roster and Danish day.
// No I/O; incomplete, stale or misrouted batches are deliberately silent.
export function coachNutritionLines(props, day, athletes, rosterReady) {
  const result = new Map(), source = props.coachNutrition, context = props.readContext
  if (!rosterReady || !civilDay(day) || !id(props.session?.user?.id) ||
    context?.coachId !== props.session.user.id || context.day !== day || !ids(context.athleteIds) ||
    source?.coachId !== context.coachId || source.day !== day ||
    !ids(source.athleteIds) || source.athleteIds.length !== context.athleteIds.length ||
    !context.athleteIds.every(a => source.athleteIds.includes(a)) ||
    source.state !== 'ready' || source.complete !== true ||
    !civilDay(source.from) || source.through !== day || ordinal(source.from) !== ordinal(day) - 6 ||
    !Array.isArray(source.rows) || !Array.isArray(source.targets)) return result

  const allowed = new Set(source.athleteIds), totals = new Map(), targets = new Map(), seen = new Set()
  for (const row of source.rows) {
    if (!allowed.has(row?.athlete_id) || !civilDay(row.date) || row.date < source.from || row.date > day ||
      !id(row.id) || seen.has(row.id)) return result
    seen.add(row.id)
    // Existing appData2 confirmation rows are metadata, never logged meals.
    if (typeof row.meal === 'string' && row.meal.trimStart().startsWith('[appData2-day-v1]')) continue
    const kcal = parseInputNumber(row.kcal), protein = parseInputNumber(row.protein)
    if (typeof row.meal !== 'string' || !row.meal.trim() || kcal === null || protein === null) return result
    if (!totals.has(row.athlete_id)) totals.set(row.athlete_id, new Map())
    const days = totals.get(row.athlete_id), sum = days.get(row.date) || { kcal: 0, protein: 0 }
    sum.kcal += kcal; sum.protein += protein
    if (!Number.isFinite(sum.kcal) || !Number.isFinite(sum.protein)) return result
    days.set(row.date, sum)
  }
  for (const target of source.targets) {
    if (!allowed.has(target?.athlete_id) || targets.has(target.athlete_id)) return result
    targets.set(target.athlete_id, target)
  }
  for (const athlete of athletes) {
    const days = totals.get(athlete.id)
    if (!days || days.size < 4) continue
    const kcal = [...days.values()].reduce((n, d) => n + d.kcal, 0) / days.size
    const protein = [...days.values()].reduce((n, d) => n + d.protein, 0) / days.size
    if (!Number.isFinite(kcal) || !Number.isFinite(protein)) continue
    const target = targets.get(athlete.id)
    const kcalTarget = parseInputNumber(target?.kcal_target), proteinTarget = parseInputNumber(target?.protein_target)
    const goals = kcalTarget > 0 && proteinTarget > 0
      ? `Mål: ${Math.round(kcalTarget)} kcal / ${Math.round(proteinTarget)} g protein` : 'Ingen mål endnu'
    const proteinProgress = proteinTarget > 0
      ? ` · Protein nået ${[...days.values()].filter(d => d.protein + 1e-9 >= proteinTarget).length} af ${days.size} dage` : ''
    result.set(athlete.id, { days: days.size, kcal, protein,
      text: `Kost · ${days.size}/7 dage · Gns. pr. logget dag: ${Math.round(kcal)} kcal / ${Math.round(protein)} g protein · ${goals}${proteinProgress}` })
  }
  return result
}
