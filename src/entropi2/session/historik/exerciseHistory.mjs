import { estimatedOneRepMax, erTungtSaet, erDeloadLog } from '../../../exerciseProgress.js'

const decimal = new Intl.NumberFormat('da-DK', { maximumFractionDigits: 10 })
const dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Copenhagen', year: 'numeric', month: '2-digit', day: '2-digit' })
const dateFormat = new Intl.DateTimeFormat('da-DK', { timeZone: 'Europe/Copenhagen', year: 'numeric', month: 'short', day: 'numeric' })
export const historyNumber = value => decimal.format(value)
export const historyEstimate = value => new Intl.NumberFormat('da-DK', { maximumFractionDigits: 1 }).format(value)
const number = value => {
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^\d+(?:[.,]\d+)?$/.test(value.trim()))) return null
  const n = Number(String(value).replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n : null
}
function timestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null
  if (Number(value.slice(11, 13)) > 23 || Number(value.slice(14, 16)) > 59 || Number(value.slice(17, 19)) > 59) return null
  const day = value.slice(0, 10), date = Date.parse(day + 'T00:00:00Z'), at = Date.parse(value)
  return Number.isFinite(at) && Number.isFinite(date) && new Date(date).toISOString().slice(0, 10) === day ? at : null
}

// Pure read model. Caller supplies confirmed logs for ONE athlete and
// exact exercise ID, explicit clock, pending/parked keys and load error. No name
// matching across program IDs. Missing athlete_id is rejected, never inferred.
// Heavy = existing <=8 reps rule, excluding light set names and deload blocks.
// Curve = best Epley estimate per Copenhagen day among the latest eight sets.
export function exerciseHistory(input = {}) {
  if (input.enabled !== true) return { status: 'off' }
  const { athleteId, exerciseId, exerciseName, logs, now, error, pendingSyncKeys = [], parkedSets = [] } = input
  const failure = { status: 'error', message: 'Historikken kunne ikke vises. Prøv igen, når data er hentet.' }
  if (error || typeof athleteId !== 'string' || !athleteId.trim() || typeof exerciseId !== 'string' || !exerciseId.trim() ||
      typeof exerciseName !== 'string' || !exerciseName.trim() || !Array.isArray(logs) || !Number.isFinite(now) ||
      !Array.isArray(pendingSyncKeys) || !Array.isArray(parkedSets)) return failure
  if (input.loading === true) return { status: 'loading' }
  const sets = [], seen = new Set()
  let omitted = 0
  for (const row of logs) {
    if (!row || row.athlete_id !== athleteId || row.exercise_id !== exerciseId) continue
    const key = `${exerciseId}_${row.set_number}`
    if (row.skipped || row._optimistic || pendingSyncKeys.includes(key) ||
        parkedSets.some(s => s?.exerciseId === exerciseId && s.setNumber === row.set_number)) continue
    const weight = number(row.weight), reps = number(row.reps_completed)
    const missingRpe = row.rpe_actual == null || row.rpe_actual === ''
    const rpe = missingRpe ? null : number(row.rpe_actual)
    const at = timestamp(row.logged_at), name = row.exercises?.name ?? exerciseName
    if (at == null || at > now || !(weight > 0) || !Number.isSafeInteger(reps) || reps < 1 ||
        !Number.isSafeInteger(row.set_number) || row.set_number < 1 ||
        (!missingRpe && (rpe == null || rpe > 10))) { omitted++; continue }
    if (!erTungtSaet(name, reps) || erDeloadLog(row)) continue
    const e1rm = estimatedOneRepMax(weight, reps)
    if (!(e1rm > 0)) { omitted++; continue }
    // Same persisted ID or identical event is never counted twice.
    const identity = typeof row.id === 'string' && row.id ? row.id : JSON.stringify([at, row.set_number, weight, reps, rpe])
    if (seen.has(identity)) continue
    seen.add(identity)
    sets.push({ at, weight, reps, rpe, setNumber: row.set_number, e1rm,
      day: dayFormat.format(at), date: dateFormat.format(at) })
  }
  sets.sort((a, b) => b.at - a.at || b.setNumber - a.setNumber || b.weight - a.weight || b.reps - a.reps)
  const recent = sets.slice(0, 8), best = new Map()
  for (const set of recent) {
    const previous = best.get(set.day)
    if (!previous || set.e1rm > previous.e1rm) best.set(set.day, set)
  }
  const curve = [...best.values()].sort((a, b) => a.day.localeCompare(b.day))
    .map(({ day, date, e1rm }) => ({ day, date, e1rm }))
  return { status: recent.length ? 'ready' : 'empty', sets: recent, curve, omitted }
}
