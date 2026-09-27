// ORDRE 397 — øjebliksbillede af Dagens pas til brug uden net (se
// docs/OFFLINE-PAS.md). Samme mønster som offlineSetQueue.js: rene
// funktioner, storage som parameter, enhver fejl sluger sig selv.
//
// Nøglet på auth-bruger-id (det eneste appen kender, før atletrækken er
// hentet). Indhold: atletrækken, den aktive uge (sessioner + øvelser) og ugens
// sæt-logs fra serveren. Køens ventende sæt lægges ovenpå ved brug
// (overlayQueuedSets), ikke her. Ryddes ved log ud (clearOfflineSnapshots).
const PREFIX = 'entropi_offline_pas'
// ORDRE 450: rekord-indekset (rekordIndeks.js) ryddes sammen med øjebliksbilledet.
export const REKORD_INDEKS_PREFIX = 'entropi_rekord_indeks'

function snapshotKey(userId) {
  return `${PREFIX}:${userId}`
}

export function loadOfflineSnapshot(userId, storage = globalThis.localStorage) {
  try {
    if (!storage || !userId) return null
    const raw = storage.getItem(snapshotKey(userId))
    const parsed = raw ? JSON.parse(raw) : null
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

// patch: { athlete } | { week } | { logs, logsWeekId } | { historik } (ORDRE 456:
// de seneste sæt pr. øvelse, som fetchExerciseHistory). Skifter ugen, gælder
// de gamle logs ikke længere.
export function saveOfflineSnapshot(userId, patch, storage = globalThis.localStorage, now = Date.now()) {
  try {
    if (!storage || !userId || !patch) return false
    const prev = loadOfflineSnapshot(userId, storage) || {}
    const next = { ...prev, ...patch, savedAt: now }
    if (patch.week && prev.week?.id !== patch.week.id && !('logs' in patch)) {
      next.logs = []
      next.logsWeekId = patch.week.id
    }
    storage.setItem(snapshotKey(userId), JSON.stringify(next))
    return true
  } catch {
    return false
  }
}

export function snapshotLogsForWeek(snapshot) {
  if (!snapshot?.week) return []
  return snapshot.logsWeekId === snapshot.week.id ? (snapshot.logs || []) : []
}

export function clearOfflineSnapshots(storage = globalThis.localStorage) {
  try {
    if (!storage) return
    const keys = Array.from({ length: storage.length }, (_, i) => storage.key(i))
    for (const k of keys) if (k && (k.startsWith(`${PREFIX}:`) || k.startsWith(`${REKORD_INDEKS_PREFIX}:`))) storage.removeItem(k)
  } catch { /* log ud må aldrig vælte på oprydning */ }
}
