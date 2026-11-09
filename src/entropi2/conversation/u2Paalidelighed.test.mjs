// U2 (ordre 50): pålidelige beskeder. Hver prøve gengiver en påvist fejl på
// 4c60aa7b: rækkefølgen, dobbelt visning, usikker afsendelse, liveopdatering,
// baggrund og læst/ulæst. Kun syntetiske data.
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { createConversation } from './conversationController.mjs'
import { mountConversation } from './ConversationView.mjs'

// Minimal React: effekter køres af prøven, ref peger på en tekst-DOM-vært.
globalThis.__u2react = { effects: [], host: null }
const react = 'data:text/javascript,' + encodeURIComponent(`
  const r = () => globalThis.__u2react
  export const createElement = (...args) => args
  export const useEffect = fn => { r().effects.push(fn) }
  export const useRef = init => ({ current: init ?? r().host })
  export const useState = init => [init, () => {}]
  export const useMemo = fn => fn()
`)
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'react') return { url: react, shortCircuit: true }
  return next(specifier, context)
} })
const { default: Conversation } = await import('./Conversation.mjs')
hooks.deregister()

class Element {
  constructor(tag, ownerDocument) {
    Object.assign(this, { tagName: tag, ownerDocument, style: {}, dataset: {}, attributes: {},
      children: [], events: new Map(), value: '', _text: '', disabled: false })
  }
  set textContent(value) { this._text = String(value); this.children = [] }
  get textContent() { return this._text + this.children.map(n => n.textContent).join(' ') }
  append(...children) { this.children.push(...children) }
  replaceChildren(...children) { this._text = ''; this.children = children }
  setAttribute(key, value) { this.attributes[key] = String(value) }
  addEventListener(type, fn) { this.events.set(type, fn) }
  async event(type) { if (!this.disabled) return this.events.get(type)?.() }
  focus() { this.ownerDocument.focused = this }
  scrollIntoView(options) { this.ownerDocument.scrolled = { node: this, options } }
}
function root() {
  const doc = { createElement: tag => new Element(tag, doc) }
  return doc.createElement('root')
}
const find = (el, tag) => [...(el.tagName === tag ? [el] : []), ...el.children.flatMap(n => find(n, tag))]
const button = (el, text) => {
  const rows = find(el, 'button').filter(n => n.textContent === text)
  assert.equal(rows.length, 1, text); return rows[0]
}
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
const settle = () => new Promise(resolve => setTimeout(resolve, 0))

function fixture(role = 'athlete') {
  let serial = 0, gate = null, sendGate = null, failLoad = false, failSendAfterWrite = false
  const rows = [], videos = [], calls = []
  const adapters = {
    scope: () => ({ role, ownerId: 'syntetisk-ejer', athleteId: 'syntetisk-atlet' }),
    async load() {
      calls.push('load')
      const snapshot = { messages: rows.map(row => ({ ...row })), analyses: videos.map(row => ({ ...row })) }
      if (gate) await gate.promise
      if (failLoad) throw Error('syntetisk netfejl')
      return snapshot
    },
    async seen(item) {
      calls.push(['seen', item.key])
      const row = rows.find(r => r.id === item.value.id)
      Object.assign(row, role === 'coach' ? { read_by_coach: true } : { read_at: '2026-11-09T20:00:00Z' })
      return { ...row }
    },
    async send(row) {
      calls.push(['send', row.id])
      const saved = { ...row, created_at: `2026-11-09T19:0${rows.length}:00Z` }
      rows.push(saved)
      if (sendGate) await sendGate.promise
      // Skrivningen lykkedes, men svaret gik tabt på et dårligt net.
      if (failSendAfterWrite) throw Error('Beskeden blev ikke sendt. Prøv igen.')
      return { ...saved }
    },
  }
  const controller = createConversation({ enabled: true, adapters, storage: () => null, uuid: () => `syntetisk-${++serial}` })
  return { controller, rows, videos, calls,
    hold() { gate = deferred(); return gate }, holdSend() { sendGate = deferred(); return sendGate },
    failLoad: value => { failLoad = value }, failSendAfterWrite: value => { failSendAfterWrite = value } }
}
const message = (id, sender_role, minute, extra = {}) => ({ id, athlete_id: 'syntetisk-atlet', sender_role,
  content: `Syntetisk ${id}`, category: 'besked', created_at: `2026-11-09T18:${String(minute).padStart(2, '0')}:00Z`, ...extra })

test('rækkefølgen: tråden står efter tidspunkt, og en læsning flytter ikke beskeden', async () => {
  const f = fixture('athlete'), el = root()
  f.rows.push(message('spoergsmaal', 'athlete', 1), message('svar', 'coach', 2),
    message('tak', 'athlete', 3), message('nyt-svar', 'coach', 4))
  const cleanup = mountConversation(el, f.controller, { enabled: true })
  await f.controller.refresh()
  const list = find(el, 'ol')[0]
  const order = ['message:spoergsmaal', 'message:svar', 'message:tak', 'message:nyt-svar']
  assert.deepEqual(list.children.map(n => n.dataset.key), order)
  await button(el, '2 ulæste · Spring til første ulæste').event('click')
  assert.equal(el.ownerDocument.focused, list.children[1].children[0])
  await list.children[1].children[0].event('click')
  assert.deepEqual(list.children.map(n => n.dataset.key), order)
  cleanup()
})

test('dobbelt besked: en hentning midt i afsendelsen viser beskeden én gang', async () => {
  const f = fixture('athlete'), el = root()
  const cleanup = mountConversation(el, f.controller, { enabled: true })
  await f.controller.refresh()
  f.controller.draft('Syntetisk besked fra telefonen')
  // Rækken er skrevet, men bekræftelsen er endnu ikke kommet tilbage, mens en anden hentning lander.
  const confirm = f.holdSend()
  const sending = f.controller.send()
  await settle()
  await f.controller.refresh()
  const shown = find(el, 'li').filter(n => n.dataset.key === 'message:syntetisk-1' || n.dataset.pending === 'syntetisk-1')
  assert.equal(shown.length, 1)
  // Dobbelttryk, mens den første afsendelse venter, giver ingen ny række.
  assert.equal(await f.controller.send(), false)
  confirm.resolve(); await sending
  assert.equal(f.calls.filter(c => c[0] === 'send').length, 1)
  assert.equal(f.rows.length, 1)
  cleanup()
})

test('usikker afsendelse: når næste hentning viser beskeden, er den sendt og vises kun én gang', async () => {
  const f = fixture('athlete'), el = root()
  const cleanup = mountConversation(el, f.controller, { enabled: true })
  await f.controller.refresh()
  f.failSendAfterWrite(true)
  f.controller.draft('Syntetisk besked på dårligt net')
  assert.equal(await f.controller.send(), false)
  assert.equal(f.controller.snapshot().operation.status, 'error')
  f.failSendAfterWrite(false)
  await f.controller.refresh()
  const state = f.controller.snapshot()
  assert.notEqual(state.operation?.status, 'error')
  assert.equal(state.draft, '')
  assert.equal(state.error, '')
  const shown = find(el, 'li').filter(n => n.dataset.key === 'message:syntetisk-1' || n.dataset.pending === 'syntetisk-1')
  assert.equal(shown.length, 1)
  // Et dobbelttryk på "Prøv igen" bagefter sender ikke en ny række.
  await f.controller.retry()
  assert.equal(f.calls.filter(c => c[0] === 'send').length, 1)
  assert.equal(f.rows.length, 1)
  cleanup()
})

test('baggrundshentning: en netfejl efter indlæsning skjuler ikke tråden og blinker ikke', async () => {
  const f = fixture('athlete'), el = root()
  f.rows.push(message('svar', 'coach', 2))
  const cleanup = mountConversation(el, f.controller, { enabled: true })
  await f.controller.refresh()
  const gate = f.hold()
  const quiet = f.controller.refresh({ quiet: true })
  assert.equal(f.controller.snapshot().loading, false)
  assert.ok(!find(el, 'p').some(n => n.textContent === 'Henter samtalen…'))
  f.failLoad(true); gate.resolve(); await quiet
  const state = f.controller.snapshot()
  assert.equal(state.error, '')
  assert.deepEqual(state.thread.map(item => item.key), ['message:svar'])
  cleanup()
})

test('læst/ulæst: en læsning under en baggrundshentning lykkes og overskrives ikke af det ældre svar', async () => {
  const f = fixture('athlete')
  f.rows.push(message('svar', 'coach', 2))
  await f.controller.refresh()
  // Den ældre hentning har allerede taget sit øjebliksbillede med svaret som ulæst.
  const gate = f.hold()
  const quiet = f.controller.refresh({ quiet: true })
  assert.equal(await f.controller.seen('message:svar'), true)
  assert.equal(f.controller.snapshot().error, '')
  gate.resolve(); await quiet
  assert.equal(f.controller.snapshot().thread[0].unreadAthlete, false)
})

function mounted({ role = 'athlete', onUnread } = {}) {
  const f = fixture(role), host = root(), listeners = new Map(), timers = { cleared: false }
  const doc = { visibilityState: 'visible',
    addEventListener: (type, fn) => listeners.set(type, fn), removeEventListener: type => listeners.delete(type) }
  Object.assign(timers, { setInterval(fn, ms) { timers.tick = fn; timers.ms = ms; return 7 },
    clearInterval(id) { timers.cleared = id === 7 } })
  globalThis.__u2react = { effects: [], host }
  Conversation({ enabled: true, createController: () => f.controller, onUnread,
    live: { doc, win: null, timers } })
  const cleanups = globalThis.__u2react.effects.map(effect => effect())
  return { f, host, doc, listeners, timers, cleanup: () => cleanups.forEach(fn => typeof fn === 'function' && fn()) }
}

test('liveopdatering: et nyt svar vises uden at samtalen genåbnes', async () => {
  const m = mounted()
  await settle()
  assert.equal(m.f.calls.filter(c => c === 'load').length, 1)
  assert.equal(m.timers.ms, 30000)
  m.f.rows.push(message('nyt-svar', 'coach', 5))
  await m.timers.tick(); await settle()
  assert.ok(find(m.host, 'li').some(n => n.dataset.key === 'message:nyt-svar'))
  m.cleanup()
  assert.equal(m.timers.cleared, true)
})

test('app i baggrunden: tilbage i forgrunden henter samtalen igen, skjult side henter ikke', async () => {
  const m = mounted()
  await settle()
  m.doc.visibilityState = 'hidden'
  await m.timers.tick(); await settle()
  assert.equal(m.f.calls.filter(c => c === 'load').length, 1)
  m.f.rows.push(message('svar-mens-vaek', 'coach', 6))
  m.doc.visibilityState = 'visible'
  await m.listeners.get('visibilitychange')(); await settle()
  assert.equal(m.f.calls.filter(c => c === 'load').length, 2)
  assert.ok(find(m.host, 'li').some(n => n.dataset.key === 'message:svar-mens-vaek'))
  m.cleanup()
})

for (const role of ['athlete', 'coach']) test(`læst/ulæst (${role}): værten får det nye ulæst-tal, når et svar er læst`, async () => {
  const seen = []
  const m = mounted({ role, onUnread: summary => seen.push(summary) })
  await settle()
  assert.equal(seen.at(-1)?.messages, 0)
  const incoming = role === 'athlete' ? 'coach' : 'athlete'
  m.f.rows.push(message('svar', incoming, 2))
  await m.timers.tick(); await settle()
  assert.equal(seen.at(-1)?.messages, 1)
  assert.equal(seen.at(-1)?.athleteId, 'syntetisk-atlet')
  await m.f.controller.seen('message:svar')
  assert.equal(seen.at(-1).messages, 0)
  m.cleanup()
})
