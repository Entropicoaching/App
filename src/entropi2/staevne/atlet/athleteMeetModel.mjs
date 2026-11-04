import { LIFTS, validateResult } from '../meetModel.mjs'

export const OUTCOMES = Object.freeze({ pending: 'Afventer', good: 'Godkendt', miss: 'Ikke godkendt' })
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const weight = kg => validateResult({ kg }).status === 'valid' && typeof kg === 'number'
const time = value => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
const empty = () => ({ status: 'empty' })
const error = () => ({ status: 'error' })

// Consume the coach's planLift output, never generate or round new proposals.
export function readPlans(input) {
  if (input == null) return Object.fromEntries(Object.keys(LIFTS).map(lift => [lift, empty()]))
  if (!record(input)) return Object.fromEntries(Object.keys(LIFTS).map(lift => [lift, error()]))
  return Object.fromEntries(Object.keys(LIFTS).map(lift => {
    const plan = Object.hasOwn(input, lift) ? input[lift] : null
    if (plan == null || (record(plan) && plan.status === 'empty')) return [lift, empty()]
    if (!record(plan) || plan.status !== 'ready' || !Array.isArray(plan.attempts) ||
        plan.attempts.length !== 3 || ![0, 1, 2].every(index => weight(plan.attempts[index])) ||
        !Array.isArray(plan.warmup) || plan.warmup.length > 20 ||
        (plan.openerTime != null && !time(plan.openerTime))) return [lift, error()]
    if (!Array.from(plan.warmup).every(set => record(set) && weight(set.kg) && set.kg < plan.attempts[0] &&
        Number.isInteger(set.reps) && set.reps > 0 && set.reps <= 20 &&
        Number.isInteger(set.minutesBefore) && set.minutesBefore > 0 && set.minutesBefore <= 1440 &&
        (set.time == null || time(set.time)) && typeof set.previousDay === 'boolean' &&
        (!set.previousDay || set.time != null))) return [lift, error()]
    return [lift, { status: 'ready', attempts: [...plan.attempts], openerTime: plan.openerTime ?? null,
      warmup: plan.warmup.map(({ kg, reps, minutesBefore, time, previousDay }) => ({ kg, reps, minutesBefore, time: time ?? null, previousDay })) }]
  }))
}

export function emptyResults() {
  return Object.fromEntries(Object.keys(LIFTS).map(lift => [lift, ['pending', 'pending', 'pending']]))
}

export function validResults(results) {
  return record(results) && Object.keys(LIFTS).every(lift => Object.hasOwn(results, lift) &&
    Array.isArray(results[lift]) && results[lift].length === 3 &&
    [0, 1, 2].every(index => typeof results[lift][index] === 'string' && Object.hasOwn(OUTCOMES, results[lift][index])))
}

// Stable, bounded fingerprint of the displayed plan, independent of object identity.
export const planFingerprint = plans => JSON.stringify(Object.keys(LIFTS).map(lift => plans[lift]))

export function summarize(plans, results) {
  if (!validResults(results)) return { status: 'error', best: {}, sum: null }
  const best = Object.fromEntries(Object.keys(LIFTS).map(lift => {
    const approved = plans[lift].status === 'ready'
      ? plans[lift].attempts.filter((_, index) => results[lift][index] === 'good') : []
    return [lift, approved.length ? Math.max(...approved) : null]
  }))
  const values = Object.values(best).filter(kg => kg !== null)
  const complete = Object.keys(LIFTS).every(lift => plans[lift].status === 'ready' && results[lift].every(value => value !== 'pending'))
  return { best, sum: values.length ? values.reduce((sum, kg) => sum + kg, 0) : null,
    status: values.length === 3 ? complete ? 'total' : 'provisional-total' : complete ? 'no-total' : values.length ? 'partial' : 'empty' }
}
