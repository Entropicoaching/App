// U8 del 2: rene regler bag push-kortet. Ingen browser-kald her; værten giver et øjebliksbillede.

// Kan telefonen få push i denne visning? 'ok', 'denied', 'ios-home-screen' (iPhone i Safari:
// push virker kun fra hjemmeskærmen) eller 'unsupported'.
export function pushSupport(env = {}) {
  const nav = env.navigator
  if (!nav) return 'unsupported'
  const ua = typeof nav.userAgent === 'string' ? nav.userAgent : ''
  const ios = /iPhone|iPad|iPod/.test(ua) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1)
  const standalone = nav.standalone === true || env.standalone === true
  const can = !!nav.serviceWorker && env.hasPushManager === true && env.notification != null
  if (ios && !standalone) return 'ios-home-screen'
  if (!can) return 'unsupported'
  return env.notification.permission === 'denied' ? 'denied' : 'ok'
}

// Hvert kvarter fra 06:00 til 22:00, som databasen tillader.
export const TIMES = Array.from({ length: 65 }, (_, i) => {
  const minutes = 360 + i * 15
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
})
export const DEFAULT_TIME = '19:00'
export const validTime = value => TIMES.includes(value)
// Databasen svarer '19:00:00'.
export const shortTime = value => typeof value === 'string' && validTime(value.slice(0, 5)) ? value.slice(0, 5) : null
export const danishTime = value => (shortTime(value) ?? '').replace(':', '.')

// En VAPID-nøgle er et ukomprimeret P-256-punkt: 65 bytes, base64url uden fyld er 87 tegn.
export const validPublicKey = value => typeof value === 'string' && /^B[A-Za-z0-9_-]{86}$/.test(value)
export function keyBytes(base64url) {
  const text = base64url.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(text + '='.repeat((4 - text.length % 4) % 4))
  return Uint8Array.from(binary, c => c.charCodeAt(0))
}
export function sameKey(buffer, base64url) {
  if (!buffer) return false
  const a = new Uint8Array(buffer), b = keyBytes(base64url)
  return a.length === b.length && a.every((v, i) => v === b[i])
}

// Rækken til push_subscriptions_v1. user_id sættes af databasen.
export function subscriptionRow(subscription, userAgent = '') {
  const json = typeof subscription?.toJSON === 'function' ? subscription.toJSON() : subscription
  const endpoint = json?.endpoint, p256dh = json?.keys?.p256dh, auth = json?.keys?.auth
  if (typeof endpoint !== 'string' || !/^https:\/\/\S+$/.test(endpoint) || endpoint.length > 1000 ||
      typeof p256dh !== 'string' || typeof auth !== 'string') return null
  return { endpoint, p256dh, auth, user_agent: String(userAgent || '').slice(0, 300) || null }
}

// Kortets tilstand ud fra opsætningen og telefonen.
export function pushCardState({ setup, support, endpoint, permission }) {
  if (setup?.status !== 'ready') return 'hidden'
  if (support === 'ios-home-screen') return 'ios'
  if (support === 'denied') return 'denied'
  if (support !== 'ok') return 'hidden'
  const on = permission === 'granted' && typeof endpoint === 'string' && setup.endpoints.includes(endpoint) &&
    setup.prefs?.reminders_on !== false
  return on ? 'on' : 'off'
}

// Klik på en notifikation åbner appen med ?u8=<side>. Kun kendte sider.
export const OPEN_ROUTES = { beskeder: 'beskeder', idag: 'hjem' }
export function openRoute(search) {
  const value = new URLSearchParams(typeof search === 'string' ? search : '').get('u8')
  return Object.hasOwn(OPEN_ROUTES, value ?? '') ? OPEN_ROUTES[value] : null
}
