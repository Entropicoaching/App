// Pure summary of the selected session. No storage or new host contracts.
const number = value => {
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^\d+(?:[.,]\d+)?$/.test(value.trim()))) return null
  const n = Number(String(value).replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n : null
}
const decimal = new Intl.NumberFormat('da-DK', { maximumFractionDigits: 10 })
const calendar = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Copenhagen', year: 'numeric', month: '2-digit', day: '2-digit' })
function isToday(value, now) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return false
  const at = Date.parse(value), day = Date.parse(value.slice(0, 10) + 'T00:00:00Z')
  return Number.isFinite(at) && Number.isFinite(day) && new Date(day).toISOString().slice(0, 10) === value.slice(0, 10) &&
    at <= now && calendar.format(at) === calendar.format(now)
}
export function sessionSummary(session, logs, p, now) {
  let done = 0, total = 0, highestRpe = null
  const exercises = (session?.exercises || []).map(ex => {
    const count = Number.isSafeInteger(ex.sets) && ex.sets > 0 ? ex.sets : 0
    let completed = 0, heaviest = null
    for (let set = 1; set <= count; set++) {
      const key = `${ex.id}_${set}`
      if ((p.pendingSyncKeys || []).includes(key) || (p.parkedSets || []).some(s => s.exerciseId === ex.id && s.setNumber === set)) continue
      // Count a planned slot once, following the existing skipped-set contract.
      const row = (logs || []).find(l => l.exercise_id === ex.id && l.set_number === set && !l._optimistic &&
        (l.athlete_id == null || l.athlete_id === p.athleteId))
      if (!row) continue
      completed++
      if (row.skipped || !Number.isFinite(now) || !isToday(row.logged_at, now)) continue
      const rpe = number(row.rpe_actual), weight = number(row.weight), reps = number(row.reps_completed)
      if (rpe != null && rpe <= 10) highestRpe = Math.max(highestRpe ?? 0, rpe)
      if (weight != null && Number.isSafeInteger(reps) && reps > 0 && (!heaviest || weight > heaviest.weight))
        heaviest = { weight, reps }
    }
    done += completed; total += count
    return { name: ex.name, total: count, done: completed, missing: count - completed,
      heaviest: heaviest ? `${decimal.format(heaviest.weight)} kg × ${heaviest.reps}` : null }
  })
  return { done, total, exercises, highestRpe: highestRpe == null ? null : decimal.format(highestRpe) }
}
