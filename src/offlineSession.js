// ORDRE 397 — login uden net (se docs/OFFLINE-PAS.md, "Login uden net").
// Er access-token udløbet, og kan auth-js ikke nå serveren for at forny det,
// svarer getSession() null, og appen ville vise login-skærmen i kælderen.
// Auth-js lader selv sessionen ligge i storage ved netværksfejl og fjerner den,
// når serveren afviser fornyelsen. At den stadig ligger der betyder derfor "vi
// kunne ikke nå serveren", ikke "sessionen er død".
//
// Den gemte session giver ingen ny adgang: App.jsx bruger den kun til at vise
// atletens eget øjebliksbillede af Dagens pas; kald med det udløbne token
// afvises af Supabase og ender i sæt-køen. Kun for en bruger som
// rollehukommelsen (roleCache.js) kender som atlet.
import { isSupabaseAuthTokenKey } from './authSignOut.js'
import { roleCacheKey } from './roleCache.js'

export function readStoredSession(storage = globalThis.localStorage) {
  try {
    if (!storage) return null
    const keys = typeof storage.length === 'number'
      ? Array.from({ length: storage.length }, (_, i) => storage.key(i))
      : Object.keys(storage)
    const tokenKey = keys.find(isSupabaseAuthTokenKey)
    if (!tokenKey) return null
    const session = JSON.parse(storage.getItem(tokenKey) || 'null')
    if (!session?.user?.id || !session.refresh_token) return null
    return session
  } catch {
    return null
  }
}

export function offlineAthleteSession(storage = globalThis.localStorage) {
  const session = readStoredSession(storage)
  if (!session) return null
  try {
    if (storage.getItem(roleCacheKey(session.user.id)) !== 'athlete') return null
  } catch {
    return null
  }
  return session
}

export function browserSaysOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

// ORDRE 397: navigator.onLine er ofte true i en kælder (wifi uden internet,
// én streg). Derfor huskes det også, når et kald til serveren fejler på selve
// nettet (supabase.js' fetch), indtil et kald lykkes igen. Overgangene sendes
// som 'entropi:forbindelse', så Dagens pas og offline-linjen kan reagere, og
// køen sendes, når forbindelsen er tilbage (der kommer ingen 'online'-event,
// når browseren aldrig troede den var væk).
let netFailedAt = 0

function announce(offline) {
  try { window.dispatchEvent(new CustomEvent('entropi:forbindelse', { detail: { offline } })) } catch { /* ikke i en browser */ }
}

export function markNetworkFailure() {
  const was = netFailedAt
  netFailedAt = Date.now()
  if (!was) announce(true)
}

export function markNetworkSuccess() {
  if (!netFailedAt) return
  netFailedAt = 0
  announce(false)
}

// Sand når browseren melder offline, ELLER det seneste kald fejlede på nettet.
export function seemsOffline() {
  return browserSaysOffline() || netFailedAt > 0
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { netFailedAt = 0 })
}
