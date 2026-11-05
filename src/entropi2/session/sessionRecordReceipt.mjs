import { inputInteger, parseInputNumber } from '../../inputValues.js'

// Display only the host's short-lived receipt for a confirmed set in this session.
// Record detection, expiry and undo remain owned by the existing host.
export function sessionRecordReceipt(p, s) {
  const receipt = p.rekordFejring
  if (p.enabled !== true || p.readOnly === true || p.exerciseLogsError || p.exerciseLogsLoading ||
      !s.open || !receipt || typeof receipt.key !== 'string' ||
      typeof receipt.tekst !== 'string' || !receipt.tekst.trim()) return null
  for (const ex of s.session?.exercises || []) {
    const row = s.logs.find(log => log.exercise_id === ex.id &&
      `${log.exercise_id}_${log.set_number}` === receipt.key &&
      Number.isInteger(log.set_number) && log.set_number > 0 && log.set_number <= ex.sets &&
      !log.skipped && !log._optimistic && (log.athlete_id == null || log.athlete_id === p.athleteId))
    if (!row) continue
    const weight = parseInputNumber(row.weight), reps = inputInteger(row.reps_completed)
    if (weight == null || reps == null || reps < 1 || receipt.id !== `${receipt.key}:${weight}:${reps}`) return null
    return { key: receipt.key, text: `${ex.name} · Sæt ${row.set_number}: ${receipt.tekst}` }
  }
  return null
}
