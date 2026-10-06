// Only plain numeric prescriptions can become editable repetition counts.
// Text such as AMRAP, durations and per-side instructions keeps its display.
export function fixedRepsEntry(reps) {
  const raw = String(reps ?? '').trim()
  return /^\d+$/.test(raw) ? raw : null
}
