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
    // ORDRE 397: rækkefølgen er hvornår sættet FØRST blev logget; en "ret"
    // flytter det ikke bagerst. clientId (se newSetClientId) arves, så et
    // genforsøg altid sender samme række-id.
    const prev = queue[key]
    queue[key] = {
      ...entry,
      clientId: entry.clientId || prev?.clientId,
      queuedAt: prev?.queuedAt || Date.now(),
    }
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
  // ORDRE 397: en ventende sletning (fortryd uden net) er ikke et "sæt gemt
  // lokalt" for atleten.
  return Object.values(readOfflineSetQueue(athleteId, storage)).filter(e => e?.op !== 'delete').length
}

// ORDRE 397: fjern kun posten, hvis den stadig er den der blev sendt. Rettede
// atleten sættet (eller fortrød det) mens afsendelsen var undervejs, ligger
// den nyere post i køen og må ikke forsvinde med den gamle.
export function clearOfflineSetIfSame(athleteId, key, sent, storage = globalThis.localStorage) {
  try {
    if (!storage || !athleteId || !key || !sent) return
    const current = readOfflineSetQueue(athleteId, storage)[key]
    if (!current) return
    const same = (current.op || null) === (sent.op || null) &&
      JSON.stringify(current.payload ?? null) === JSON.stringify(sent.payload ?? null)
    if (same) clearOfflineSet(athleteId, key, storage)
  } catch { /* som clearOfflineSet */ }
}

// --- ORDRE 397: idempotens, rækkefølge, parkerede sæt, overlay -------------
// Se docs/OFFLINE-PAS.md. Stadig rene funktioner med storage som parameter.

// Klient-dannet række-id til exercise_logs.id (primærnøgle, UUID). Samme id
// ved hvert genforsøg ⇒ databasen afviser nummer to (23505) i stedet for at
// lave en dublet.
export function newSetClientId(cryptoImpl = globalThis.crypto) {
  if (cryptoImpl?.randomUUID) return cryptoImpl.randomUUID()
  const b = new Uint8Array(16)
  if (cryptoImpl?.getRandomValues) cryptoImpl.getRandomValues(b)
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256)
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

// ORDRE 401: et sæts tid er tidspunktet for "Godkendt", ikke for afsendelsen.
// logSet lægger logged_at i payloaden; poster lagt i køen før 401 har den
// ikke, så får de tiden da de kom i køen (samme øjeblik som "Godkendt").
export function queuedPayloadWithTime(entry) {
  const payload = entry?.payload
  if (!payload || payload.logged_at || !entry.queuedAt) return payload
  return { ...payload, logged_at: new Date(entry.queuedAt).toISOString() }
}

// Køens poster i den rækkefølge de blev logget: [[key, entry], ...].
export function orderedOfflineSets(athleteId, storage = globalThis.localStorage) {
  return Object.entries(readOfflineSetQueue(athleteId, storage))
    .sort((a, b) => (a[1]?.queuedAt || 0) - (b[1]?.queuedAt || 0))
}

// Sæt-nøgler der venter på net (sletninger tæller ikke som "sæt der venter").
export function pendingSetKeys(athleteId, storage = globalThis.localStorage) {
  return Object.entries(readOfflineSetQueue(athleteId, storage))
    .filter(([, e]) => e?.op !== 'delete')
    .map(([k]) => k)
}

// Sæt der ALDRIG kan gemmes (øvelsen er slettet af coachen: 23503). Flyttes
// hertil fra køen, så flush ikke prøver for evigt, men slettes aldrig af sig
// selv: atleten ser dem og kan give tallene videre til coachen.
const PARKED_PREFIX = 'entropi_offline_sets_parkeret'

export function parkOfflineSet(athleteId, key, entry, reason, storage = globalThis.localStorage) {
  try {
    if (!storage || !athleteId || !key) return false
    const k = `${PARKED_PREFIX}:${athleteId}`
    const raw = storage.getItem(k)
    const parked = raw ? JSON.parse(raw) : {}
    parked[key] = { ...entry, reason, parkedAt: Date.now() }
    storage.setItem(k, JSON.stringify(parked))
    clearOfflineSet(athleteId, key, storage)
    return true
  } catch {
    return false
  }
}

export function loadParkedSets(athleteId, storage = globalThis.localStorage) {
  try {
    if (!storage || !athleteId) return {}
    const raw = storage.getItem(`${PARKED_PREFIX}:${athleteId}`)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

// Lægger køens ventende sæt oven på rækker fra serveren/øjebliksbilledet:
// en ventende værdi er nyere end serverens (den er ikke sendt endnu), et
// ventende sæt uden række vises som optimistisk, og en ventende sletning
// skjuler rækken. Ren funktion; bruges ved hentning og ved offline-start.
export function overlayQueuedSets(rows, queue, athleteId) {
  const out = [...(rows || [])]
  for (const [key, entry] of Object.entries(queue || {})) {
    if (!entry) continue
    const { exerciseId, setNumber } = entry
    const idx = out.findIndex(l => l.exercise_id === exerciseId && l.set_number === setNumber)
    if (entry.op === 'delete') {
      if (idx >= 0) out.splice(idx, 1)
      continue
    }
    if (idx >= 0) {
      out[idx] = { ...out[idx], ...entry.payload }
    } else {
      out.push({
        id: `optimistic_${key}`, exercise_id: exerciseId, athlete_id: athleteId, set_number: setNumber,
        ...entry.payload, _optimistic: true,
      })
    }
  }
  return out
}
