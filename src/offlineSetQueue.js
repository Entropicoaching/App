// ORDRE 280 · commit 4 — et sæt "Godkendt" uden net må ikke gå tabt. Samme
// mønster som readinessDraft.js/restPause.js: rene funktioner, storage
// sendes eksplicit (default globalThis.localStorage), enhver fejl (privat
// vindue, fuld storage) sluger sig selv i stedet for at vælte log-flowet.
// Én nøgle pr. atlet, med alle ventende sæt i ét objekt (exerciseId+
// setNumber+payload — præcis det logSet() allerede ville have skrevet til
// exercise_logs), så AthleteView kan sende dem igen når forbindelsen er der.
const OFFLINE_SET_QUEUE_PREFIX = 'entropi_offline_sets'

function offlineSetQueueKey(athleteId) {
  return `${OFFLINE_SET_QUEUE_PREFIX}:${athleteId}`
}

function readOfflineSetQueue(athleteId, storage) {
  try {
    if (!storage || !athleteId) return {}
    const raw = storage.getItem(offlineSetQueueKey(athleteId))
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function saveOfflineSet(athleteId, key, entry, storage = globalThis.localStorage) {
  try {
    if (!storage || !athleteId || !key) return false
    const queue = readOfflineSetQueue(athleteId, storage)
    queue[key] = { ...entry, queuedAt: Date.now() }
    storage.setItem(offlineSetQueueKey(athleteId), JSON.stringify(queue))
    return true
  } catch {
    return false
  }
}

export function loadOfflineSets(athleteId, storage = globalThis.localStorage) {
  return readOfflineSetQueue(athleteId, storage)
}

export function clearOfflineSet(athleteId, key, storage = globalThis.localStorage) {
  try {
    if (!storage || !athleteId || !key) return
    const queue = readOfflineSetQueue(athleteId, storage)
    if (!(key in queue)) return
    delete queue[key]
    storage.setItem(offlineSetQueueKey(athleteId), JSON.stringify(queue))
  } catch { /* et fejlet removeItem må ikke vælte sync-flowet */ }
}

export function countOfflineSets(athleteId, storage = globalThis.localStorage) {
  return Object.keys(readOfflineSetQueue(athleteId, storage)).length
}
