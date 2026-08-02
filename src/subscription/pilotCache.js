const PREFIX = 'entropi:sub:pilot:v1:'
const LOCAL_SESSION_HISTORY_LIMIT = 64
const LOCAL_ONLY_SESSION_LIMIT = 2080

function storage() {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

function safeUserId(userId) {
  return String(userId || '').replace(/[^a-zA-Z0-9-]/g, '')
}

function key(userId, name) {
  const id = safeUserId(userId)
  if (!id) throw new Error('Bruger-id mangler til pilotcache.')
  return `${PREFIX}${id}:${name}`
}

function read(userId, name, fallback) {
  const store = storage()
  if (!store) return fallback
  try {
    const raw = store.getItem(key(userId, name))
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function write(userId, name, value) {
  const store = storage()
  if (!store) return false
  try {
    store.setItem(key(userId, name), JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function loadPilotDraft(userId) {
  return read(userId, 'draft', null)
}

export function savePilotDraft(userId, draft) {
  return write(userId, 'draft', draft)
}

export function clearPilotDraft(userId) {
  storage()?.removeItem(key(userId, 'draft'))
}

export function loadProgramMatchDraft(userId) {
  return read(userId, 'program-input-draft', null)
}

export function saveProgramMatchDraft(userId, draft) {
  return write(userId, 'program-input-draft', draft)
}

export function clearProgramMatchDraft(userId) {
  storage()?.removeItem(key(userId, 'program-input-draft'))
}

export function loadPilotSessions(userId) {
  const value = read(userId, 'sessions', [])
  return Array.isArray(value) ? value : []
}

export function savePilotSessions(userId, sessions) {
  const sorted = Array.isArray(sessions)
    ? sessions.slice().sort((left, right) => String(left?.startedAt || '').localeCompare(String(right?.startedAt || '')))
    : []
  // Synkroniserbare pas kan altid hentes igen fra shadow. Et helt sprunget pas
  // har derimod ingen serverrække, så dets lille local-only markør må ikke ryge
  // ud af den almindelige 64-pas cache og bryde den senere pasrotation.
  const localOnly = sorted
    .filter(item => item?.localOnly === true && item?.syncStatus === 'local-only')
    .slice(-LOCAL_ONLY_SESSION_LIMIT)
  const reconstructible = sorted
    .filter(item => item?.localOnly !== true || item?.syncStatus !== 'local-only')
    .slice(-LOCAL_SESSION_HISTORY_LIMIT)
  const bounded = [...localOnly, ...reconstructible]
    .sort((left, right) => String(left?.startedAt || '').localeCompare(String(right?.startedAt || '')))
  return write(userId, 'sessions', bounded)
}

export function loadPilotOutbox(userId) {
  const value = read(userId, 'outbox', [])
  return Array.isArray(value) ? value : []
}

export function savePilotOutbox(userId, outbox) {
  return write(userId, 'outbox', outbox)
}

export function enqueuePilotSession(userId, session) {
  const next = { ...session, syncStatus: 'pending', syncError: null }
  const outbox = loadPilotOutbox(userId).filter(item => item.clientId !== next.clientId)
  if (!savePilotOutbox(userId, [...outbox, next])) {
    throw new Error('Passet kunne ikke gemmes sikkert p\u00e5 denne enhed.')
  }

  // Queue first: if the browser closes between these two writes, the next
  // launch can still sync and reconstruct the completed session from outbox.
  const sessions = loadPilotSessions(userId).filter(item => item.clientId !== next.clientId)
  if (!savePilotSessions(userId, [...sessions, next])) {
    throw new Error('Passet ligger i synkk\u00f8en, men den lokale historik kunne ikke opdateres.')
  }
  return next
}

export function updatePilotSyncState(userId, clientId, status, error = null) {
  const update = item => item.clientId === clientId
    ? { ...item, syncStatus: status, syncError: error }
    : item
  savePilotSessions(userId, loadPilotSessions(userId).map(update))
  if (status === 'synced') {
    savePilotOutbox(userId, loadPilotOutbox(userId).filter(item => item.clientId !== clientId))
  } else {
    savePilotOutbox(userId, loadPilotOutbox(userId).map(update))
  }
}

export function clearPilotCache(userId) {
  const store = storage()
  if (!store) return
  for (const name of ['draft', 'sessions', 'outbox', 'program-input-draft']) store.removeItem(key(userId, name))
}

export function pilotCachePrefix(userId) {
  return `${PREFIX}${safeUserId(userId)}:`
}
