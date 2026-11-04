import { calendarTime } from '../../athlete/kostNumbers.mjs'
import { calculateMeals } from './foedevarer.mjs'

const id = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 200
const date = value => {
  if (calendarTime(value) === null || value < '1900-01-01') throw new TypeError('Gyldig kalenderdato kræves')
  return value
}
const targets = value => {
  const entries = ['kcal', 'protein', 'carb', 'fat'].map(key => {
    const n = value?.[key]
    if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0 || n > 100000) throw new TypeError('Alle dagsmål skal være kendte og positive')
    return [key, n]
  })
  return Object.fromEntries(entries)
}

/**
 * In-memory data contract only. Actor role/id must come from a trusted adapter;
 * this pure transition function is not authentication or a database ACL.
 */
export function createDraft({ id: planId, athleteId, coachId, createdOn, dailyTargets, meals = [] } = {}) {
  if (![planId, athleteId, coachId].every(id)) throw new TypeError('Plan-, atlet- og coach-id kræves')
  return { schema: 'entropi2-kostplan/v1', id: planId, athleteId, coachId, status: 'draft',
    createdOn: date(createdOn), dailyTargets: targets(dailyTargets), ...calculateMeals(meals), activated: null, archived: null }
}

export function transitionPlan(plan, { to, actor, on } = {}) {
  if (plan?.schema !== 'entropi2-kostplan/v1' || !['draft', 'active', 'archived'].includes(plan.status)) throw new TypeError('Ukendt plankontrakt')
  const checked = createDraft(plan)
  if (actor?.role !== 'coach' || actor.id !== checked.coachId) throw new TypeError('Kun planens coach kan aktivere eller arkivere')
  date(on)
  if (on < checked.createdOn) throw new TypeError('Overgang ligger før kladden')
  if (plan.status === 'draft' && to === 'active') {
    if (checked.meals.length === 0) throw new TypeError('En tom kladde kan ikke aktiveres')
    return { ...checked, status: 'active', activated: { by: actor.id, on } }
  }
  if (plan.status === 'active' && to === 'archived') {
    if (plan.activated?.by !== checked.coachId || date(plan.activated?.on) < checked.createdOn || on < plan.activated.on) throw new TypeError('Ugyldig aktiveringshistorik')
    return { ...checked, status: 'archived', activated: { by: plan.activated.by, on: plan.activated.on }, archived: { by: actor.id, on } }
  }
  throw new TypeError('Tilladte overgange: kladde → aktiv → arkiveret')
}
