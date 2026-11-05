import { evaluateAdjustment, decideAdjustment } from '../justering/model.mjs'
import { confirmedMealDays } from '../../../mealEvidence.mjs'
import { calendarTime, parseInputNumber } from '../../../athlete/kostNumbers.mjs'
import { identifier } from './model.mjs'
import { loggedDay } from '../../kostMaal/model.mjs'

const day = value => calendarTime(value) !== null && value >= '1900-01-01' && value <= '9999-12-24'
const DAY = 86400000

// No reader, clock, storage or inferred capabilities. The current seven-day
// production receipt has no active energy basis or adult/load confirmation and
// therefore cannot offer a weekly adjustment. Complete means a complete READ;
// complete DIET days still require the athlete's existing meal confirmations.
export function portalAdjustment(options = {}) {
  if (options.enabled !== true) return null
  const { coachId, athleteId, date, receipt: r } = options
  if (![coachId, athleteId].every(identifier) || !day(date) || !r
    || r.coachId !== coachId || r.athleteId !== athleteId || r.date !== date
    || r.state !== 'ready' || r.complete !== true || !day(r.from) || r.through !== date) return null
  const windowDays = (calendarTime(date) - calendarTime(r.from)) / DAY + 1
  if (windowDays < 14 || windowDays > 28 || !Array.isArray(r.mealLogs) || !Array.isArray(r.weightLogs)) return null
  const basis = r.adjustmentBasis, plan = basis?.plan
  if (!plan || plan.coachId !== coachId || plan.athleteId !== athleteId
    || basis.adult !== true || basis.training == null) return null
  const seenMeals = new Set(), seenWeights = new Set()
  const scoped = (row, seen) => {
    if (!row || row.athlete_id !== athleteId || !identifier(row.id) || seen.has(row.id)) return false
    seen.add(row.id); return true
  }
  // Reject foreign and ambiguous receipts as a whole, rather than repairing scope.
  if (!r.mealLogs.every(row => scoped(row, seenMeals) && day(row.date)
    && row.date >= r.from && row.date <= date && typeof row.meal === 'string' && row.meal.trim())) return null
  if (!r.weightLogs.every(row => scoped(row, seenWeights))) return null
  const weights = r.weightLogs.map(row => ({ date: loggedDay(row.logged_at),
    kg: parseInputNumber(row.weight) }))
  const valid = weights.filter(row => day(row.date) && row.date >= r.from && row.date <= date && row.kg >= 25 && row.kg <= 350)
  const counts = new Map()
  for (const row of valid) counts.set(row.date, (counts.get(row.date) ?? 0) + 1)
  const latest = valid.filter(row => counts.get(row.date) === 1).sort((a, b) => b.date.localeCompare(a.date))[0]
  if (!latest) return null
  // Exclude today's confirmations: the existing diary only confirms past days.
  const dietDays = confirmedMealDays(r.mealLogs.filter(row => row.date < date))
    .map(row => ({ date: row.date, kcal: row.kcal, complete: row.completeDay }))
  const nutrition = { date, windowDays, weightKg: latest.kg, adult: basis.adult,
    goal: basis.goal, intensity: basis.intensity, training: basis.training,
    readiness: basis.readiness, competition: basis.competition, minKcal: basis.minKcal,
    weights, dietDays }
  try {
    const snapshot = evaluateAdjustment({ enabled: true, plan, nutrition })
    // The calculation owns all coverage, trend, recovery, floor and cooldown
    // rules. No empty/hold/review card or inactive action appears in the tab.
    return snapshot.phase === 'ready' ? { snapshot, plan, nutrition } : null
  } catch { return null }
}

// A synchronous local choice only. Re-evaluate the exact visible proposal; never
// save an energy-only basis over an active meal plan or claim activation.
export function choosePortalAdjustment(options, proposal, decision) {
  const fresh = portalAdjustment(options)
  if (!fresh) throw TypeError('Datagrundlaget er ændret. Genåbn kostfanen.')
  return decideAdjustment(proposal, { plan: fresh.plan, nutrition: fresh.nutrition,
    actor: { role: 'coach', id: options.coachId }, on: options.date, decision })
}
