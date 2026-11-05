import { inputInteger, parseInputNumber } from '../../inputValues.js'

// Both the live announcement and the local archive use today's confirmed values.
export function sessionRecordReceipt(p, s, receipt = p.rekordFejring) {
  if (p.enabled !== true || p.readOnly === true || p.exerciseLogsError || p.exerciseLogsLoading ||
      !s.open || !receipt || typeof receipt.key !== 'string' ||
      typeof receipt.tekst !== 'string' || !receipt.tekst.trim()) return null
  if (receipt.athleteId != null && receipt.athleteId !== p.athleteId ||
      receipt.weekId != null && receipt.weekId !== p.currentWeek?.id) return null
  for (const ex of s.session?.exercises || []) {
    const row = s.logs.find(log => log.exercise_id === ex.id &&
      `${log.exercise_id}_${log.set_number}` === receipt.key &&
      Number.isInteger(log.set_number) && log.set_number > 0 && log.set_number <= ex.sets &&
      !log.skipped && !log._optimistic && (log.athlete_id == null || log.athlete_id === p.athleteId))
    if (!row) continue
    if (receipt.rowId != null && (row.id !== receipt.rowId || row.athlete_id !== p.athleteId)) return null
    const weight = parseInputNumber(row.weight), reps = inputInteger(row.reps_completed)
    if (weight == null || reps == null || reps < 1 || receipt.id !== `${receipt.key}:${weight}:${reps}`) return null
    return { key: receipt.key, text: `${ex.name} · Sæt ${row.set_number}: ${receipt.tekst}` }
  }
  return null
}

// Owned by one mounted HomeSession. Never persisted or rebuilt from history.
export function createSessionRecordReceipts() {
  const receipts = new Map()
  let scope
  const resetScope = p => {
    const next = p.enabled === true ? JSON.stringify([p.athlete?.id, p.currentWeek?.id]) : null
    if (next !== scope) { receipts.clear(); scope = next }
  }
  return {
    remember(p, receipt) {
      resetScope(p)
      if (p.enabled === true && receipt.athleteId === p.athlete?.id && receipt.weekId === p.currentWeek?.id)
        receipts.set(receipt.key, receipt)
    },
    read(p) {
      resetScope(p)
      if (p.enabled !== true) return []
      const session = { exercises: p.currentWeek?.sessions?.flatMap(s => s.exercises || []) || [] }
      const logs = (p.exerciseLogs || []).filter(row =>
        !(p.pendingSyncKeys || []).includes(`${row.exercise_id}_${row.set_number}`) &&
        !(p.parkedSets || []).some(set => set.exerciseId === row.exercise_id && set.setNumber === row.set_number))
      const props = { ...p, athleteId: p.athlete?.id }
      // A temporary read failure hides all receipts; an authoritative change
      // removes its old receipt so restoring old values cannot resurrect it.
      if (p.exerciseLogsError || p.exerciseLogsLoading) return []
      for (const [key, receipt] of receipts)
        if (!sessionRecordReceipt(props, { open: true, session, logs }, receipt)) receipts.delete(key)
      return [...receipts.values()]
    },
    clear() { receipts.clear(); scope = undefined },
  }
}
