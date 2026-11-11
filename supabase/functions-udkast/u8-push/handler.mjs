// U8 del 3: edge-funktionen u8-push. UDKAST, ikke deployet.
// To handlinger:
//   {action:'public-key'}  appen henter den offentlige VAPID-nøgle. Uden nøgle: null (appen er som U7).
//   {action:'send'}        kaldes hvert 5. minut af Supabase Cron med headeren x-u8-cron.
//                          Sender dagens påmindelse på atletens tidspunkt og besked om nye coachsvar.
// Hemmeligheder (kun i Supabase, aldrig i repoet): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
// VAPID_SUBJECT og U8_CRON_SECRET. SUPABASE_URL og SUPABASE_SERVICE_ROLE_KEY giver Supabase selv.
// Uden pakke D svarer databasen fejl, og der sendes intet.
import { u8Enabled } from '../../../src/entropi2/u8/flag.mjs'
import { validPublicKey } from '../../../src/entropi2/u8/pushModel.mjs'
import { importVapid, sendPush } from './webPush.mjs'
import { copenhagen, reminderDue, newestPerEndpoint, reminderMessage, mealDaysOf, replyMessage } from './plan.mjs'
import { addCalendarDays } from '../../../src/calendarDate.js'

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
const REPLY_WINDOW_MS = 30 * 60 * 1000

function sameSecret(given, secret) {
  if (typeof given !== 'string' || typeof secret !== 'string' || secret.length < 32 || given.length !== secret.length) return false
  let diff = 0
  for (let i = 0; i < secret.length; i++) diff |= given.charCodeAt(i) ^ secret.charCodeAt(i)
  return diff === 0
}

// PostgREST med service_role. Kaster ved fejl, så en kørsel uden tabellerne stopper før afsendelse.
function rest({ url, key, http }) {
  return async (path, { method = 'GET', body, prefer } = {}) => {
    const response = await http(`${url}/rest/v1/${path}`, { method, body: body === undefined ? undefined : JSON.stringify(body),
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(prefer ? { Prefer: prefer } : {}) } })
    if (!response.ok) throw Error(`${method} ${path.split('?')[0]}: ${response.status}`)
    const text = await response.text()
    return text ? JSON.parse(text) : null
  }
}
const list = values => `(${[...new Set(values)].map(v => `"${String(v).replace(/"/g, '')}"`).join(',')})`

export async function runSend({ db, now, send }) {
  const { day, minute } = copenhagen(now)
  const result = { reminders: 0, replies: 0, sent: 0, removed: 0, failed: 0 }
  const subscriptions = newestPerEndpoint(await db('push_subscriptions_v1?select=user_id,endpoint,p256dh,auth,created_at&limit=5000'))
  if (!subscriptions.length) return result
  const users = [...new Set(subscriptions.map(s => s.user_id))]
  const prefs = new Map((await db(`push_preferences_v1?select=user_id,remind_at,reminders_on,replies_on&user_id=in.${list(users)}`))
    .map(p => [p.user_id, p]))
  const athletes = await db(`athletes?select=id,user_id&user_id=in.${list(users)}`)
  const athletesOf = user => athletes.filter(a => a.user_id === user).map(a => a.id)
  const claim = rows => db('push_log_v1?on_conflict=user_id,kind,ref', { method: 'POST', body: rows,
    prefer: 'resolution=ignore-duplicates,return=representation' })
  const unclaim = (user, kind, refs) => db(`push_log_v1?user_id=eq.${encodeURIComponent(user)}&kind=eq.${kind}&ref=in.${list(refs)}`, { method: 'DELETE' })
  // Sender til brugerens telefoner. Nåede beskeden ingen telefon, og var der en fejl (ikke kun
  // afmeldte telefoner), fjernes markeringen igen, så næste kørsel prøver igen.
  async function deliver(user, message, ttl, release) {
    let delivered = 0, failed = 0
    for (const subscription of subscriptions.filter(s => s.user_id === user)) {
      try {
        const answer = await send(subscription, JSON.stringify(message), ttl)
        if (answer.status >= 200 && answer.status < 300) { delivered++; result.sent++ }
        else if (answer.gone) {
          await db(`push_subscriptions_v1?user_id=eq.${encodeURIComponent(user)}&endpoint=eq.${encodeURIComponent(subscription.endpoint)}`, { method: 'DELETE' })
          result.removed++
        } else { failed++; result.failed++ }
      } catch { failed++; result.failed++ }
    }
    if (!delivered && failed) await release().catch(() => {})
    return delivered
  }

  // Påmindelser: kun brugere med en atletprofil, påmindelser slået til og tidspunktet nået.
  // De sendes færdigt, før coachsvarene hentes, så en fejl der ikke koster dagens påmindelse.
  const due = users.filter(u => prefs.get(u)?.reminders_on === true && reminderDue(prefs.get(u).remind_at, minute) && athletesOf(u).length)
  if (due.length) {
    const ids = due.flatMap(athletesOf)
    const weights = await db(`weight_logs?select=athlete_id&athlete_id=in.${list(ids)}&logged_at=eq.${day}`)
    const readiness = await db(`readiness_logs?select=athlete_id&athlete_id=in.${list(ids)}&logged_date=eq.${day}`)
    const meals = await db(`meal_logs?select=athlete_id,date,meal&athlete_id=in.${list(ids)}&date=gte.${addCalendarDays(day, -7)}&date=lte.${day}&limit=5000`)
    // Påmindelsen gælder kun i dag: den må ikke nå en telefon efter midnat.
    const untilMidnight = Math.max(60, (1440 - minute) * 60)
    for (const user of due) {
      const mine = athletesOf(user)
      const message = reminderMessage({ today: day, minute,
        weightDone: weights.some(r => mine.includes(r.athlete_id)), readinessDone: readiness.some(r => mine.includes(r.athlete_id)),
        mealDays: mealDaysOf(meals.filter(r => mine.includes(r.athlete_id))) })
      if (!message) continue
      // Rækken skrives før afsendelsen: to samtidige kørsler kan ikke begge sende.
      if (!(await claim([{ user_id: user, kind: 'reminder', ref: day }]))?.length) continue
      result.reminders++
      await deliver(user, message, untilMidnight, () => unclaim(user, 'reminder', [day]))
    }
  }

  // Coachsvar: nye, ulæste beskeder fra coachen de seneste 30 minutter, efter telefonen blev tilmeldt.
  const since = new Date(now.getTime() - REPLY_WINDOW_MS).toISOString()
  const messages = await db(`messages?select=id,athlete_id,created_at&sender_role=eq.coach&read_at=is.null&created_at=gte.${since}&order=created_at.asc&limit=500`)
  if (messages.length) {
    const owners = await db(`athletes?select=id,user_id&id=in.${list(messages.map(m => m.athlete_id))}`)
    const byUser = new Map()
    for (const m of messages) {
      const user = owners.find(a => a.id === m.athlete_id)?.user_id
      if (!user || !users.includes(user) || prefs.get(user)?.replies_on === false) continue
      const first = subscriptions.filter(s => s.user_id === user).map(s => String(s.created_at)).sort()[0]
      if (first && String(m.created_at) < first) continue
      byUser.set(user, [...(byUser.get(user) ?? []), m])
    }
    for (const [user, mine] of byUser) {
      const claimed = await claim(mine.map(m => ({ user_id: user, kind: 'reply', ref: String(m.id) })))
      if (!claimed?.length) continue
      result.replies++
      await deliver(user, replyMessage(claimed.length), 86400, () => unclaim(user, 'reply', claimed.map(r => r.ref)))
    }
  }
  return result
}

export function createHandler({ env, fetch: http = fetch, now = () => new Date(), crypto = globalThis.crypto, sendEnabled = u8Enabled('send') }) {
  return async request => {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
    if (request.method !== 'POST') return json({ error: 'Kun POST' }, 405)
    const body = await request.json().catch(() => ({}))
    const publicKey = env('VAPID_PUBLIC_KEY'), privateKey = env('VAPID_PRIVATE_KEY')
    const keysReady = validPublicKey(publicKey) && typeof privateKey === 'string' && privateKey.length > 0
    if (body?.action === 'public-key') return json({ publicKey: keysReady && sendEnabled ? publicKey : null })
    if (body?.action !== 'send') return json({ error: 'Ukendt handling' }, 400)
    if (!sameSecret(request.headers.get('x-u8-cron'), env('U8_CRON_SECRET'))) return json({ error: 'Ikke tilladt' }, 401)
    if (!sendEnabled) return json({ off: true })
    if (!keysReady) return json({ missing: 'nøgle' })
    const subject = env('VAPID_SUBJECT')
    if (typeof subject !== 'string' || !/^(mailto:|https:\/\/)/.test(subject)) return json({ missing: 'VAPID_SUBJECT' })
    try {
      const vapid = await importVapid({ publicKey, privateKey, crypto })
      const at = now()
      const db = rest({ url: env('SUPABASE_URL'), key: env('SUPABASE_SERVICE_ROLE_KEY'), http })
      const send = (subscription, payload, ttl) => sendPush({ subscription, payload, vapid, subject, fetch: http, crypto, ttl,
        nowSeconds: Math.floor(at.getTime() / 1000) })
      return json(await runSend({ db, now: at, send }))
    } catch (error) {
      return json({ error: String(error?.message ?? error).slice(0, 200) }, 500)
    }
  }
}
