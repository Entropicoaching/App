import { calendarDay, addCalendarDays } from '../../../calendarDate.js'

const validId = value => typeof value === 'string' && value.trim().length > 0
const day = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  ? calendarDay(value) : null
const positive = value => typeof value === 'number' && Number.isFinite(value) && value > 0
const mean = values => values.reduce((sum, value) => sum + value / values.length, 0)

// A ready source promises a complete, confirmed snapshot for the stated period.
// Each row must still carry the exact athlete_id. No IO, clock or mutation.
function sourceRows(source, athleteId, start, end) {
  if (!start || !validId(athleteId)) return { state: 'unavailable', rows: [] }
  if (source?.state !== 'ready' || !Array.isArray(source.rows)) {
    return { state: source?.state === 'loading' ? 'loading'
      : source?.state === 'error' ? 'error' : 'unavailable', rows: [] }
  }
  const rows = source.rows.filter(row => row && row.athlete_id === athleteId &&
    row._optimistic !== true && row.pending !== true && day(row.date) &&
    row.date >= start && row.date <= end)
  return { state: 'ready', rows }
}

// Repeated identical observations count once; conflicting identities/dates are
// omitted entirely, so input order can never determine the displayed result.
function unique(rows, key, signature) {
  const groups = new Map()
  for (const row of rows) {
    const k = key(row)
    if (!k) continue
    const group = groups.get(k) || new Map()
    group.set(JSON.stringify(signature(row)), row)
    groups.set(k, group)
  }
  return [...groups.values()].filter(group => group.size === 1).map(group => [...group.values()][0])
}

export function mineDataModel({ athleteId, today, sessions, records, nutritionDays, weights } = {}) {
  const end = day(today), start = end ? addCalendarDays(end, -27) : null
  const read = source => sourceRows(source, athleteId, start, end)
  const sessionSource = read(sessions), recordSource = read(records)
  const nutritionSource = read(nutritionDays), weightSource = read(weights)
  const completed = unique(sessionSource.rows, r => validId(r.id) ? r.id : null,
    r => [r.date, r.status]).filter(r => r.status === 'completed').length
  const sets = unique(recordSource.rows, r => validId(r.id) ? r.id : null,
    r => [r.date, r.exerciseId, r.exercise, r.weightKg, r.reps])
    .filter(r => validId(r.exerciseId) && validId(r.exercise) && positive(r.weightKg) &&
      Number.isSafeInteger(r.reps) && r.reps > 0)
  const best = new Map()
  for (const row of sets) {
    const prev = best.get(row.exerciseId)
    if (!prev || row.weightKg > prev.weightKg ||
      (row.weightKg === prev.weightKg && row.reps > prev.reps) ||
      (row.weightKg === prev.weightKg && row.reps === prev.reps &&
        (row.date < prev.date || (row.date === prev.date && row.id < prev.id)))) {
      best.set(row.exerciseId, row)
    }
  }
  const lifts = [...best.values()].sort((a, b) => a.exerciseId.localeCompare(b.exerciseId))
    .map(r => ({ exerciseId: r.exerciseId, exercise: r.exercise, date: r.date,
      weightKg: r.weightKg, reps: r.reps }))
  const days = unique(nutritionSource.rows, r => r.date, r => [r.goalMet])
  const assessed = days.filter(r => typeof r.goalMet === 'boolean')
  const weightDays = unique(weightSource.rows, r => r.date, r => [r.kg])
    .filter(r => positive(r.kg))
  const weeks = start ? Array.from({ length: 4 }, (_, i) => {
    const from = addCalendarDays(start, i * 7), to = addCalendarDays(from, 6)
    const values = weightDays.filter(r => r.date >= from && r.date <= to).map(r => r.kg)
    return { start: from, end: to, count: values.length, kg: values.length ? mean(values) : null }
  }) : []
  const observed = weeks.filter(w => w.kg !== null)
  const delta = observed.length >= 2 ? observed.at(-1).kg - observed[0].kg : null
  return {
    start, end,
    sessions: { state: sessionSource.state, completed: sessionSource.state === 'ready' ? completed : null },
    records: { state: recordSource.state, lifts },
    nutrition: { state: nutritionSource.state, loggedDays: days.length,
      assessedDays: assessed.length, unknownDays: days.length - assessed.length,
      goalDays: nutritionSource.state === 'ready' ? assessed.filter(r => r.goalMet).length : null },
    weight: { state: weightSource.state, weeks, recordedDays: weightDays.length,
      deltaKg: delta, from: observed[0]?.start ?? null, to: observed.at(-1)?.start ?? null },
  }
}
