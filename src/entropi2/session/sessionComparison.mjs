const calendar = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Copenhagen', year: 'numeric', month: '2-digit', day: '2-digit' })
const number = value => {
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^\d+(?:[.,]\d+)?$/.test(value.trim()))) return null
  const n = Number(String(value).replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n : null
}
function timestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value)) return null
  const day = value.slice(0, 10), at = Date.parse(value), date = Date.parse(`${day}T00:00:00Z`)
  return Number.isFinite(at) && Number.isFinite(date) && new Date(date).toISOString().slice(0, 10) === day ? at : null
}
function metrics(day) {
  if (!day || day.invalid || !day.slots.size) return null
  let volume = 0, heaviest = null
  for (const set of day.slots.values()) {
    volume += set.weight * set.reps
    if (!Number.isFinite(volume) || volume > Number.MAX_SAFE_INTEGER) return null
    if (!heaviest || set.weight > heaviest.weight || (set.weight === heaviest.weight && set.reps > heaviest.reps)) heaviest = set
  }
  return { count: day.slots.size, volume, heaviest: { ...heaviest } }
}

// Read only the supplied confirmed snapshot. Exact exercise IDs, never names or
// inferred links between program weeks. A Copenhagen day is the available
// occurrence boundary: same-day efforts cannot establish a separate previous run.
export function sessionComparisons(session, logs, p, now, confirmedCurrentLogs = logs) {
  if (p?.enabled !== true) return []
  if (!p.athleteId || p.exerciseLogsError || p.exerciseLogsLoading || !Number.isFinite(now) ||
      !Array.isArray(logs) || !Array.isArray(confirmedCurrentLogs) || !Array.isArray(session?.exercises)) return []
  const today = calendar.format(now), comparisons = []
  // Host queue/parked keys describe today's slots. Qualify them with that day
  // before matching so an identical slot on a previous day remains evidence.
  const unavailable = new Set((p.pendingSyncKeys || []).map(key => `${today}:${key}`))
  for (const set of p.parkedSets || [])
    if (set) unavailable.add(`${today}:${set.exerciseId}_${set.setNumber}`)
  const confirmedToday = new Set(confirmedCurrentLogs)
  for (const ex of session.exercises) {
    if (!ex?.id || !Number.isSafeInteger(ex.sets) || ex.sets < 1 ||
        session.exercises.filter(other => other?.id === ex.id).length !== 1) continue
    const days = new Map()
    for (const row of logs) {
      if (!row || row.athlete_id !== p.athleteId || row.exercise_id !== ex.id || row._optimistic ||
          (row.skipped != null && typeof row.skipped !== 'boolean')) continue
      const at = timestamp(row.logged_at)
      if (at == null || at > now) continue
      const date = calendar.format(at)
      const key = `${date}:${ex.id}_${row.set_number}`
      if (unavailable.has(key)) continue
      // The controller also excludes in-flight saves. Apply its confirmed
      // snapshot only to today; it has no date in its own slot filtering.
      if (date === today && (row.set_number > ex.sets || !confirmedToday.has(row))) continue
      if (!days.has(date)) days.set(date, { slots: new Map(), skipped: new Set(), invalid: false })
      const day = days.get(date), weight = number(row.weight), reps = number(row.reps_completed)
      if (row.skipped) {
        day.skipped.add(row.set_number)
        if (day.slots.has(row.set_number)) day.invalid = true
        continue
      }
      if (!Number.isSafeInteger(row.set_number) || row.set_number < 1 || weight == null ||
          !Number.isSafeInteger(reps) || reps < 1) { day.invalid = true; continue }
      const previous = day.slots.get(row.set_number)
      if (day.skipped.has(row.set_number) || (previous && (previous.weight !== weight || previous.reps !== reps))) day.invalid = true
      day.slots.set(row.set_number, { weight, reps })
    }
    const previousDate = [...days.keys()].filter(date => date < today && (days.get(date).slots.size || days.get(date).invalid)).sort().at(-1)
    const before = metrics(days.get(previousDate)), current = metrics(days.get(today))
    if (before && current) comparisons.push({ exerciseId: ex.id, name: ex.name, previousDate, before, current })
  }
  return comparisons
}
