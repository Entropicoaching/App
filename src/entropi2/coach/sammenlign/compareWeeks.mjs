import { calendarDay, addCalendarDays } from '../../../calendarDate.js'
import { parseInputNumber, finiteMean } from '../../../inputValues.js'
import { estimatedOneRepMax, erTungtSaet, erDeloadLog } from '../../../exerciseProgress.js'
import { exerciseSetView } from '../../../exerciseSetView.js'
import { rpeOrigin } from '../../../rpeEvidence.mjs'
import { isDayReceipt } from '../../../mealEvidence.mjs'

const id = value => typeof value === 'string' && value.trim().length > 0
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && calendarDay(value) === value
const stamp = value => typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}(?:$|T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d))$/.test(value)
  ? calendarDay(value) : null
const safe = value => Number.isFinite(value) ? value : null
const sum = values => safe(values.reduce((total, value) => total + value, 0))

// A receipt covers exactly one athlete and the displayed observed date range.
// Conflicts, pending writes and malformed/mis-scoped rows invalidate that source.
// Signature uses the fields consumed below, independent of object key order.
function rows(source, athleteId, start, through, kind) {
  if (source?.state !== 'ready' || source.complete !== true || source.athleteId !== athleteId ||
      source.from !== start || source.through !== through || !Array.isArray(source.rows)) return null
  const unique = new Map(), positions = new Map()
  for (const row of source.rows) {
    if (!row || !id(row.id) || row.athlete_id !== athleteId || row._optimistic) return null
    const day = kind === 'nutrition' ? (date(row.date) ? row.date : null) : stamp(row.logged_at)
    if (!day || day < start || day > through) return null
    const signature = JSON.stringify(kind === 'training'
      ? [day, row.logged_at, row.exercise_id, row.set_number, row.weight, row.reps_completed,
        row.skipped, row.rpe_actual, row.rpe_source, row.note, row.exercises?.name,
        row.exercises?.sessions?.id, row.exercises?.sessions?.weeks?.block_name]
      : kind === 'nutrition' ? [day, row.meal, row.kcal, row.protein] : [day, row.weight])
    if (unique.has(row.id) && unique.get(row.id).signature !== signature) return null
    if (kind === 'training' && id(row.exercise_id) && Number.isSafeInteger(row.set_number)) {
      const position = JSON.stringify([row.exercise_id, row.set_number])
      if (positions.has(position) && positions.get(position) !== row.id) return null
      positions.set(position, row.id)
    }
    unique.set(row.id, { row, day, signature })
  }
  return [...unique.values()]
}

function training(entries) {
  const unknown = { sessions: null, sets: null, volume: null, rpe: null, rpeCount: null, lifts: [] }
  if (!entries) return unknown
  const sessions = new Set(), volumes = [], ratings = [], lifts = new Map()
  let sessionsKnown = true, sets = 0
  for (const { row } of entries) {
    if (row.skipped != null && typeof row.skipped !== 'boolean') return unknown
    if (row.skipped === true) continue
    const weight = parseInputNumber(row.weight), reps = parseInputNumber(row.reps_completed)
    if (weight === null || !Number.isSafeInteger(reps) || reps <= 0 || !Number.isFinite(weight * reps)) return unknown
    sets++; volumes.push(weight * reps)
    const sessionId = row.exercises?.sessions?.id
    if (!id(sessionId)) sessionsKnown = false
    else sessions.add(sessionId)
    const rating = parseInputNumber(row.rpe_actual)
    if (rating !== null && rating <= 10 && rpeOrigin(row) === 'athlete') ratings.push(rating)
    const name = row.exercises?.name, block = row.exercises?.sessions?.weeks?.block_name
    if (!id(name) || typeof block !== 'string' || !erTungtSaet(name, reps) || erDeloadLog(row)) continue
    const estimate = estimatedOneRepMax(weight, reps)
    if (!(estimate > 0)) continue
    const lift = exerciseSetView(name)
    if (!lifts.has(lift.key) || estimate > lifts.get(lift.key).value)
      lifts.set(lift.key, { key: lift.key, name: lift.name, value: estimate })
  }
  return { sessions: sessionsKnown ? sessions.size : null, sets, volume: sum(volumes),
    rpe: finiteMean(ratings), rpeCount: ratings.length,
    lifts: [...lifts.values()].sort((a, b) => a.key.localeCompare(b.key)) }
}

function nutrition(entries) {
  const unknown = { days: null, kcal: null, protein: null }
  if (!entries) return unknown
  const days = new Map()
  for (const { row, day } of entries) {
    if (isDayReceipt({ meal: typeof row.meal === 'string' ? row.meal.trimStart() : row.meal })) continue
    const kcal = parseInputNumber(row.kcal), protein = parseInputNumber(row.protein)
    if (!id(row.meal) || kcal === null || protein === null) return unknown
    const total = days.get(day) || { kcal: 0, protein: 0 }
    total.kcal += kcal; total.protein += protein
    if (!Number.isFinite(total.kcal) || !Number.isFinite(total.protein)) return unknown
    days.set(day, total)
  }
  return { days: days.size, kcal: finiteMean([...days.values()].map(d => d.kcal)),
    protein: finiteMean([...days.values()].map(d => d.protein)) }
}

function weight(entries) {
  if (!entries) return { days: null, mean: null, conflicts: null }
  const days = new Map()
  for (const { row, day } of entries) {
    const kg = parseInputNumber(row.weight)
    if (!(kg > 0)) return { days: null, mean: null, conflicts: null }
    if (!days.has(day)) days.set(day, new Set())
    days.get(day).add(kg)
  }
  const values = [...days.values()].filter(values => values.size === 1).map(values => [...values][0])
  return { days: values.length, mean: finiteMean(values), conflicts: days.size - values.length }
}

function week(source, athleteId, today) {
  const start = source.start, end = addCalendarDays(start, 6), through = end < today ? end : today
  return { start, end, through, provisional: end >= today,
    training: training(rows(source.training, athleteId, start, through, 'training')),
    nutrition: nutrition(rows(source.nutrition, athleteId, start, through, 'nutrition')),
    weight: weight(rows(source.weight, athleteId, start, through, 'weight')) }
}

export function difference(first, second) {
  return first === null || second === null ? null : safe(second - first)
}

/** Pure, unwired comparison. See ADAPTER.md for the explicit snapshot contract.
 * Two ordered, non-overlapping seven-day periods; today is a civil Copenhagen day.
 * No clock, I/O, feature-flag reads, mutation, advice or inferred completion.
 */
export function compareWeeks(snapshot = {}, today) {
  const { athleteId, first, second } = snapshot ?? {}
  if (!id(athleteId) || !date(today) || !date(first?.start) || !date(second?.start) ||
      !addCalendarDays(first.start, 6) || !addCalendarDays(second.start, 6) ||
      addCalendarDays(first.start, 6) >= second.start || second.start > today)
    return { ready: false, message: 'Vælg to adskilte uger i datoorden for én atlet.' }
  const a = week(first, athleteId, today), b = week(second, athleteId, today)
  const metrics = [
    ['sessions', 'Pas med log', 'pas', a.training.sessions, b.training.sessions],
    ['sets', 'Loggede sæt', 'sæt', a.training.sets, b.training.sets],
    ['volume', 'Volumen (tonnage)', 'kg', a.training.volume, b.training.volume],
    ['rpe', 'RPE-snit', 'RPE', a.training.rpe, b.training.rpe],
    ['mealDays', 'Kostdage med log', 'dage', a.nutrition.days, b.nutrition.days],
    ['kcal', 'Energi pr. logget kostdag', 'kcal', a.nutrition.kcal, b.nutrition.kcal],
    ['protein', 'Protein pr. logget kostdag', 'g', a.nutrition.protein, b.nutrition.protein],
    ['weight', 'Gennemsnit af entydige vejedage', 'kg', a.weight.mean, b.weight.mean],
  ].map(([key, label, unit, first, second]) => ({ key, label, unit, first, second, delta: difference(first, second) }))
  const keys = [...new Set([...a.training.lifts, ...b.training.lifts].map(lift => lift.key))].sort()
  const lifts = keys.map(key => {
    const first = a.training.lifts.find(lift => lift.key === key), second = b.training.lifts.find(lift => lift.key === key)
    const av = first?.value ?? null, bv = second?.value ?? null
    return { key, name: (first ?? second).name, first: av, second: bv, delta: difference(av, bv) }
  })
  return { ready: true, athleteId, first: a, second: b, metrics, lifts }
}
