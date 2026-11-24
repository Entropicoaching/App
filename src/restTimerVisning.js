// Ordre 2033f (Marc 23. nov.: nogle atleter spoerger, om timeren kan vaelges skjult, da den "stresser" dem).
// Atletens eget valg: vis eller skjul pausetimeren i dagens pas. Huskes pr. atlet i localStorage
// (samme moenster som restPause.js: storage sendes eksplicit, default globalThis.localStorage,
// enhver fejl sluger sig selv). Ingen migration. Standard er som i dag: timeren vises.
// Pausen registreres stadig (startRestPause og passets eget ur koerer uaendret); kun visningen skjules.
const REST_TIMER_HIDDEN_PREFIX = 'entropi_rest_timer_skjult'

function restTimerHiddenKey(athleteId) {
  return `${REST_TIMER_HIDDEN_PREFIX}:${athleteId}`
}

export function isRestTimerHidden(athleteId, storage = globalThis.localStorage) {
  try {
    if (!storage || !athleteId) return false
    return storage.getItem(restTimerHiddenKey(athleteId)) === '1'
  } catch {
    return false
  }
}

export function setRestTimerHidden(athleteId, hidden, storage = globalThis.localStorage) {
  try {
    if (!storage || !athleteId) return false
    if (hidden) storage.setItem(restTimerHiddenKey(athleteId), '1')
    else storage.removeItem(restTimerHiddenKey(athleteId))
    return true
  } catch {
    return false
  }
}
