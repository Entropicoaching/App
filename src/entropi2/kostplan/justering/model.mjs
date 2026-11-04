import { calculateNutrition } from '../beregning.mjs'
import { calendarTime } from '../../../athlete/kostNumbers.mjs'

const DAY = 86400000
const SCHEMA = 'entropi2-kostjustering/v1'
const copy = value => structuredClone(value)
const iso = time => new Date(time).toISOString().slice(0, 10)
const date = value => {
  const time = calendarTime(value)
  if (time === null || value < '1900-01-01' || value > '9999-12-24') throw new TypeError('Gyldig ISO-dato kræves')
  return time
}
const id = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 200

function planBasis(plan, on) {
  if (![plan?.id, plan?.athleteId, plan?.coachId].every(id)
    || plan.status !== 'active' || !Number.isSafeInteger(plan.version) || plan.version < 1
    || !Number.isFinite(plan.kcal) || plan.kcal <= 0 || plan.kcal > 100000) {
    throw new TypeError('En aktiv, versionsmærket energibasis med plan-, atlet- og coach-id kræves')
  }
  const created = date(plan.createdOn), end = date(on)
  const basis = { id: plan.id, athleteId: plan.athleteId, coachId: plan.coachId,
    status: plan.status, version: plan.version, kcal: plan.kcal, createdOn: plan.createdOn }
  if (created > end) throw new TypeError('Planen ligger i fremtiden')
  for (const key of ['lastAdjustedOn', 'evaluatedThrough', 'lastReviewedOn']) {
    if (plan[key] != null) {
      const time = date(plan[key])
      if (time < created || time > end) throw new TypeError('Ugyldig planhistorik')
      basis[key] = plan[key]
    }
  }
  return basis
}

/** Pure, unwired coach snapshot. kcal is the daily BASIS, before training fuel.
 * Inputs must already be scoped to one athlete by a trusted caller. No I/O.
 */
export function evaluateAdjustment(props = {}) {
  if (props.enabled !== true) return { phase: 'off' }
  if (props.plan == null) return { phase: 'empty', reason: 'Der er ingen aktiv kostplan at vurdere.' }
  const { nutrition } = props
  if (!nutrition || typeof nutrition !== 'object') throw new TypeError('Beregningsgrundlag kræves')
  const plan = planBasis(props.plan, nutrition.date)
  // A caller-supplied currentPlan can never override the version being reviewed.
  const calculation = calculateNutrition({ ...nutrition, currentPlan: plan })
  const weekly = calculation.weekly
  const snapshot = { schema: SCHEMA, phase: weekly.action === 'adjust' ? 'ready' : weekly.action,
    plan, evaluatedOn: nutrition.date, reason: weekly.reason,
    deltaKcal: weekly.deltaKcal, proposedKcal: weekly.proposedKcal,
    nextEligibleOn: weekly.nextEligibleOn, policyVersion: calculation.policyVersion,
    limits: copy(calculation.limits), warnings: [...calculation.warnings],
    evidence: { ...copy(calculation.evidence), trainingKnown: nutrition.training != null, targetWeeklyPct: calculation.targetWeeklyPct,
      observedWeeklyPct: weekly.evidence.observedWeeklyPct },
    requiresCoachActivation: true }
  const hold = (reason, nextEligibleOn = null) => Object.assign(snapshot,
    { phase: 'hold', deltaKcal: 0, proposedKcal: plan.kcal, reason, nextEligibleOn })
  const loadKcal = ({ rest: 0, light: 100, moderate: 200, high: 300 })[calculation.evidence.training.volume]
    + ({ light: 0, moderate: 50, high: 100 })[calculation.evidence.training.intensity]
  snapshot.limits.reviewBasisMinKcal = Math.max(calculation.limits.baseMinKcal, calculation.limits.minKcal - loadKcal)
  if (plan.kcal < snapshot.limits.reviewBasisMinKcal) {
    return { ...snapshot, phase: 'review', deltaKcal: 0, proposedKcal: null, nextEligibleOn: null,
      reason: 'Aktuel energibasis er under træningsdagens gulv. Coach skal rette planen før brug.' }
  }
  // Reviews, including rejections, consume a rolling seven-day slot. A plan
  // below its floor must remain visible as a review even during that interval.
  if (snapshot.phase === 'review') return snapshot
  if (plan.lastReviewedOn && date(nutrition.date) - date(plan.lastReviewedOn) < 7 * DAY) {
    return hold('Ugens forslag er allerede behandlet. Der skal gå syv hele dage mellem vurderinger.',
      iso(date(plan.lastReviewedOn) + 7 * DAY))
  }
  // The underlying calculation defaults unknown training to rest. This review
  // flow requires an explicit load before allowing an energy change.
  if (nutrition.training == null) return hold('Træningsbelastning mangler. Tilføj den før en justering.')
  if (weekly.action === 'adjust' && weekly.deltaKcal < 0
    && (nutrition.training.volume === 'high' || nutrition.training.intensity === 'high')) {
    return hold('Høj træningsbelastning: fasthold energien og lad coachen vurdere restitution før en reduktion.')
  }
  // The base module protects the resting basis. A training day's carbohydrate
  // floor can require a higher basis as well, even with its fuel added back.
  if (snapshot.phase === 'ready' && snapshot.proposedKcal < snapshot.limits.reviewBasisMinKcal) {
    snapshot.proposedKcal = snapshot.limits.reviewBasisMinKcal
    snapshot.deltaKcal = snapshot.proposedKcal - plan.kcal
    snapshot.reason += ' Træningsdagens kulhydratgulv begrænser reduktionen yderligere.'
    if (snapshot.deltaKcal === 0) return hold('Træningsdagens energigulv forhindrer en yderligere reduktion.')
  }
  return snapshot
}

/** Returns a candidate basis and a receipt, never a saved or activated plan.
 * Fresh plan AND fresh nutrition are required for optimistic version checking.
 * actor is a trusted adapter contract, not authentication or authorization.
 */
export function decideAdjustment(proposal, options = {}) {
  const { plan, nutrition, actor, decision, on } = options
  if (!['accept', 'reject'].includes(decision)) throw new TypeError('Vælg accept eller afvisning')
  const fresh = evaluateAdjustment({ enabled: true, plan, nutrition })
  if (fresh.phase !== 'ready' || proposal?.schema !== SCHEMA
    || JSON.stringify(fresh) !== JSON.stringify(proposal)) throw new TypeError('Forslaget er ændret eller forældet. Hent et nyt grundlag.')
  if (actor?.role !== 'coach' || actor.id !== fresh.plan.coachId) throw new TypeError('Kun planens coach kan behandle forslaget')
  if (date(on) !== date(fresh.evaluatedOn)) throw new TypeError('Vurdér et nyt grundlag på beslutningsdagen')
  if (fresh.plan.version === Number.MAX_SAFE_INTEGER) throw new TypeError('Planversionen kan ikke øges')
  const accepted = decision === 'accept'
  const nextPlan = { ...fresh.plan, version: fresh.plan.version + 1,
    kcal: accepted ? fresh.proposedKcal : fresh.plan.kcal,
    lastReviewedOn: on, evaluatedThrough: fresh.evidence.through }
  if (accepted) nextPlan.lastAdjustedOn = on
  const record = { schema: SCHEMA, planId: fresh.plan.id, athleteId: fresh.plan.athleteId,
    coachId: actor.id, fromVersion: fresh.plan.version, toVersion: nextPlan.version, decision, on,
    previousKcal: fresh.plan.kcal, kcal: nextPlan.kcal, deltaKcal: nextPlan.kcal - fresh.plan.kcal,
    reason: fresh.reason, evidence: copy(fresh.evidence), policyVersion: fresh.policyVersion }
  return { plan: nextPlan, record,
    snapshot: { ...copy(fresh), phase: accepted ? 'accepted' : 'rejected',
      reason: accepted ? 'Accepteret i kladden. Planen afventer bekræftet lagring og coachens aktivering.'
        : 'Afvist i kladden. Energien fastholdes, når vurderingen er gemt.',
      nextEligibleOn: iso(date(on) + 7 * DAY) } }
}
