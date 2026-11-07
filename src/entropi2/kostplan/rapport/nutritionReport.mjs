import { calendarTime, parseInputNumber } from '../../../athlete/kostNumbers.mjs'
import { isDayReceipt } from '../../../mealEvidence.mjs'
import { weightTrend } from '../../tracking/weightTrend.mjs'

export const namespace = 'entropi2:kostplan:rapport:v1'
export const metrics = Object.freeze(['kcal', 'protein', 'carb', 'fat'])
const DAY = 86400000
const id = value => typeof value === 'string' && !!value.trim() && value.length <= 200
const validDay = value => calendarTime(value) !== null && value >= '1900-01-01'
const fail = message => { throw new TypeError(message) }
const values = value => Object.fromEntries(metrics.map(key => [key, value]))
const iso = time => new Date(time).toISOString().slice(0, 10)
const finite = number => Number.isFinite(number) ? number : null
const sum = numbers => numbers.length && numbers.every(n => n !== null)
  ? finite(numbers.reduce((total, n) => total + n, 0)) : null
const percentage = (actual, target) => actual === null || !(target > 0)
  ? null : finite(actual / target * 100)

// Consume the public plan.mjs lifecycle, including archived history. Archive
// dates are exclusive; an activation applies from the start of its local day.
// This validates a read contract; it is not an authorization boundary.
function planHistory(plans, athleteId) {
  const seen = new Set()
  return plans.flatMap(plan => {
    if (plan?.athleteId !== athleteId || plan.status === 'draft') return []
    if (plan.schema !== 'entropi2-kostplan/v1' || !id(plan.id) || !id(plan.coachId)
      || !['active', 'archived'].includes(plan.status) || !validDay(plan.createdOn)
      || !validDay(plan.activated?.on) || plan.activated.by !== plan.coachId
      || plan.activated.on < plan.createdOn || seen.has(plan.id)) fail('Ugyldig planhistorik')
    seen.add(plan.id)
    if (plan.status === 'archived' && (!validDay(plan.archived?.on)
      || plan.archived.by !== plan.coachId || plan.archived.on < plan.activated.on)) fail('Ugyldig arkiveringshistorik')
    if (plan.status === 'active' && plan.archived != null) fail('Aktiv plan har arkiveringshistorik')
    const targets = Object.fromEntries(metrics.map(key => {
      const n = parseInputNumber(plan.dailyTargets?.[key])
      return [key, n > 0 && n <= 100000 ? n : null]
    }))
    return [{ id: plan.id, from: plan.activated.on,
      until: plan.status === 'archived' ? plan.archived.on : null, targets }]
  })
}

function dailyLogs(rows, athleteId, from, through) {
  const groups = new Map(), seen = new Set()
  for (const row of rows) {
    if (row?.athlete_id !== athleteId || !validDay(row.date) || row.date < from || row.date > through) continue
    // Confirmation metadata, including whitespace-prefixed legacy receipts,
    // is never a meal and cannot turn an unlogged day into a logged day.
    if (typeof row.meal === 'string' && isDayReceipt({ meal: row.meal.trimStart() })) continue
    if (id(row.id)) {
      if (seen.has(row.id)) fail('Kostloggen indeholder gentagne id’er')
      seen.add(row.id)
    }
    const knownMeal = id(row.id) && typeof row.meal === 'string' && !!row.meal.trim()
    const amounts = Object.fromEntries(metrics.map(key => [key, knownMeal ? parseInputNumber(row[key]) : null]))
    if (!groups.has(row.date)) groups.set(row.date, [])
    groups.get(row.date).push(amounts)
  }
  return groups
}

/**
 * Pure, unwired report for one athlete and the Monday/Sunday week containing
 * date (an explicit athlete-local as-of day). Ready reads must supply all three
 * arrays; a failed/missing read must not be converted into an empty array.
 * Future days are displayed, but excluded from all summaries. No I/O, implicit
 * clock, prescriptions or writes. See README.md for denominator/adapter rules.
 */
export function buildNutritionReport(options = {}) {
  if (options.enabled !== true) return null
  return nutritionReport(options)
}

// Compatibility entry point: a current plan cannot supply historical targets.
// Callers without the bounded daily read get explicit unknown references.
export function buildActivePlanNutritionReport(options = {}) {
  if (options.enabled !== true) return null
  const { activePlan: plan, athleteId, date } = options
  if (!plan) return null
  if (plan.athlete_id !== athleteId || plan.date !== date || plan.active !== true
    || !id(plan.id) || !id(plan.revision) || !Array.isArray(plan.meals) || !plan.meals.length
    || !plan.targets || !metrics.every(key => plan.targets[key] === null
      || typeof plan.targets[key] === 'number' && Number.isFinite(plan.targets[key]) && plan.targets[key] >= 0))
    fail('Ugyldig aktiv plan')
  return buildDailyPlanNutritionReport({ enabled: true, athleteId, date, mealLogs: options.mealLogs,
    dailyReferences: options.dailyReferences })
}

// Mounted coach report: consumption survives absent/incomplete history. Every
// target comes from the matching scoped day; no profile/current-plan fallback.
export function buildDailyPlanNutritionReport(options = {}) {
  if (options.enabled !== true) return null
  const { athleteId, date } = options
  if (!id(athleteId) || !validDay(date) || date < '1900-01-07' || date > '9999-12-24') fail('Atlet og gyldig rapportdato kræves')
  const from = iso(calendarTime(date) - 6 * DAY)
  const refs = options.dailyReferences ?? { schema: 'entropi2-kostplan:daily-reference/v1', athleteId, date, from, through: date,
    state: 'unavailable', reason: 'history-not-supplied', days: Array.from({ length: 7 }, (_, i) => ({
      date: iso(calendarTime(from) + i * DAY), state: 'unknown', reason: 'history-not-supplied',
      planId: null, versionId: null, targets: values(null),
    })) }
  if (refs.schema !== 'entropi2-kostplan:daily-reference/v1' || refs.athleteId !== athleteId || refs.date !== date
    || refs.from !== from || refs.through !== date || !['ready', 'unavailable'].includes(refs.state)
    || !Array.isArray(refs.days) || refs.days.length !== 7) fail('Ugyldig daglig planreference')
  refs.days.forEach((r, i) => {
    if (r.date !== iso(calendarTime(from) + i * DAY) || !['approved', 'unknown', 'conflict'].includes(r.state)
      || !r.targets || !metrics.every(key => r.targets[key] === null || typeof r.targets[key] === 'number'
        && Number.isFinite(r.targets[key]) && r.targets[key] >= 0)
      || (r.state === 'approved' ? refs.state !== 'ready' || !id(r.planId) || !id(r.versionId)
        : r.planId !== null || r.versionId !== null || metrics.some(key => r.targets[key] !== null))) fail('Ugyldig daglig planreference')
  })
  return nutritionReport({ athleteId, date, mealLogs: options.mealLogs, weightLogs: [] }, refs)
}

function nutritionReport(options, dailyReferences = null) {
  const { athleteId, date, plans, mealLogs, weightLogs } = options
  if (!id(athleteId) || !validDay(date) || date > '9999-12-24') fail('Atlet og gyldig rapportdato kræves')
  if (![...(dailyReferences ? [] : [plans]), mealLogs, weightLogs].every(Array.isArray)) fail('Rapporten kræver færdighentede lister')
  const end = calendarTime(date)
  const start = end - (dailyReferences ? 6 : (new Date(end).getUTCDay() + 6) % 7) * DAY
  const from = iso(start), through = iso(start + 6 * DAY)
  if (!validDay(from) || !validDay(through)) fail('Ugen ligger uden for datointervallet')
  const history = dailyReferences ? [] : planHistory(plans, athleteId)
  const grouped = dailyLogs(mealLogs, athleteId, from, date)
  const days = Array.from({ length: 7 }, (_, offset) => {
    const day = iso(start + offset * DAY)
    const future = day > date
    const matches = future ? [] : history.filter(plan => plan.from <= day && (plan.until === null || day < plan.until))
    const reference = dailyReferences?.days[offset]
    const planState = reference ? reference.state === 'approved' ? 'active' : reference.state
      : future ? 'future' : matches.length > 1 ? 'conflict' : matches.length ? 'active' : 'none'
    const targets = reference ? { ...reference.targets } : planState === 'active' ? { ...matches[0].targets } : values(null)
    const logs = grouped.get(day) || []
    const totals = Object.fromEntries(metrics.map(key => [key, sum(logs.map(row => row[key]))]))
    return { date: day, future, planState, planId: reference ? reference.planId : planState === 'active' ? matches[0].id : null,
      ...(reference ? { planRevision: reference.versionId, referenceReason: reference.reason } : {}),
      targets, totals, percentages: Object.fromEntries(metrics.map(key => [key, percentage(totals[key], targets[key])])),
      mealCount: logs.length, logState: future ? 'future' : !logs.length ? 'missing'
        : metrics.some(key => totals[key] === null) ? 'unknown' : 'logged' }
  })
  const elapsed = days.filter(day => !day.future)
  const logged = elapsed.filter(day => day.mealCount > 0)
  const weekMetrics = Object.fromEntries(metrics.map(key => {
    const actual = sum(logged.map(day => day.totals[key]))
    const target = sum(logged.map(day => day.targets[key]))
    return [key, { actual, target, percent: percentage(actual, target) }]
  }))
  const trend = weightTrend(weightLogs, athleteId, date)
  // Return only the two windows displayed beside this week, never unrelated
  // historical rows or another athlete's identifiers/content.
  const recentWeights = trend.daily.filter(row => row.date >= iso(end - 13 * DAY))
  const daily = recentWeights.filter(row => row.date >= iso(end - 6 * DAY))
    .map(row => ({ date: row.date, kg: row.weight }))
  const previous = recentWeights.filter(row => row.date < iso(end - 6 * DAY))
  return { namespace, athleteId, date, from, through, days,
    ...(dailyReferences ? { comparison: 'daily-approved-plan', referenceState: dailyReferences.state,
      referenceReason: dailyReferences.reason } : {}),
    week: { elapsedDays: elapsed.length, loggedDays: logged.length,
      missingDays: elapsed.length - logged.length,
      unknownDays: logged.filter(day => day.logState === 'unknown').length,
      plannedDays: elapsed.filter(day => day.planState === 'active').length,
      conflictDays: elapsed.filter(day => day.planState === 'conflict').length,
      ...(dailyReferences ? { unknownReferenceDays: elapsed.filter(day => day.planState !== 'active').length } : {}), metrics: weekMetrics },
    weight: { from: iso(end - 6 * DAY), through: date,
      average: trend.average, days: trend.days, daily,
      previousFrom: iso(end - 13 * DAY), previousThrough: iso(end - 7 * DAY),
      previousDays: previous.length, changeKg: trend.weeklyChange?.kg ?? null } }
}
