const number = value => {
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^\d+(?:\.\d+)?$/.test(value.trim()))) return null
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : null
}
const decimal = new Intl.NumberFormat('da-DK', { maximumFractionDigits: 10 })
const date = new Intl.DateTimeFormat('da-DK', { day: 'numeric', month: 'short', timeZone: 'Europe/Copenhagen' })

// Only already supplied exerciseLogs; IDs are deliberately not matched by name.
// Rows without athlete_id follow the controller's existing athlete-scoped contract.
// now is explicit so lookup and calendar boundaries are deterministic and pure.
export function lastSetLine(p, exerciseId, now) {
  if (!p.athleteId || !exerciseId || !Number.isFinite(now)) return null
  let latest = null
  for (const row of p.exerciseLogs || []) {
    if (!row || row.exercise_id !== exerciseId || row.skipped || row._optimistic ||
        (row.athlete_id != null && row.athlete_id !== p.athleteId)) continue
    const key = `${row.exercise_id}_${row.set_number}`
    if ((p.pendingSyncKeys || []).includes(key) ||
        (p.parkedSets || []).some(s => s.exerciseId === exerciseId && s.setNumber === row.set_number)) continue
    // Require a timestamp with an explicit offset; never interpret an ambiguous local date.
    if (typeof row.logged_at !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(row.logged_at)) continue
    const calendar = row.logged_at.slice(0, 10)
    const day = Date.parse(`${calendar}T00:00:00Z`)
    if (!Number.isFinite(day) || new Date(day).toISOString().slice(0, 10) !== calendar) continue
    const at = Date.parse(row.logged_at), weight = number(row.weight), reps = number(row.reps_completed)
    const rpe = row.rpe_actual == null || row.rpe_actual === '' ? null : number(row.rpe_actual)
    if (!Number.isFinite(at) || at > now || weight == null || !Number.isSafeInteger(reps) || reps < 1 ||
        (row.rpe_actual != null && row.rpe_actual !== '' && (rpe == null || rpe > 10))) continue
    if (!latest || at > latest.at || (at === latest.at && Number(row.set_number) > Number(latest.row.set_number)))
      latest = { row, at, weight, reps, rpe }
  }
  if (!latest) return null
  const { at, weight, reps, rpe } = latest
  return `Sidst: ${decimal.format(weight)} kg × ${reps} · RPE ${rpe == null ? 'ikke angivet' : decimal.format(rpe)} (${date.format(at)})`
}
