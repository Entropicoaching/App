import { dayNumber, windowEnding } from '../trackingDates.mjs'

const finite = n => typeof n === 'number' && Number.isFinite(n)
const between = (n, min, max) => finite(n) && n >= min && n <= max
const text = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 160
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0
const optional = (value, min, max, integer = false) => value == null
  || (between(value, min, max) && (!integer || Number.isInteger(value)))
const average = values => values.length ? values.reduce((sum, n) => sum + n / values.length, 0) : null

function select(rows, athleteId, window, identity, validate) {
  if (!Array.isArray(rows) || rows.length > 10000) throw new TypeError('Rows required')
  const selected = [], seen = new Set()
  // Validate ownership/dates before filtering; never silently hide mixed scope.
  for (const row of rows) {
    if (!record(row) || row.athleteId !== athleteId) throw new TypeError('Invalid scope')
    dayNumber(row.day)
    if (row.day < window.from || row.day > window.to) continue
    const key = identity(row)
    if (!text(key) || seen.has(key) || !validate(row)) throw new TypeError('Ambiguous or invalid row')
    seen.add(key); selected.push(row)
  }
  return selected.sort((a, b) => compare(a.day, b.day) || compare(identity(a), identity(b)))
}

function wellbeing(rows, field) {
  const observations = rows.filter(row => row[field] != null).map(row => ({ day: row.day, value: row[field] }))
  return { count: observations.length, average: observations.length >= 4
    ? average(observations.map(row => row.value)) : null, observations }
}

function nutrition(rows, valueKey, targetKey) {
  const observations = rows.filter(row => row.complete === true && row[valueKey] != null
    && row[targetKey] != null && text(row.targetVersion))
    .map(row => ({ day: row.day, value: row[valueKey], target: row[targetKey], targetVersion: row.targetVersion }))
  const measured = average(observations.map(row => row.value))
  const target = average(observations.map(row => row.target))
  // Same dated days in numerator and denominator. Missing targets never mean zero.
  const ratio = measured !== null && target > 0 ? measured / target * 100 : null
  return { count: observations.length, average: measured, targetAverage: target,
    percent: finite(ratio) ? ratio : null, observations }
}

/** Pure, unwired, explicit opt-in. Authorized normalized snapshot; see README.
 * endDate is the caller's last completed Copenhagen day, never an implicit clock.
 * Only whitelisted fields are read/projected. No IO, mutation or cycle data.
 */
export function buildAthleteWeek(input, { enabled = false } = {}) {
  if (enabled !== true) return null
  if (!record(input)) return { status: 'error' }
  if (input.status === 'loading') return { status: 'loading' }
  if (input.status !== 'ready' || input.complete !== true || !text(input.athleteId)) return { status: 'error' }
  try {
    const window = windowEnding(input.endDate, 7), id = input.athleteId
    const sessions = select(input.sessions, id, window, row => row.id, row =>
      typeof row.planned === 'boolean' && typeof row.completed === 'boolean')
    const daily = select(input.daily, id, window, row => row.day, row => row.source === 'athlete_manual'
      && optional(row.sleepHours, 0, 24) && optional(row.energy, 1, 5, true))
    const days = select(input.nutritionDays, id, window, row => row.day, row =>
      typeof row.complete === 'boolean' && optional(row.kcal, 0, 100000)
      && optional(row.proteinG, 0, 10000)
      && (row.kcalTarget == null || between(row.kcalTarget, Number.MIN_VALUE, 100000))
      && (row.proteinTargetG == null || between(row.proteinTargetG, Number.MIN_VALUE, 10000))
      && (row.targetVersion == null || text(row.targetVersion)))
    const strength = input.strength
    if (strength !== null && (!record(strength) || !text(strength.exerciseId)
      || !text(strength.variantId) || !text(strength.label))) throw new TypeError('Selected lift required')
    const sets = strength === null ? [] : select(strength.sets, id, window, row => row.id, row =>
      row.exerciseId === strength.exerciseId && row.variantId === strength.variantId && row.unit === 'kg'
      && typeof row.confirmed === 'boolean' && typeof row.skipped === 'boolean'
      && typeof row.warmup === 'boolean' && optional(row.kg, 0, 100000)
      && optional(row.reps, 0, 10000, true))
    const eligible = sets.filter(row => row.confirmed && !row.skipped && !row.warmup
      && row.kg > 0 && row.reps >= 1 && row.reps <= 10)
      .map(row => ({ id: row.id, day: row.day, kg: row.kg, reps: row.reps,
        estimate: row.kg * (1 + row.reps / 30) }))
      .sort((a, b) => b.estimate - a.estimate || b.kg - a.kg
        || compare(a.day, b.day) || compare(a.id, b.id))
    const sleep = wellbeing(daily, 'sleepHours'), energy = wellbeing(daily, 'energy')
    const kcal = nutrition(days, 'kcal', 'kcalTarget'), protein = nutrition(days, 'proteinG', 'proteinTargetG')
    const completed = sessions.filter(row => row.completed)
    const hasData = sessions.length || eligible.length || sleep.count || energy.count || days.length
    return { status: hasData ? 'ready' : 'empty', ...window,
      sessions: { completed: completed.length, planned: sessions.filter(row => row.planned).length,
        completedPlanned: completed.filter(row => row.planned).length,
        extraCompleted: completed.filter(row => !row.planned).length,
        observations: sessions.map(row => ({ day: row.day, planned: row.planned, completed: row.completed })) },
      bestSet: { label: strength === null ? null : strength.label, count: eligible.length,
        value: eligible[0] ?? null },
      sleep, energy,
      nutrition: { loggedDays: days.length, completeDays: days.filter(row => row.complete).length, kcal, protein },
      encouragement: hasData ? 'Tag ugen i dit eget tempo — én registrering ad gangen.'
        : 'Start roligt med én registrering, når det passer dig.' }
  } catch (error) {
    if (!(error instanceof TypeError)) throw error
    return { status: 'error' }
  }
}
