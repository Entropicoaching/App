import { saveOfflineSet, loadOfflineSets, clearOfflineSetIfSame, newSetClientId, parkOfflineSet, orderedOfflineSets } from '../../offlineSetQueue.js'
import { seemsOffline, withSlowNetCutoff } from '../../offlineSession.js'

// The existing athlete queue is the only outbox. Never enumerate storage or
// read another athlete's namespace; even obtaining localStorage can throw.
export function sessionStorage() {
  try { return globalThis.localStorage } catch { return null }
}
const rowId = result => result?.data?.id || result?.data?.[0]?.id
const refused = error => /^(PGRST|22|23|28|42|P0)/.test(String(error?.code || '')) || /jwt/i.test(String(error?.message || ''))
const confirmedListeners = new Set()
// The session host can reuse a confirmed row without another history read.
export function subscribeSessionSetConfirmed(listener) {
  confirmedListeners.add(listener)
  return () => confirmedListeners.delete(listener)
}

// send uses the existing serialised exercise_logs writer, not a second client.
// Its client id and original approval time survive reloads and lost replies.
export async function saveSessionSet({ athleteId, exerciseId, setNumber, payload,
  exerciseName, realId, knownClientId, send, confirm, notify = () => {},
  storage = sessionStorage(), offline = seemsOffline }) {
  if (!athleteId || !exerciseId || !Number.isInteger(setNumber) || setNumber < 1) return { phase: 'error' }
  const key = `${exerciseId}_${setNumber}`
  const previous = loadOfflineSets(athleteId, storage)[key]
  if (previous?.op === 'delete') return { phase: 'error' }
  const clientId = previous?.clientId || knownClientId || newSetClientId()
  // Persisted payloads are data, never an authority to change row ownership.
  const fields = ['logged_at', 'weight', 'reps_completed', 'note', 'rpe_actual', 'rpe_planned', 'skipped']
  payload = Object.fromEntries(fields.filter(name => Object.hasOwn(payload || {}, name)).map(name => [name, payload[name]]))
  payload.logged_at = previous?.payload?.logged_at || payload.logged_at
  const entry = { exerciseId, setNumber, payload, clientId, exerciseName, sessionOnly: true }
  const queued = saveOfflineSet(athleteId, key, entry, storage)
  notify()
  if (offline()) return { phase: queued ? 'queued' : 'error', storageFailed: !queued }
  // Direct approval must not overtake an older set (or undo tombstone).
  const head = orderedOfflineSets(athleteId, storage)[0]
  if (head && head[0] !== key) return { phase: queued ? 'queued' : 'error', storageFailed: !queued }

  const accepted = result => {
    const id = rowId(result)
    if (result?.error || !id) return false
    clearOfflineSetIfSame(athleteId, key, entry, storage)
    // No optimistic row or saved signal: the server's row id is required.
    const row = { id, athlete_id: athleteId, exercise_id: exerciseId, set_number: setNumber, ...payload, _optimistic: false }
    confirm(row)
    for (const listener of confirmedListeners) {
      // A presentation failure must never turn a confirmed save into an error.
      try { listener(row) } catch { /* The saved row remains the source of truth. */ }
    }
    notify()
    return true
  }
  let result
  try {
    const write = send(key, exerciseId, setNumber, payload, realId, clientId, { hasQueue: queued, lookupFirst: !realId })
    const settled = Promise.resolve(write).catch(error => ({ error }))
    result = await withSlowNetCutoff(settled, undefined, { startWhen: write.sent })
    if (result?.error?.code === 'SLOW_NET') {
      // The original insert can still arrive. Both paths retain the same id.
      void settled.then(late => { accepted(late) })
    }
  } catch (error) { result = { error } }
  if (accepted(result)) return { phase: 'saved' }
  if (queued && refused(result?.error)) {
    const parked = parkOfflineSet(athleteId, key, entry, String(result.error.code || 'SERVER'), storage)
    notify()
    return { phase: parked ? 'parked' : 'queued' }
  }
  notify()
  return { phase: queued ? 'queued' : 'error', storageFailed: !queued }
}
