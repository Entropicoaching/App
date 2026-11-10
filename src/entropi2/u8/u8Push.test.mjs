import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { webcrypto } from 'node:crypto'
import { u8Enabled } from './flag.mjs'
import { pushSupport, TIMES, DEFAULT_TIME, shortTime, danishTime, validPublicKey, keyBytes, sameKey, subscriptionRow,
  pushCardState, openRoute } from './pushModel.mjs'
import { readPushSetup, enablePush, saveTime, disablePush } from './pushData.mjs'

// U8 del 2: push i appen bag flag. Kun syntetiske data; nøglen laves i prøven og forsvinder med den.
const b64url = bytes => Buffer.from(bytes).toString('base64url')
const pair = await webcrypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
const PUBLIC_KEY = b64url(new Uint8Array(await webcrypto.subtle.exportKey('raw', pair.publicKey)))
const SUB = { endpoint: 'https://push.example.test/send/abc', keys: { p256dh: 'B' + 'a'.repeat(86), auth: 'c'.repeat(22) } }

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36'
const nav = (ua, extra = {}) => ({ userAgent: ua, serviceWorker: {}, ...extra })

test('U8 2/4: telefonen afgør kortet; iPhone i Safari skal føje til hjemmeskærm', () => {
  assert.equal(pushSupport({}), 'unsupported')
  assert.equal(pushSupport({ navigator: { userAgent: 'Node.js/24' } }), 'unsupported')
  assert.equal(pushSupport({ navigator: nav(IPHONE), hasPushManager: false, notification: null }), 'ios-home-screen')
  assert.equal(pushSupport({ navigator: nav(IPHONE), hasPushManager: true, notification: { permission: 'default' } }), 'ios-home-screen')
  assert.equal(pushSupport({ navigator: nav(IPHONE), standalone: true, hasPushManager: true, notification: { permission: 'default' } }), 'ok')
  assert.equal(pushSupport({ navigator: nav(IPHONE, { standalone: true }), hasPushManager: true, notification: { permission: 'granted' } }), 'ok')
  // Gammel iPhone på hjemmeskærmen uden push: intet kort.
  assert.equal(pushSupport({ navigator: nav(IPHONE), standalone: true, hasPushManager: false, notification: null }), 'unsupported')
  assert.equal(pushSupport({ navigator: { userAgent: 'Mozilla/5.0 (Macintosh)', platform: 'MacIntel', maxTouchPoints: 5, serviceWorker: {} },
    hasPushManager: true, notification: { permission: 'default' } }), 'ios-home-screen')
  assert.equal(pushSupport({ navigator: nav(ANDROID), hasPushManager: true, notification: { permission: 'default' } }), 'ok')
  assert.equal(pushSupport({ navigator: nav(ANDROID), hasPushManager: true, notification: { permission: 'denied' } }), 'denied')
})

test('U8 2/4: tidspunkter hvert kvarter 06:00 til 22:00, standard 19:00, dansk visning', () => {
  assert.equal(TIMES.length, 65)
  assert.equal(TIMES[0], '06:00')
  assert.equal(TIMES.at(-1), '22:00')
  assert.ok(TIMES.includes(DEFAULT_TIME))
  assert.equal(shortTime('07:45:00'), '07:45')
  assert.equal(shortTime('07:40:00'), null)
  assert.equal(danishTime('19:00'), '19.00')
})

test('U8 2/4: nøgle, abonnement og åbning af siden', () => {
  assert.equal(validPublicKey(PUBLIC_KEY), true)
  assert.equal(validPublicKey(PUBLIC_KEY.slice(1)), false)
  assert.equal(keyBytes(PUBLIC_KEY).length, 65)
  assert.equal(sameKey(keyBytes(PUBLIC_KEY).buffer, PUBLIC_KEY), true)
  assert.equal(sameKey(new Uint8Array(65).buffer, PUBLIC_KEY), false)
  assert.equal(sameKey(null, PUBLIC_KEY), false)
  assert.deepEqual(subscriptionRow({ toJSON: () => SUB }, 'ua'), { endpoint: SUB.endpoint, p256dh: SUB.keys.p256dh, auth: SUB.keys.auth, user_agent: 'ua' })
  assert.equal(subscriptionRow({ ...SUB, endpoint: 'http://x.test' }), null)
  assert.equal(subscriptionRow({ endpoint: SUB.endpoint }), null)
  assert.equal(openRoute('?u8=beskeder'), 'beskeder')
  assert.equal(openRoute('?u8=idag&x=1'), 'hjem')
  assert.equal(openRoute('?u8=constructor'), null)
  assert.equal(openRoute('?u8=https://evil.test'), null)
  assert.equal(openRoute(''), null)
})

test('U8 2/4: kortets tilstand; uden opsætning er der intet kort', () => {
  const ready = { status: 'ready', publicKey: PUBLIC_KEY, prefs: null, endpoints: [] }
  for (const status of ['loading', 'missing', 'error']) assert.equal(pushCardState({ setup: { status }, support: 'ok' }), 'hidden')
  assert.equal(pushCardState({ setup: { status: 'missing' }, support: 'ios-home-screen' }), 'hidden')
  assert.equal(pushCardState({ setup: ready, support: 'unsupported' }), 'hidden')
  assert.equal(pushCardState({ setup: ready, support: 'ios-home-screen' }), 'ios')
  assert.equal(pushCardState({ setup: ready, support: 'denied' }), 'denied')
  assert.equal(pushCardState({ setup: ready, support: 'ok', endpoint: SUB.endpoint, permission: 'granted' }), 'off')
  const on = { ...ready, endpoints: [SUB.endpoint], prefs: { remind_at: '07:00:00', reminders_on: true } }
  assert.equal(pushCardState({ setup: on, support: 'ok', endpoint: SUB.endpoint, permission: 'granted' }), 'on')
  assert.equal(pushCardState({ setup: on, support: 'ok', endpoint: SUB.endpoint, permission: 'default' }), 'off')
  assert.equal(pushCardState({ setup: on, support: 'ok', endpoint: 'https://andet.test/1', permission: 'granted' }), 'off')
})

// Syntetisk klient: kun det, U8 bruger (select, limit, upsert, delete().eq, functions.invoke).
function fakeClient({ missing = [], key = PUBLIC_KEY, functionError = false, failOn = null } = {}) {
  const db = { push_subscriptions_v1: [], push_preferences_v1: [] }
  const calls = []
  const client = {
    functions: { invoke: async (name, options) => {
      calls.push(['invoke', name, options.body.action])
      if (functionError) return { data: null, error: { name: 'FunctionsHttpError' } }
      return { data: { publicKey: key }, error: null }
    } },
    from(table) {
      const q = { op: 'select', payload: null, options: null, filters: [] }
      const run = async () => {
        calls.push([q.op, table, q.options?.onConflict ?? null])
        if (missing.includes(table)) return { data: null, error: { code: 'PGRST205', message: `Could not find the table 'public.${table}'` } }
        if (failOn === `${q.op}:${table}`) return { data: null, error: { code: '42501', message: 'nej' } }
        const rows = db[table]
        if (q.op === 'upsert') {
          const key = table === 'push_subscriptions_v1' ? 'endpoint' : null
          const hit = key ? rows.find(r => r[key] === q.payload[key]) : rows[0]
          if (hit) Object.assign(hit, q.payload); else rows.push({ ...q.payload })
          return { data: null, error: null }
        }
        if (q.op === 'delete') {
          const keep = rows.filter(r => !q.filters.every(([c, v]) => r[c] === v))
          db[table] = keep
          return { data: null, error: null }
        }
        return { data: rows.map(r => ({ ...r })), error: null }
      }
      const b = { select: () => b, limit: () => b, eq: (c, v) => (q.filters.push([c, v]), b),
        upsert: (payload, options) => (q.op = 'upsert', q.payload = payload, q.options = options, b),
        delete: () => (q.op = 'delete', b), then: (resolve, reject) => run().then(resolve, reject) }
      return b
    },
  }
  return { client, db, calls }
}

function fakePhone({ permission = 'default', answer = 'granted', existing = null } = {}) {
  const log = []
  let current = existing
  const subscription = (options) => ({ endpoint: SUB.endpoint, options, toJSON: () => SUB,
    unsubscribe: async () => { log.push('unsubscribe'); current = null; return true } })
  const registration = { pushManager: {
    getSubscription: async () => current,
    subscribe: async options => { log.push(['subscribe', options.userVisibleOnly, options.applicationServerKey.length]); current = subscription({ applicationServerKey: options.applicationServerKey.buffer }); return current },
  } }
  // Som i browseren: svaret bliver telefonens tilladelse.
  const notification = { permission, async requestPermission() { log.push('ask'); this.permission = answer; return answer } }
  return { registration, notification, log, existing: options => (current = subscription(options)) }
}

test('U8 2/4: uden tabel eller nøgle er opsætningen "missing"', async () => {
  assert.deepEqual(await readPushSetup({ client: fakeClient({ missing: ['push_preferences_v1', 'push_subscriptions_v1'] }).client }), { status: 'missing' })
  assert.deepEqual(await readPushSetup({ client: fakeClient({ functionError: true }).client }), { status: 'missing' })
  assert.deepEqual(await readPushSetup({ client: fakeClient({ key: 'ikke-en-nøgle' }).client }), { status: 'missing' })
  assert.deepEqual(await readPushSetup({ client: fakeClient({ key: null }).client }), { status: 'missing' })
  assert.deepEqual(await readPushSetup({ client: fakeClient({ failOn: 'select:push_preferences_v1' }).client }), { status: 'error' })
  assert.deepEqual(await readPushSetup({}), { status: 'error' })
  const f = fakeClient()
  f.db.push_subscriptions_v1.push({ endpoint: SUB.endpoint })
  assert.deepEqual(await readPushSetup({ client: f.client }), { status: 'ready', publicKey: PUBLIC_KEY, prefs: null, endpoints: [SUB.endpoint] })
})

test('U8 2/4: ét tryk slår til: tilladelse, abonnement med nøglen, egen række og tidspunkt', async () => {
  const f = fakeClient(), phone = fakePhone()
  assert.equal(await enablePush({ client: f.client, ...phone, publicKey: PUBLIC_KEY, time: '07:30', userAgent: 'syntetisk' }), 'on')
  assert.deepEqual(phone.log, ['ask', ['subscribe', true, 65]])
  assert.deepEqual(f.db.push_subscriptions_v1, [{ endpoint: SUB.endpoint, p256dh: SUB.keys.p256dh, auth: SUB.keys.auth, user_agent: 'syntetisk' }])
  assert.deepEqual(f.db.push_preferences_v1, [{ remind_at: '07:30', reminders_on: true, replies_on: true }])
  assert.deepEqual(f.calls.filter(c => c[0] === 'upsert').map(c => c[2]), ['user_id,endpoint', 'user_id'])
  // Igen: samme række, ingen ny afmelding.
  assert.equal(await enablePush({ client: f.client, ...phone, notification: { permission: 'granted' }, publicKey: PUBLIC_KEY }), 'on')
  assert.equal(f.db.push_subscriptions_v1.length, 1)
  assert.equal(phone.log.filter(x => x === 'unsubscribe').length, 0)
})

test('U8 2/4: nej til tilladelse gemmer intet; gammel nøgle erstattes; forkert tid afvises', async () => {
  const f = fakeClient(), phone = fakePhone({ answer: 'denied' })
  assert.equal(await enablePush({ client: f.client, ...phone, publicKey: PUBLIC_KEY }), 'denied')
  assert.deepEqual(f.db.push_subscriptions_v1, [])
  assert.equal(await enablePush({ client: f.client, ...phone, publicKey: PUBLIC_KEY, time: '07:40' }), 'error')
  const old = fakePhone({ permission: 'granted' })
  old.existing({ applicationServerKey: new Uint8Array(65).buffer })
  assert.equal(await enablePush({ client: f.client, ...old, publicKey: PUBLIC_KEY }), 'on')
  assert.deepEqual(old.log, ['unsubscribe', ['subscribe', true, 65]])
  const failing = fakeClient({ failOn: 'upsert:push_subscriptions_v1' })
  assert.equal(await enablePush({ client: failing.client, ...fakePhone({ permission: 'granted' }), publicKey: PUBLIC_KEY }), 'error')
  assert.deepEqual(failing.db.push_preferences_v1, [])
})

test('U8 2/4: skift tidspunkt og slå fra; rækken slettes før telefonen afmeldes', async () => {
  const f = fakeClient(), phone = fakePhone()
  await enablePush({ client: f.client, ...phone, publicKey: PUBLIC_KEY })
  assert.equal(await saveTime({ client: f.client, time: '21:15' }), 'saved')
  assert.equal(f.db.push_preferences_v1[0].remind_at, '21:15')
  assert.equal(await saveTime({ client: f.client, time: '23:00' }), 'error')
  const failing = fakeClient({ failOn: 'delete:push_subscriptions_v1' })
  const other = fakePhone({ permission: 'granted' })
  other.existing({ applicationServerKey: keyBytes(PUBLIC_KEY).buffer })
  assert.equal(await disablePush({ client: failing.client, registration: other.registration }), 'error')
  assert.deepEqual(other.log, [])
  assert.equal(await disablePush({ client: f.client, registration: phone.registration }), 'off')
  assert.deepEqual(f.db.push_subscriptions_v1, [])
  assert.equal(phone.log.at(-1), 'unsubscribe')
  assert.equal(await disablePush({ client: f.client, registration: phone.registration }), 'off')
})

// ===== Service workeren i en sandkasse =====
function loadWorker() {
  const listeners = {}
  const shown = [], opened = [], navigated = []
  const windows = []
  const self = {
    location: { origin: 'https://app.entropicoaching.dk' },
    addEventListener: (type, fn) => { (listeners[type] ??= []).push(fn) },
    skipWaiting() {},
    // Objekter fra sandkassen kopieres, så deepEqual sammenligner værdier og ikke kontekster.
    registration: { showNotification: async (title, options) => { shown.push(JSON.parse(JSON.stringify({ title, ...options }))) } },
    clients: { claim() {}, matchAll: async () => windows, openWindow: async url => { opened.push(url); return {} } },
  }
  vm.runInNewContext(readFileSync(new URL('../../../public/sw.js', import.meta.url), 'utf8'), { self, URL, Response, caches: {}, fetch })
  const fire = async (type, event) => {
    let wait = Promise.resolve()
    for (const fn of listeners[type] ?? []) fn({ ...event, waitUntil: p => { wait = p } })
    await wait
  }
  const win = url => { const w = { url, focus: async () => w, navigate: async to => { navigated.push(to); return w } }; windows.push(w); return w }
  return { listeners, shown, opened, navigated, fire, win }
}
const pushEvent = data => ({ data: { json: () => typeof data === 'string' ? JSON.parse(data) : data } })

test('U8 2/4: service workeren viser push og beholder de gamle handlinger', async () => {
  const w = loadWorker()
  assert.deepEqual(Object.keys(w.listeners).sort(), ['activate', 'fetch', 'install', 'notificationclick', 'push'])
  assert.equal(w.listeners.fetch.length, 1)
  await w.fire('push', pushEvent({ title: 'Mangler i dag: vægt og mad', body: 'Det tager under et minut.', url: '/?u8=idag', tag: 'paamindelse' }))
  assert.deepEqual(w.shown[0], { title: 'Mangler i dag: vægt og mad', body: 'Det tager under et minut.', tag: 'paamindelse',
    icon: '/icon.svg?v=8', data: { url: '/?u8=idag' } })
  await w.fire('push', pushEvent('{ikke json'))
  await w.fire('push', { data: null })
  await w.fire('push', pushEvent({ title: 'x'.repeat(200), url: 'https://evil.test/' }))
  assert.deepEqual(w.shown.slice(1).map(n => [n.title.length, n.tag, n.data.url]), [[7, 'entropi', '/'], [7, 'entropi', '/'], [80, 'entropi', '/']])
  await w.fire('push', pushEvent({ url: '//evil.test/x' }))
  await w.fire('push', pushEvent({ url: '/\\evil.test' }))
  assert.deepEqual(w.shown.slice(4).map(n => n.data.url), ['/', '/'])
})

test('U8 2/4: klik genbruger appvinduet, men aldrig VideoCoach-siden; ellers et nyt vindue', async () => {
  const click = url => ({ notification: { data: { url }, close() {} } })
  const none = loadWorker()
  await none.fire('notificationclick', click('/?u8=beskeder'))
  assert.deepEqual(none.opened, ['/?u8=beskeder'])
  const app = loadWorker()
  app.win('https://app.entropicoaching.dk/videocoach.html?mode=athlete')
  app.win('https://app.entropicoaching.dk/')
  await app.fire('notificationclick', click('/?u8=beskeder'))
  assert.deepEqual([app.navigated, app.opened], [['/?u8=beskeder'], []])
  const video = loadWorker()
  video.win('https://app.entropicoaching.dk/videocoach.html?mode=athlete')
  await video.fire('notificationclick', click('https://evil.test/'))
  assert.deepEqual([video.navigated, video.opened], [[], ['/']])
})

test('U8 2/4: flaget er slukket, indtil sidste commit tænder det', () => {
  assert.equal(u8Enabled('push', true), true)
  assert.equal(u8Enabled('push', false), false)
})

// ===== Kortet: uden opsætning intet; med opsætning ét tryk =====
let React, act, createRoot, hostFixture, tick, propsOf, missingReact = false
try {
  React = await import('react'); ({ act } = React)
  ;({ createRoot } = await import('react-dom/client'))
  ;({ hostFixture, tick, propsOf } = await import('../nutrition/diaryTemplate.fixture.mjs'))
} catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error
  missingReact = true
}
const gate = { skip: missingReact ? 'Kræver ægte React.' : false }
async function mount(element) {
  const dom = hostFixture(), root = createRoot(dom.host)
  const render = el => act(async () => { root.render(el); for (let i = 0; i < 12; i++) await tick() })
  await render(element)
  const all = () => [...dom.host.querySelectorAll('button, select, summary, p, details, section')]
  return { dom, text: () => dom.host.textContent, all,
    button: text => [...dom.host.querySelectorAll('button')].find(el => el.textContent === text) ?? null,
    click: async el => act(async () => { propsOf(el).onClick({ preventDefault() {} }); for (let i = 0; i < 12; i++) await tick() }),
    async done() { await act(async () => { root.unmount(); await tick() }); dom.restore() } }
}
const phoneEnv = (phone, extra = {}) => ({ navigator: { userAgent: ANDROID, serviceWorker: {} }, hasPushManager: true,
  notification: phone.notification, registration: phone.registration, ...extra })

test('U8 2/4: kortet er tomt uden tabel, uden nøgle og på en browser uden push', gate, async () => {
  const { default: PushCard } = await import('./PushCard.mjs')
  for (const [f, env] of [[fakeClient({ missing: ['push_preferences_v1'] }), phoneEnv(fakePhone())],
    [fakeClient({ functionError: true }), phoneEnv(fakePhone())],
    [fakeClient({ functionError: true }), { navigator: { userAgent: IPHONE, serviceWorker: {} } }],
    [fakeClient(), { navigator: { userAgent: 'Node.js/24' } }]]) {
    const view = await mount(React.createElement(PushCard, { athleteId: 'a1', client: f.client, env }))
    assert.equal(view.text(), '')
    await view.done()
  }
})

test('U8 2/4: ét tryk slår til med valgt tidspunkt; derefter én linje med Skift', gate, async () => {
  const { default: PushCard } = await import('./PushCard.mjs')
  const f = fakeClient(), phone = fakePhone()
  const view = await mount(React.createElement(PushCard, { athleteId: 'a1', client: f.client, env: phoneEnv(phone) }))
  assert.match(view.text(), /Mangler du vægt, dagsform eller mad/)
  const select = view.dom.host.querySelector('select')
  assert.equal(select.value ?? propsOf(select).value, '19:00')
  await act(async () => { propsOf(select).onChange({ target: { value: '07:30' } }); await tick() })
  await view.click(view.button('Slå påmindelser til'))
  assert.deepEqual(f.db.push_preferences_v1, [{ remind_at: '07:30', reminders_on: true, replies_on: true }])
  assert.match(view.text(), /Påmindelse kl\. 07\.30, hvis noget mangler\. Skift/)
  assert.match(view.text(), /Påmindelser er slået til\. Du hører fra os kl\. 07\.30/)
  await view.click(view.button('Slå påmindelser fra'))
  assert.deepEqual(f.db.push_subscriptions_v1, [])
  assert.match(view.text(), /Slå påmindelser til/)
  await view.done()
})

test('U8 2/4: iPhone i Safari får forklaringen; Ikke nu gør kortet til én linje', gate, async () => {
  const { default: PushCard } = await import('./PushCard.mjs')
  const storage = new Map()
  const store = { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) }
  const view = await mount(React.createElement(PushCard, { athleteId: 'a1', client: fakeClient().client, storage: store,
    env: { navigator: { userAgent: IPHONE, serviceWorker: {} }, hasPushManager: true, notification: { permission: 'default' } } }))
  assert.match(view.text(), /Føj til hjemmeskærm/)
  assert.equal(view.button('Slå påmindelser til'), null)
  await view.click(view.button('Ikke nu'))
  assert.equal(storage.get('entropi-u8-push-senere:a1'), '1')
  assert.equal(view.dom.host.querySelector('summary').textContent, 'Påmindelser på telefonen')
  assert.equal(view.button('Ikke nu'), null)
  await view.done()
})

test('U8 2/4: klik fra en notifikation åbner beskeder én gang og rydder adressen', gate, async () => {
  const { default: PushCard } = await import('./PushCard.mjs')
  const routes = [], replaced = []
  const env = { navigator: { userAgent: 'Node.js/24' }, location: { search: '?u8=beskeder', href: 'https://app.entropicoaching.dk/?u8=beskeder&x=1#a' },
    history: { state: null, replaceState: (s, t, url) => replaced.push(url) } }
  const view = await mount(React.createElement(PushCard, { athleteId: 'a1', client: fakeClient().client, env, setTab: r => routes.push(r) }))
  assert.deepEqual([routes, replaced], [['beskeder'], ['/?x=1#a']])
  await view.done()
})
