import { antalOrd } from '../antalOrd.mjs'
import { activityDay } from '../../dashboard/coachInactive.mjs'
import { parseInputNumber } from '../../athlete/kostNumbers.mjs'
import { isDayReceipt } from '../../mealEvidence.mjs'
import { kostDageModPlan, makroDageModPlan, planWindow, MIN_ASSESSED_DAYS } from '../analysis/kostDageModPlan.mjs'

const ordinal = day => Date.parse(day + 'T00:00:00Z') / 86400000
const civilDay = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && activityDay(value) === value
const id = value => typeof value === 'string' && value.trim().length > 0
const ids = values => Array.isArray(values) && values.every(id) && new Set(values).size === values.length

// A completed read receipt belongs to its captured owner, roster and Danish day.
// No I/O; incomplete, stale or misrouted batches are deliberately silent.
function readySource(props, day, rosterReady) {
  const source = props.coachNutrition, context = props.readContext
  if (!rosterReady || !civilDay(day) || !id(props.session?.user?.id) ||
    context?.coachId !== props.session.user.id || context.day !== day || !ids(context.athleteIds) ||
    source?.coachId !== context.coachId || source.day !== day ||
    !ids(source.athleteIds) || source.athleteIds.length !== context.athleteIds.length ||
    !context.athleteIds.every(a => source.athleteIds.includes(a)) ||
    source.state !== 'ready' || source.complete !== true ||
    !civilDay(source.from) || source.through !== day || ordinal(source.from) !== ordinal(day) - 6 ||
    !Array.isArray(source.rows) || !Array.isArray(source.targets)) return null
  return source
}

// U1 success measure: how many athletes logged a meal on at least 4 of the
// last 7 days. Same completed receipt as the lines below; null when unknown.
export const KOSTDAGE_MAAL = 4
export function kostvaneTal(props, day, athletes, rosterReady) {
  const source = readySource(props, day, rosterReady)
  if (!source || !Array.isArray(athletes)) return null
  const allowed = new Set(source.athleteIds), days = new Map()
  for (const row of source.rows) {
    if (!allowed.has(row?.athlete_id) || !civilDay(row.date) || row.date < source.from || row.date > day) return null
    if (typeof row.meal !== 'string' || !row.meal.trim() || row.meal.trimStart().startsWith('[appData2-day-v1]')) continue
    if (!days.has(row.athlete_id)) days.set(row.athlete_id, new Set())
    days.get(row.athlete_id).add(row.date)
  }
  const count = athlete => days.get(athlete.id)?.size ?? 0
  const roster = athletes.filter(athlete => allowed.has(athlete.id))
  return { aktive: roster.length, maal: KOSTDAGE_MAAL,
    medMaal: roster.filter(a => count(a) >= KOSTDAGE_MAAL).length,
    lidt: roster.filter(a => count(a) > 0 && count(a) < KOSTDAGE_MAAL).length,
    ingen: roster.filter(a => count(a) === 0).length }
}

// Ordre 1588: kostplanens dagsreferencer pr. atlet, kun når læsningen er den, vi forventer
// (præcis de 14 afsluttede dage). Alt andet giver intet, og så bruges profilens mål som før.
export function planSource(source, day) {
  const plan = source.plan, { start, end } = planWindow(day)
  if (!plan || plan.from !== start || plan.through !== end || !Array.isArray(plan.athletes) ||
    !Array.isArray(plan.meals)) return new Map()
  const allowed = new Set(source.athleteIds), result = new Map()
  for (const entry of plan.athletes) {
    if (!allowed.has(entry?.athlete_id) || result.has(entry.athlete_id) || !Array.isArray(entry.days)) continue
    if (!entry.days.some(d => d?.state === 'approved' && d.date >= start && d.date <= end)) continue
    result.set(entry.athlete_id, { planDays: entry.days,
      meals: plan.meals.filter(row => row?.athlete_id === entry.athlete_id) })
  }
  return result
}

// Ordre 1615: kulhydrat og fedt mod planens dagsmål på de dage, linjen allerede har vurderet.
// Samme 10 %-tolerance som kcal. En dag tæller kun, hvis planen har et mål over 0 og alle dagens
// rækker har tal (0 er et tal, null er ukendt). Under 4 dage for et felt vises intet for det felt.
function macroDays(entry, assessed) {
  const days = makroDageModPlan({ planDays: entry.planDays, meals: entry.meals, dates: new Set(assessed.keys()) })
  const parts = []
  for (const [key, label] of [['carb', 'Kulhydrat'], ['fat', 'Fedt']]) {
    const n = days[key].size, hit = [...days[key].values()].filter(Boolean).length
    if (n >= MIN_ASSESSED_DAYS) parts.push({ key, label, hit, n })
  }
  return parts
}

// Samme måling som atletens "Kostdage mod mål" (genbrug af kostDageModPlan, samme 14 dage).
// Under 4 vurderede dage er linjen stille; den falder aldrig tilbage til profilens mål.
function planLine(entry, plan, day) {
  const goals = kostDageModPlan({ planDays: entry.planDays, meals: entry.meals, today: day })
  if (!goals.size) return null
  const { start, end } = planWindow(day)
  const logged = new Set(entry.meals.filter(row => row?.date >= start && row.date <= end && !isDayReceipt(row) &&
    typeof row.meal === 'string' && row.meal.trim()).map(row => row.date))
  const hit = [...goals.values()].filter(Boolean).length
  const notAssessed = [...logged].filter(date => !goals.has(date)).length
  const macros = macroDays(entry, goals)
  return { from: plan.from, through: plan.through, mod: 'plan', days: goals.size, hit, notAssessed,
    kcal: null, protein: null, kcalTarget: null, proteinTarget: null, proteinReachedDays: null,
    macros: Object.fromEntries(macros.map(m => [m.key, { hit: m.hit, days: m.n }])),
    text: `Kost · mod kostplan · ${hit} af ${goals.size} vurderede dage ramt, seneste 14 dage` +
      (notAssessed > 0 ? ` · ${notAssessed} ${antalOrd(notAssessed, 'dag', 'dage')} ikke vurderet` : '') +
      (macros.length ? ` · ${macros.map(m => `${m.label} ${m.hit} af ${m.n}`).join(', ')} inden for 10 % af planen` : '') }
}

export function coachNutritionLines(props, day, athletes, rosterReady) {
  const result = new Map(), source = readySource(props, day, rosterReady)
  if (!source) return result

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
  const planned = planSource(source, day)
  for (const athlete of athletes) {
    if (planned.has(athlete.id)) {
      const line = planLine(planned.get(athlete.id), source.plan, day)
      if (line) result.set(athlete.id, line)
      continue
    }
    const days = totals.get(athlete.id)
    if (!days || days.size < 4) continue
    const kcal = [...days.values()].reduce((n, d) => n + d.kcal, 0) / days.size
    const protein = [...days.values()].reduce((n, d) => n + d.protein, 0) / days.size
    if (!Number.isFinite(kcal) || !Number.isFinite(protein)) continue
    const target = targets.get(athlete.id)
    const kcalTarget = parseInputNumber(target?.kcal_target), proteinTarget = parseInputNumber(target?.protein_target)
    // Each available goal remains visible even if the other goal is unknown.
    const goalParts = []
    if (kcalTarget > 0) goalParts.push(`${Math.round(kcalTarget)} kcal`)
    if (proteinTarget > 0) goalParts.push(`${Math.round(proteinTarget)} g protein`)
    const goals = goalParts.length ? `Mål: ${goalParts.join(' / ')}` : 'Ingen mål endnu'
    const proteinReachedDays = proteinTarget > 0
      ? [...days.values()].filter(d => d.protein + 1e-9 >= proteinTarget).length : null
    const proteinProgress = proteinReachedDays !== null
      ? ` · Protein nået ${proteinReachedDays} af ${days.size} ${antalOrd(days.size, 'dag', 'dage')}` : ''
    result.set(athlete.id, { from: source.from, through: day, days: days.size, kcal, protein,
      kcalTarget: kcalTarget > 0 ? kcalTarget : null,
      proteinTarget: proteinTarget > 0 ? proteinTarget : null, proteinReachedDays,
      text: `Kost · ${days.size}/7 dage · Gns. pr. logget dag: ${Math.round(kcal)} kcal / ${Math.round(protein)} g protein · ${goals}${proteinProgress} · mod profilens mål` })
  }
  return result
}
