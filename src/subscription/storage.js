// Lokal demo-persistering. Kun localStorage — ingen Supabase, ingen netværk,
// ingen auth. Nøgleprefixet er eget, så prototypen aldrig kan læse eller
// overskrive noget fra 1:1-atletportalen.

const PREFIX = 'entropi:sub:v1:'
export const SCHEMA_VERSION = 1

const KEY = {
  profile: `${PREFIX}profile`,
  sessions: `${PREFIX}sessions`,
  draft: `${PREFIX}draft`,
}

function store() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null
    return window.localStorage
  } catch {
    // Safari i privat tilstand kan kaste ved selve opslaget.
    return null
  }
}

function read(key, fallback) {
  const ls = store()
  if (!ls) return fallback
  try {
    const raw = ls.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

function write(key, value) {
  const ls = store()
  if (!ls) return false
  try {
    ls.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function loadProfile() {
  const profile = read(KEY.profile, null)
  if (!profile || profile.schemaVersion !== SCHEMA_VERSION) return null
  return profile
}

export function saveProfile(profile) {
  return write(KEY.profile, { ...profile, schemaVersion: SCHEMA_VERSION })
}

export function loadSessions() {
  const sessions = read(KEY.sessions, [])
  return Array.isArray(sessions) ? sessions : []
}

export function saveSessions(sessions) {
  return write(KEY.sessions, sessions)
}

// Et igangværende pas gemmes for sig, så en genindlæsning midt i træningen
// ikke koster de sæt der allerede er logget.
export function loadDraft() {
  return read(KEY.draft, null)
}

export function saveDraft(draft) {
  return write(KEY.draft, draft)
}

export function clearDraft() {
  const ls = store()
  if (ls) ls.removeItem(KEY.draft)
}

export function clearAll() {
  const ls = store()
  if (!ls) return
  for (const key of Object.values(KEY)) ls.removeItem(key)
}

export function newProfile({ name, level, daysPerWeek, equipment, programId, entitlement }) {
  return {
    id: `p_${Date.now()}`,
    name: (name || '').trim() || 'Demo',
    level,
    daysPerWeek,
    equipment,
    programId,
    // Sporet kommer fra guiden, hvor brugeren selv vælger. Før 5. august var
    // det hardkodet til 'member', så alle der gik gennem guiden endte som
    // medlem — uanset hvad forsiden lige havde bedt dem tage stilling til.
    // 'member' er stadig fallback for kald uden feltet.
    entitlement: entitlement || 'member',
    createdAt: new Date().toISOString(),
    schemaVersion: SCHEMA_VERSION,
  }
}
