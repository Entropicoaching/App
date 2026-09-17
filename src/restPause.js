// ORDRE 263 · commit 2 — pausetimeren der starter automatisk når et sæt
// logges. Kun starttidspunkt + varighed persisteres (samme
// tidsstempel-princip som restTimer.js's remainingSeconds — ingen kørende
// nedtælling at miste), i localStorage (samme mønster som
// readinessDraft.js: storage sendes eksplicit, default globalThis.localStorage,
// enhver fejl sluger sig selv), så pausen fortsætter korrekt selv om
// skærmen slukkes eller fanen lukkes og genåbnes midt i den.
const REST_PAUSE_PREFIX = 'entropi_rest_pause'

function restPauseKey(athleteId) {
  return `${REST_PAUSE_PREFIX}:${athleteId}`
}

export function startRestPause(athleteId, durationSeconds, label, storage = globalThis.localStorage) {
  try {
    if (!storage || !athleteId || !durationSeconds) return false
    storage.setItem(restPauseKey(athleteId), JSON.stringify({ startedAt: Date.now(), durationSeconds, label: label || null }))
    return true
  } catch {
    return false
  }
}

export function loadRestPause(athleteId, storage = globalThis.localStorage) {
  try {
    if (!storage || !athleteId) return null
    const raw = storage.getItem(restPauseKey(athleteId))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed.startedAt !== 'number' || typeof parsed.durationSeconds !== 'number') return null
    return parsed
  } catch {
    return null
  }
}

export function clearRestPause(athleteId, storage = globalThis.localStorage) {
  try {
    if (!storage || !athleteId) return
    storage.removeItem(restPauseKey(athleteId))
  } catch { /* et fejlet removeItem må ikke vælte logSet-flowet */ }
}
