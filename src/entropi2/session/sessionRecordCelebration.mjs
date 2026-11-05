import { bygGrundlag, findRekord, rekordTekst, ugensSaet } from '../../athlete/rekorder.js'
import { erDeloadBlok } from '../../exerciseProgress.js'
import { subscribeSessionSetConfirmed } from './sessionSetSave.mjs'

// Same record rules and already loaded index as "Dine rekorder". Only the
// session writer's server acknowledgement can enter here; loading logs cannot.
export function confirmedSessionRecord(p, row, logs = p.exerciseLogs) {
  const athleteId = p.athlete?.id, week = p.currentWeek
  if (p.enabled !== true || p.readOnly === true || typeof p.onLogSet !== 'function' ||
      typeof p.setLogInputs !== 'function' || !athleteId || row?.athlete_id !== athleteId ||
      !row.id || row._optimistic || row.skipped || !p.rekordGrundlagFoer ||
      p.exerciseLogsError || p.exerciseLogsLoading || p.programError || p.offlineSnapshotAt != null ||
      !p.allWeeks?.some(w => w.id === week?.id) ||
      (week?.athlete_id != null && week.athlete_id !== athleteId)) return null
  const ex = week?.sessions?.flatMap(s => s.exercises || []).find(e => e.id === row.exercise_id)
  if (!ex || !Number.isInteger(row.set_number) || row.set_number < 1 || row.set_number > ex.sets) return null
  const key = `${row.exercise_id}_${row.set_number}`
  const confirmed = (logs || []).filter(l => l.id && !l._optimistic &&
    (l.athlete_id == null || l.athlete_id === athleteId) &&
    !(p.pendingSyncKeys || []).includes(`${l.exercise_id}_${l.set_number}`) &&
    !(p.parkedSets || []).some(s => s.exerciseId === l.exercise_id && s.setNumber === l.set_number))
  const basis = bygGrundlag(ugensSaet(confirmed, week, p.allWeeks, key), p.rekordGrundlagFoer)
  const record = findRekord(basis, { navn: ex.name, weight: row.weight, reps: row.reps_completed,
    deload: erDeloadBlok(week.block_name) })
  return record ? { key, id: `${key}:${row.weight}:${row.reps_completed}`, tekst: rekordTekst(record) } : null
}

export function subscribeSessionRecordCelebrations(latest, clock = globalThis) {
  const timers = new Map(), recent = new Map()
  let scope, lastLogs
  const unsubscribe = subscribeSessionSetConfirmed(row => {
    const p = latest(), nextScope = `${p.athlete?.id}:${p.currentWeek?.id}`
    // Include acknowledgements batched before React has refreshed the props.
    if (scope !== nextScope || lastLogs !== p.exerciseLogs) {
      recent.clear(); scope = nextScope; lastLogs = p.exerciseLogs
    }
    const key = `${row.exercise_id}_${row.set_number}`
    const logs = [...(p.exerciseLogs || []).filter(l => !recent.has(`${l.exercise_id}_${l.set_number}`)), ...recent.values()]
    const receipt = confirmedSessionRecord({ ...p,
      pendingSyncKeys: (p.pendingSyncKeys || []).filter(key => !recent.has(key)),
      parkedSets: (p.parkedSets || []).filter(s => !recent.has(`${s.exerciseId}_${s.setNumber}`)),
    }, row, logs)
    if (row.athlete_id === p.athlete?.id) recent.set(key, row)
    if (!receipt || typeof p.setRekordFejring !== 'function' || !p.fejredeRef?.current ||
        p.fejredeRef.current.has(receipt.id)) return
    p.fejredeRef.current.add(receipt.id)
    p.setRekordFejring(receipt)
    if (timers.has(receipt.id)) clock.clearTimeout(timers.get(receipt.id).timer)
    const clear = () => p.setRekordFejring(current => current?.id === receipt.id ? null : current)
    timers.set(receipt.id, { clear, timer: clock.setTimeout(() => {
      clear(); timers.delete(receipt.id)
    }, 5000) })
  })
  return () => {
    unsubscribe()
    for (const { timer, clear } of timers.values()) { clock.clearTimeout(timer); clear() }
    timers.clear(); recent.clear()
  }
}
