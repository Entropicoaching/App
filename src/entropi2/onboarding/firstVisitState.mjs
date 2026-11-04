import { ONBOARDING_STORAGE_KEY } from './Onboarding.mjs'

// Reuse existing athlete-scoped completion markers; never persist a name.
export function firstVisitKey(athleteId) {
  const valid = (typeof athleteId === 'string' && athleteId.trim() && athleteId.length <= 200) ||
    (Number.isSafeInteger(athleteId) && athleteId > 0)
  if (!valid) return null
  try { return `${ONBOARDING_STORAGE_KEY}:athlete:${encodeURIComponent(athleteId)}` } catch { return null }
}

const storageFor = supplied => supplied === undefined ? globalThis.localStorage : supplied

function validKey(key) {
  if (typeof key !== 'string' || !key.startsWith(`${ONBOARDING_STORAGE_KEY}:athlete:`)) return false
  try { return firstVisitKey(decodeURIComponent(key.slice(`${ONBOARDING_STORAGE_KEY}:athlete:`.length))) === key } catch { return false }
}

export function readFirstVisit(key, supplied) {
  if (!validKey(key)) return { done: true, unavailable: false }
  try {
    const storage = storageFor(supplied)
    if (!storage) return { done: false, unavailable: true }
    return { done: storage.getItem(key) === '1', unavailable: false }
  } catch {
    return { done: false, unavailable: true }
  }
}

export function rememberFirstVisit(key, supplied) {
  if (!validKey(key)) return false
  try {
    const storage = storageFor(supplied)
    if (!storage) return false
    storage.setItem(key, '1')
    return true
  } catch {
    return false
  }
}

export function welcomeTitle(name) {
  const first = typeof name === 'string' ? name.trim().split(/\s+/)[0] : ''
  return first ? `Velkommen, ${first}` : 'Velkommen'
}
