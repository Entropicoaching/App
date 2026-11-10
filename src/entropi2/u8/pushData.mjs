import { tableMissing } from '../u7/dayData.mjs'
import { DEFAULT_TIME, keyBytes, sameKey, subscriptionRow, validPublicKey, validTime } from './pushModel.mjs'

// U8 del 2: push-opsætningen gennem appens egen klient. Kun egne rækker (RLS i pakke D).
// 'missing' betyder: tabellen eller nøglen findes ikke endnu. Så skjules kortet, og appen er som U7.
const SUBSCRIPTIONS = 'push_subscriptions_v1'
const PREFERENCES = 'push_preferences_v1'

export async function readPushSetup({ client } = {}) {
  if (!client || typeof client.from !== 'function') return { status: 'error' }
  try {
    const prefs = await client.from(PREFERENCES).select('remind_at, reminders_on, replies_on').limit(1)
    if (prefs?.error) return { status: tableMissing(prefs.error) ? 'missing' : 'error' }
    const subs = await client.from(SUBSCRIPTIONS).select('endpoint').limit(50)
    if (subs?.error) return { status: tableMissing(subs.error) ? 'missing' : 'error' }
    // Den offentlige VAPID-nøgle kommer fra edge-funktionen. Ikke deployet eller uden nøgle: 'missing'.
    let publicKey = null
    try {
      const answer = await client.functions?.invoke?.('u8-push', { body: { action: 'public-key' } })
      publicKey = !answer?.error && validPublicKey(answer?.data?.publicKey) ? answer.data.publicKey : null
    } catch { publicKey = null }
    if (!publicKey) return { status: 'missing' }
    return { status: 'ready', publicKey, prefs: Array.isArray(prefs.data) ? prefs.data[0] ?? null : null,
      endpoints: (Array.isArray(subs.data) ? subs.data : []).map(row => row?.endpoint).filter(e => typeof e === 'string') }
  } catch { return { status: 'error' } }
}

// Ét tryk: tilladelse, abonnement, række og tidspunkt. Svarer 'on', 'denied' eller 'error'.
export async function enablePush({ client, registration, notification, publicKey, time = DEFAULT_TIME, userAgent } = {}) {
  if (!validTime(time) || !validPublicKey(publicKey) || !registration?.pushManager || !notification) return 'error'
  try {
    const permission = notification.permission === 'granted' ? 'granted' : await notification.requestPermission()
    if (permission !== 'granted') return 'denied'
    let subscription = await registration.pushManager.getSubscription()
    // En gammel adresse med en anden nøgle kan ikke bruges; den erstattes.
    if (subscription && !sameKey(subscription.options?.applicationServerKey, publicKey)) {
      await subscription.unsubscribe()
      subscription = null
    }
    subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) })
    const row = subscriptionRow(subscription, userAgent)
    if (!row) return 'error'
    const saved = await client.from(SUBSCRIPTIONS).upsert(row, { onConflict: 'user_id,endpoint' })
    if (saved?.error) return 'error'
    const prefs = await client.from(PREFERENCES).upsert({ remind_at: time, reminders_on: true, replies_on: true }, { onConflict: 'user_id' })
    if (prefs?.error) return 'error'
    return 'on'
  } catch { return 'error' }
}

export async function saveTime({ client, time } = {}) {
  if (!validTime(time)) return 'error'
  try {
    const result = await client.from(PREFERENCES).upsert({ remind_at: time, reminders_on: true }, { onConflict: 'user_id' })
    return result?.error ? 'error' : 'saved'
  } catch { return 'error' }
}

// Slå fra: rækken slettes først, så funktionen ikke sender mere, og derefter afmeldes telefonen.
export async function disablePush({ client, registration } = {}) {
  try {
    const subscription = await registration?.pushManager?.getSubscription()
    if (!subscription) return 'off'
    const removed = await client.from(SUBSCRIPTIONS).delete().eq('endpoint', subscription.endpoint)
    if (removed?.error) return 'error'
    await subscription.unsubscribe()
    return 'off'
  } catch { return 'error' }
}
