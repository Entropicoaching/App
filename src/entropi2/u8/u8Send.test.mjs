import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import vm from 'node:vm'
import { createECDH, createDecipheriv, createPublicKey, hkdfSync, randomBytes, verify, webcrypto } from 'node:crypto'
import { u8Enabled } from './flag.mjs'
import { b64urlDecode, b64urlEncode, encryptPayload } from '../../../supabase/functions-udkast/u8-push/webPush.mjs'
import { copenhagen, reminderDue, newestPerEndpoint, reminderMessage, mealDaysOf, replyMessage } from '../../../supabase/functions-udkast/u8-push/plan.mjs'
import { createHandler } from '../../../supabase/functions-udkast/u8-push/handler.mjs'

// U8 del 3: afsendelsen som edge-funktion i udkast. Nøglerne laves her i prøven af Marcs eget
// script og findes kun i denne proces; intet net, ingen database, kun syntetiske data.
const root = new URL('../../../', import.meta.url)
const keyScript = spawnSync(process.execPath, ['scripts/u8-vapid-noegler.mjs'], { cwd: root, encoding: 'utf8' })
const secrets = Object.fromEntries([...keyScript.stdout.matchAll(/^([A-Z0-9_]+) = (\S+)$/gm)].map(m => [m[1], m[2]]))

test('U8 3/4: nøglescriptet giver fire værdier i den rigtige form og skriver intet', () => {
  assert.equal(keyScript.status, 0)
  assert.deepEqual(Object.keys(secrets), ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT', 'U8_CRON_SECRET'])
  assert.match(secrets.VAPID_PUBLIC_KEY, /^B[A-Za-z0-9_-]{86}$/)
  assert.equal(b64urlDecode(secrets.VAPID_PRIVATE_KEY).length, 32)
  assert.equal(b64urlDecode(secrets.U8_CRON_SECRET).length, 32)
  assert.doesNotMatch(readFileSync(new URL('scripts/u8-vapid-noegler.mjs', root), 'utf8'), /writeFile|appendFile|setx|process\.env\.\w+\s*=/)
})

test('U8 3/4: krypteringen giver præcis resultatet fra RFC 8291, bilag A', async () => {
  const c = webcrypto
  const asPub = b64urlDecode('BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8')
  const jwk = { kty: 'EC', crv: 'P-256', x: b64urlEncode(asPub.slice(1, 33)), y: b64urlEncode(asPub.slice(33)),
    d: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw', ext: true }
  const serverKeys = { privateKey: await c.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']),
    publicKey: await c.subtle.importKey('raw', asPub, { name: 'ECDH', namedCurve: 'P-256' }, true, []) }
  const out = await encryptPayload({ payload: 'When I grow up, I want to be a watermelon', serverKeys, crypto: c,
    p256dh: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
    auth: 'BTBZMqHH6r4Tts7J_aSIgg', salt: b64urlDecode('DGv6ra1nlYgDCS1FRnbzlw') })
  assert.equal(b64urlEncode(out), 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN')
})

// En syntetisk telefon: egne nøgler, og en uafhængig dekryptering med node:crypto.
function phone() {
  const ecdh = createECDH('prime256v1')
  ecdh.generateKeys()
  const auth = randomBytes(16)
  const decrypt = body => {
    const salt = body.subarray(0, 16), idlen = body[20], keyid = body.subarray(21, 21 + idlen), sealed = body.subarray(21 + idlen)
    const ikm = Buffer.from(hkdfSync('sha256', ecdh.computeSecret(keyid), auth,
      Buffer.concat([Buffer.from('WebPush: info\0'), ecdh.getPublicKey(), keyid]), 32))
    const cek = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16))
    const nonce = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12))
    const d = createDecipheriv('aes-128-gcm', cek, nonce)
    d.setAuthTag(sealed.subarray(-16))
    const plain = Buffer.concat([d.update(sealed.subarray(0, -16)), d.final()])
    assert.equal(plain.at(-1), 2)
    assert.equal(body.readUInt32BE(16), 4096)
    return JSON.parse(plain.subarray(0, -1).toString('utf8'))
  }
  return { p256dh: ecdh.getPublicKey().toString('base64url'), auth: auth.toString('base64url'), decrypt }
}

function verifyVapid(header, endpoint, nowSeconds) {
  const m = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(\S+)$/.exec(header)
  assert.ok(m, header)
  assert.equal(m[4], secrets.VAPID_PUBLIC_KEY)
  const raw = b64urlDecode(m[4])
  const key = createPublicKey({ format: 'jwk', key: { kty: 'EC', crv: 'P-256', x: b64urlEncode(raw.slice(1, 33)), y: b64urlEncode(raw.slice(33)) } })
  assert.ok(verify('sha256', Buffer.from(`${m[1]}.${m[2]}`), { key, dsaEncoding: 'ieee-p1363' }, Buffer.from(m[3], 'base64url')))
  assert.deepEqual(JSON.parse(Buffer.from(m[1], 'base64url')), { typ: 'JWT', alg: 'ES256' })
  assert.deepEqual(JSON.parse(Buffer.from(m[2], 'base64url')), { aud: new URL(endpoint).origin, exp: nowSeconds + 43200, sub: secrets.VAPID_SUBJECT })
}

test('U8 3/4: dansk tid, også over sommertid; tidspunktet gælder en time frem', () => {
  assert.deepEqual(copenhagen(new Date('2026-11-11T18:02:00Z')), { day: '2026-11-11', minute: 19 * 60 + 2 })
  assert.deepEqual(copenhagen(new Date('2026-07-01T17:00:00Z')), { day: '2026-07-01', minute: 19 * 60 })
  assert.deepEqual(copenhagen(new Date('2026-11-11T23:30:00Z')), { day: '2026-11-12', minute: 30 })
  assert.equal(reminderDue('19:00:00', 19 * 60), true)
  assert.equal(reminderDue('19:00:00', 19 * 60 + 59), true)
  assert.equal(reminderDue('19:00:00', 20 * 60), false)
  assert.equal(reminderDue('19:00:00', 18 * 60 + 59), false)
  assert.equal(reminderDue('nej', 600), false)
})

test('U8 3/4: påmindelsen siger kun det, der mangler, i "I dag"-kortets rækkefølge', () => {
  const today = '2026-11-11'
  assert.equal(reminderMessage({ today, minute: 1140, weightDone: true, readinessDone: true, mealDays: [today] }), null)
  assert.deepEqual(reminderMessage({ today, minute: 1140, weightDone: true, readinessDone: false, mealDays: ['2026-11-10'] }),
    { title: 'Mangler i dag: dagsform og mad', body: 'Det tager under et minut. Tryk for at åbne appen.', url: '/?u8=idag', tag: 'paamindelse' })
  assert.equal(reminderMessage({ today, minute: 1140, mealDays: [] }).title, 'Mangler i dag: vægt, dagsform og mad')
  // Tre dage uden mad: madreglens blide tekst fra reminderRules.
  assert.match(reminderMessage({ today, minute: 1140, weightDone: true, readinessDone: true, mealDays: ['2026-11-07'] }).body,
    /Du kan starte med det næste måltid/)
  assert.deepEqual(mealDaysOf([{ date: today, meal: '[appData2-day-v1] kvittering' }, { date: '2026-11-10', meal: 'Frokost' }, { meal: 'x' }]), ['2026-11-10'])
  assert.deepEqual(replyMessage(1).body, 'Tryk for at læse beskeden.')
  assert.deepEqual(replyMessage(3), { title: 'Din coach har svaret', body: '3 nye beskeder. Tryk for at læse dem.', url: '/?u8=beskeder', tag: 'coach-svar' })
  assert.deepEqual(newestPerEndpoint([{ endpoint: 'e', user_id: 'a', created_at: '1' }, { endpoint: 'e', user_id: 'b', created_at: '2' },
    { endpoint: 'f', user_id: 'a', created_at: '1' }]).map(r => r.user_id), ['b', 'a'])
})

// ===== Hele funktionen mod en syntetisk PostgREST og en syntetisk push-tjeneste =====
const URL_ = 'https://syntetisk.supabase.test'
const U1 = '20000000-0000-4000-8000-000000000901', U2 = '20000000-0000-4000-8000-000000000902', U3 = '20000000-0000-4000-8000-000000000903'
function world({ missing = [] } = {}) {
  const p1 = phone(), p2 = phone(), p3 = phone(), gone = phone()
  const db = {
    push_subscriptions_v1: [
      { user_id: U1, endpoint: 'https://push.example.test/u1', p256dh: p1.p256dh, auth: p1.auth, created_at: '2026-11-10T10:00:00Z' },
      { user_id: U1, endpoint: 'https://push.example.test/u1-gammel', p256dh: gone.p256dh, auth: gone.auth, created_at: '2026-11-01T10:00:00Z' },
      { user_id: U2, endpoint: 'https://push.example.test/u2', p256dh: p2.p256dh, auth: p2.auth, created_at: '2026-11-10T10:00:00Z' },
      // Samme telefon som U2, men en ældre bruger: får intet.
      { user_id: U3, endpoint: 'https://push.example.test/u2', p256dh: p3.p256dh, auth: p3.auth, created_at: '2026-11-09T10:00:00Z' }],
    push_preferences_v1: [{ user_id: U1, remind_at: '19:00:00', reminders_on: true, replies_on: true },
      { user_id: U2, remind_at: '07:00:00', reminders_on: true, replies_on: true },
      { user_id: U3, remind_at: '19:00:00', reminders_on: true, replies_on: true }],
    push_log_v1: [],
    athletes: [{ id: 'a1', user_id: U1 }, { id: 'a2', user_id: U2 }, { id: 'a3', user_id: U3 }],
    weight_logs: [{ athlete_id: 'a1', logged_at: '2026-11-11' }],
    readiness_logs: [],
    meal_logs: [{ athlete_id: 'a1', date: '2026-11-10', meal: 'Frokost' }],
    messages: [{ id: 'm1', athlete_id: 'a2', sender_role: 'coach', read_at: null, created_at: '2026-11-11T17:50:00.000Z' },
      { id: 'm2', athlete_id: 'a2', sender_role: 'coach', read_at: '2026-11-11T17:55:00Z', created_at: '2026-11-11T17:51:00.000Z' },
      { id: 'm3', athlete_id: 'a2', sender_role: 'athlete', read_at: null, created_at: '2026-11-11T17:52:00.000Z' },
      { id: 'm4', athlete_id: 'a1', sender_role: 'coach', read_at: null, created_at: '2026-11-11T16:00:00.000Z' }],
  }
  const pushed = [], rest = []
  const phones = { 'https://push.example.test/u1': p1, 'https://push.example.test/u2': p2 }
  const filterRow = (row, [col, op]) => {
    const [kind, ...rest_] = op.split('.'), value = rest_.join('.')
    if (kind === 'eq') return String(row[col]) === decodeURIComponent(value)
    if (kind === 'gte') return String(row[col]) >= value
    if (kind === 'lte') return String(row[col]) <= value
    if (kind === 'is' && value === 'null') return row[col] == null
    if (kind === 'in') return value.slice(1, -1).split(',').map(v => v.replace(/^"|"$/g, '')).includes(String(row[col]))
    throw Error(`ukendt filter ${op}`)
  }
  const fetch = async (url, init = {}) => {
    const u = new URL(url)
    if (u.origin === 'https://push.example.test') {
      pushed.push({ endpoint: url, headers: init.headers, body: Buffer.from(init.body) })
      return new Response(null, { status: url.endsWith('gammel') ? 410 : 201 })
    }
    assert.equal(init.headers.apikey, 'service-syntetisk')
    const table = u.pathname.replace('/rest/v1/', '')
    rest.push(`${init.method ?? 'GET'} ${table}`)
    if (missing.includes(table)) return new Response(JSON.stringify({ code: 'PGRST205' }), { status: 404 })
    const filters = [...u.searchParams].filter(([k]) => !['select', 'order', 'limit', 'on_conflict'].includes(k))
    const rows = db[table]
    if (init.method === 'POST') {
      const inserted = []
      for (const row of JSON.parse(init.body)) {
        if (rows.some(r => r.user_id === row.user_id && r.kind === row.kind && r.ref === row.ref)) continue
        rows.push(row); inserted.push(row)
      }
      return new Response(JSON.stringify(inserted), { status: 201 })
    }
    if (init.method === 'DELETE') {
      db[table] = rows.filter(r => !filters.every(f => filterRow(r, f)))
      return new Response(null, { status: 204 })
    }
    return new Response(JSON.stringify(rows.filter(r => filters.every(f => filterRow(r, f)))), { status: 200 })
  }
  return { db, pushed, rest, fetch, phones }
}
const env = (extra = {}) => name => ({ ...secrets, SUPABASE_URL: URL_, SUPABASE_SERVICE_ROLE_KEY: 'service-syntetisk', ...extra })[name]
const call = (handler, body, headers = {}) => handler(new Request('https://f.test/u8-push', { method: 'POST', body: JSON.stringify(body),
  headers: { 'content-type': 'application/json', ...headers } }))
const AT = new Date('2026-11-11T18:02:00Z')

test('U8 3/4: offentlig nøgle kun med nøgler og tændt afsendelse; send kræver cron-hemmeligheden', async () => {
  const w = world()
  const on = createHandler({ env: env(), fetch: w.fetch, now: () => AT, sendEnabled: true })
  assert.deepEqual(await (await call(on, { action: 'public-key' })).json(), { publicKey: secrets.VAPID_PUBLIC_KEY })
  const noKeys = createHandler({ env: env({ VAPID_PUBLIC_KEY: undefined, VAPID_PRIVATE_KEY: undefined }), fetch: w.fetch, sendEnabled: true })
  assert.deepEqual(await (await call(noKeys, { action: 'public-key' })).json(), { publicKey: null })
  const off = createHandler({ env: env(), fetch: w.fetch, sendEnabled: false })
  assert.deepEqual(await (await call(off, { action: 'public-key' })).json(), { publicKey: null })
  assert.equal((await call(on, { action: 'send' })).status, 401)
  assert.equal((await call(on, { action: 'send' }, { 'x-u8-cron': secrets.U8_CRON_SECRET.slice(1) + 'x' })).status, 401)
  const shortSecret = createHandler({ env: env({ U8_CRON_SECRET: 'kort' }), fetch: w.fetch, sendEnabled: true })
  assert.equal((await call(shortSecret, { action: 'send' }, { 'x-u8-cron': 'kort' })).status, 401)
  assert.deepEqual(await (await call(off, { action: 'send' }, { 'x-u8-cron': secrets.U8_CRON_SECRET })).json(), { off: true })
  assert.equal((await call(on, { action: 'andet' })).status, 400)
  assert.equal((await on(new Request('https://f.test/u8-push', { method: 'OPTIONS' }))).status, 204)
  assert.deepEqual([w.pushed, w.rest], [[], []])
})

test('U8 3/4: kl. 19.02 får U1 påmindelsen og U2 coachsvaret, krypteret og signeret; aldrig to gange', async () => {
  const w = world()
  const handler = createHandler({ env: env(), fetch: w.fetch, now: () => AT, sendEnabled: true })
  const first = await (await call(handler, { action: 'send' }, { 'x-u8-cron': secrets.U8_CRON_SECRET })).json()
  assert.deepEqual(first, { reminders: 1, replies: 1, sent: 2, removed: 1, failed: 0 })
  const byEndpoint = Object.fromEntries(w.pushed.filter(p => !p.endpoint.endsWith('gammel')).map(p => [p.endpoint, p]))
  assert.deepEqual(Object.keys(byEndpoint).sort(), ['https://push.example.test/u1', 'https://push.example.test/u2'])
  assert.deepEqual(w.phones['https://push.example.test/u1'].decrypt(byEndpoint['https://push.example.test/u1'].body),
    { title: 'Mangler i dag: dagsform og mad', body: 'Det tager under et minut. Tryk for at åbne appen.', url: '/?u8=idag', tag: 'paamindelse' })
  assert.deepEqual(w.phones['https://push.example.test/u2'].decrypt(byEndpoint['https://push.example.test/u2'].body),
    { title: 'Din coach har svaret', body: 'Tryk for at læse beskeden.', url: '/?u8=beskeder', tag: 'coach-svar' })
  for (const p of Object.values(byEndpoint)) {
    verifyVapid(p.headers.Authorization, p.endpoint, Math.floor(AT.getTime() / 1000))
    assert.equal(p.headers['Content-Encoding'], 'aes128gcm')
    assert.equal(p.headers.TTL, '86400')
  }
  // Den afmeldte telefon (410) er slettet; logrækkerne er skrevet før afsendelsen.
  assert.deepEqual(w.db.push_subscriptions_v1.map(s => s.endpoint), ['https://push.example.test/u1', 'https://push.example.test/u2', 'https://push.example.test/u2'])
  assert.deepEqual(w.db.push_log_v1.map(r => [r.user_id, r.kind, r.ref]), [[U1, 'reminder', '2026-11-11'], [U2, 'reply', 'm1']])
  // Næste kørsel fem minutter senere sender intet nyt.
  const again = createHandler({ env: env(), fetch: w.fetch, now: () => new Date(AT.getTime() + 300000), sendEnabled: true })
  const count = w.pushed.length
  assert.deepEqual(await (await call(again, { action: 'send' }, { 'x-u8-cron': secrets.U8_CRON_SECRET })).json(),
    { reminders: 0, replies: 0, sent: 0, removed: 0, failed: 0 })
  assert.equal(w.pushed.length, count)
})

test('U8 3/4: uden pakke D sendes intet; alt logget giver ingen påmindelse', async () => {
  const w = world({ missing: ['push_subscriptions_v1'] })
  const handler = createHandler({ env: env(), fetch: w.fetch, now: () => AT, sendEnabled: true })
  const answer = await call(handler, { action: 'send' }, { 'x-u8-cron': secrets.U8_CRON_SECRET })
  assert.equal(answer.status, 500)
  assert.deepEqual(w.pushed, [])
  const done = world()
  done.db.readiness_logs.push({ athlete_id: 'a1', logged_date: '2026-11-11' })
  done.db.meal_logs.push({ athlete_id: 'a1', date: '2026-11-11', meal: 'Aftensmad' })
  done.db.messages = []
  const quiet = createHandler({ env: env(), fetch: done.fetch, now: () => AT, sendEnabled: true })
  assert.deepEqual(await (await call(quiet, { action: 'send' }, { 'x-u8-cron': secrets.U8_CRON_SECRET })).json(),
    { reminders: 0, replies: 0, sent: 0, removed: 0, failed: 0 })
  assert.deepEqual(done.db.push_log_v1, [])
})

test('U8 3/4: den samlede fil svarer til kilden og kører alene som i Supabase', async () => {
  const { bundle } = await import('../../../scripts/u8-push-bundle.mjs')
  const saved = readFileSync(new URL('supabase/functions-udkast/u8-push/u8-push.bundle.js', root), 'utf8').replace(/\r\n/g, '\n')
  assert.equal(saved, await bundle())
  assert.doesNotMatch(saved, /^\s*(import|export)\s/m)
  let handler = null
  const w = world()
  vm.runInNewContext(saved, { Deno: { serve: fn => { handler = fn }, env: { get: name => env()(name) } }, fetch: w.fetch, crypto: webcrypto,
    Response, Request, Headers, URL, URLSearchParams, TextEncoder, TextDecoder, Intl, AbortSignal, btoa, atob, Date, JSON, Math, console })
  assert.equal(typeof handler, 'function')
  // Flaget i den samlede fil følger flag.mjs.
  assert.deepEqual(await (await call(handler, { action: 'public-key' })).json(), { publicKey: u8Enabled('send') ? secrets.VAPID_PUBLIC_KEY : null })
})

test('U8 3/4: afsendelsens flag er slukket, indtil sidste commit tænder det', () => {
  assert.equal(u8Enabled('send', true), true)
  assert.equal(u8Enabled('send', false), false)
})
