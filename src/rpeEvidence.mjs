import { dataEnoughEnabled } from './dataEnough.mjs'
// Provenance travels in the existing note field, so it also survives offline
// replay and a read on the coach's device. No new database column is used.
const marker = /\n?\[appData2-rpe-v1:([^\n]+)\]$/
export function chooseRpeInput(state, key, value, fallback = {}) {
  return { ...state, [key]: { ...(state[key] || fallback), rpe: String(value),
    ...(dataEnoughEnabled() ? { rpe_source: 'athlete' } : {}) } }
}
export const visibleRpeNote = note => String(note || '').replace(marker, '')
export function rpeNote(note, row, chosen) {
  const text = String(note || '').replace(marker, '')
  if (!chosen) return text || null
  return text + '\n[appData2-rpe-v1:' + JSON.stringify([
    row.rpe_actual, row.weight, row.reps_completed, row.logged_at,
  ]) + ']'
}
export function rpeOrigin(row) {
  if (row?.rpe_source) return row.rpe_source
  const match = String(row?.note || '').match(marker)
  if (!match) return row?.rpe_source
  try {
    const proof = JSON.parse(match[1])
    const instant = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? Date.parse(value) : NaN
    return Array.isArray(proof) && proof.length === 4 && proof[0] === row.rpe_actual &&
      proof[1] === row.weight && proof[2] === row.reps_completed &&
      (proof[3] === row.logged_at || (Number.isFinite(instant(proof[3])) && instant(proof[3]) === instant(row.logged_at))) ? 'athlete' : undefined
  } catch { return undefined }
}

// Ordre 1568: RPE med eet tryk i dagens pas. Udgangspunkt: valgt RPE, ellers
// planlagt, ellers 8; nærmeste halve tal inden for 5,5 til 10.
const rpeTal = v => { const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : null }
export function stepRpe(valgt, planlagt, delta) {
  const start = rpeTal(valgt) ?? rpeTal(planlagt) ?? 8
  return Math.min(10, Math.max(5.5, Math.round((start + delta) * 2) / 2))
}
// Samme skrivning som vælgeren: chooseRpeInput.
export const stepRpeInInputs = (state, key, input, planlagt, delta) =>
  chooseRpeInput(state, key, stepRpe(input.rpe, planlagt, delta), input)
