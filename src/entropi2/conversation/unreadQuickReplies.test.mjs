import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { createConversation } from './conversationController.mjs'
import { mountConversation } from './ConversationView.mjs'
import { createQuickReplyUsage } from './quickReplyUsage.mjs'

// Only the React import of the copied entry/wrapper is replaced. No UI lifecycle
// claim: the real exported entry factory and its real adapters run below.
const react = 'data:text/javascript,' + encodeURIComponent(`
  export const createElement = () => { throw Error('Unexpected React render') }
  export const useEffect = createElement, useRef = createElement,
    useMemo = createElement, useState = createElement
`)
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'react' && ['ConversationEntry.mjs', 'Conversation.mjs']
    .some(name => context.parentURL === new URL(name, import.meta.url).href))
    return { url: react, shortCircuit: true }
  return next(specifier, context)
} })
const { createEntryFactory } = await import('./ConversationEntry.mjs')
hooks.deregister()

// Text/event DOM, with observable focus/scroll. No browser or layout emulation.
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
function store(initial = {}) {
  const data = new Map(Object.entries(initial)), writes = []
  return { data, writes, getItem: key => data.get(key) ?? null,
    setItem(key, value) { writes.push([key, value]); data.set(key, value) } }
}
function fixture(role = 'coach', storage = store()) {
  let scope = { role, ownerId: 'owner', athleteId: 'athlete' }, fail = false, seenFailure = false, serial = 0
  const calls = [], rows = [], videos = []
  const adapters = {
    scope: () => scope,
    load: async () => ({ messages: rows.map(row => ({ ...row })), analyses: videos.map(row => ({ ...row })) }),
    templates: () => [{ name: 'A', text: 'Første tekst' }, { name: 'B', text: 'Anden tekst' },
      { name: 'C', text: 'Tredje tekst' }],
    async seen(item) {
      calls.push(['seen', item.key])
      if (seenFailure) throw Error('synthetic seen failure')
      const row = [...rows, ...videos].find(row => row.id === item.value.id)
      Object.assign(row, item.kind === 'video' ? role === 'coach'
        ? { conversationCoachSeenAt: '2026-11-03T12:00:00Z' } : { athlete_seen_at: '2026-11-03T12:00:00Z' }
        : role === 'coach' ? { read_by_coach: true } : { read_at: '2026-11-03T12:00:00Z' })
      return { ...row }
    },
    async send(row) {
      calls.push(['send', { ...row }]); if (fail) throw Error('synthetic send failure')
      const saved = { ...row, created_at: '2026-11-03T12:00:00Z' }; rows.push(saved); return saved
    },
  }
  const controller = createConversation({ enabled: true, adapters, storage: () => storage, uuid: () => `sent${++serial}` })
  const el = root(), cleanup = mountConversation(el, controller, { enabled: true })
  return { controller, el, cleanup, calls, rows, videos, storage,
    setScope: next => { scope = { ...scope, ...next } }, failSend: value => { fail = value }, failSeen: value => { seenFailure = value } }
}

for (const role of ['coach', 'athlete']) test(`${role}: stable unread grouping, jump only navigates, expansion alone marks read`, async () => {
  const f = fixture(role), incoming = role === 'coach' ? 'athlete' : 'coach'
  f.rows.push(...[
    { id: 'read', sender_role: incoming, read_at: '2026-11-01T12:00:00Z', read_by_coach: true },
    { id: 'one', sender_role: incoming }, { id: 'own', sender_role: role }, { id: 'two', sender_role: incoming },
  ].map((row, i) => ({ ...row, athlete_id: 'athlete', content: row.id, created_at: `2026-11-0${i + 1}T12:00:00Z` })))
  f.videos.push({ id: 'video', athlete_id: 'athlete', status: 'shared', source_mode: 'athlete_submission',
    created_at: '2026-11-05T12:00:00Z' })
  await f.controller.refresh()
  const list = find(f.el, 'ol')[0]
  assert.deepEqual(list.children.map(n => n.dataset.key), ['message:one', 'message:two', 'video:video', 'message:read', 'message:own'])
  assert.deepEqual(f.calls, [])
  const jump = button(f.el, '3 ulæste · Spring til første ulæste')
  const target = list.children[0].children[0]
  await jump.event('click')
  assert.equal(f.el.ownerDocument.focused, target)
  assert.equal(f.el.ownerDocument.scrolled.node, target)
  assert.equal(target.attributes['aria-expanded'], 'false')
  assert.deepEqual(f.calls, [])
  await target.event('click')
  assert.deepEqual(f.calls, [['seen', 'message:one']])
  assert.equal(button(f.el, '2 ulæste · Spring til første ulæste').hidden, false)
  assert.deepEqual(list.children.map(n => n.dataset.key), ['message:two', 'video:video', 'message:read', 'message:one', 'message:own'])
  await button(f.el, '2 ulæste · Spring til første ulæste').event('click')
  assert.equal(f.el.ownerDocument.focused, list.children[0].children[0])
  assert.equal(f.calls.length, 1)
  await list.children[0].children[0].event('click')
  await list.children[0].children[0].event('click')
  assert.equal(button(f.el, '0 ulæste · Spring til første ulæste').hidden, true)
  assert.equal(f.calls.length, 3)
  f.cleanup(); await jump.event('click'); assert.equal(f.el.children.length, 0)
})

test('real controller/view selects without sending, focuses editable draft, and sends the edit', async () => {
  const f = fixture()
  assert.equal(f.storage.writes.length, 0)
  await button(f.el, 'Hent hurtige svar').event('click')
  assert.equal(f.storage.writes.length, 0)
  await button(f.el, 'B').event('click')
  const input = find(f.el, 'textarea')[0]
  assert.equal(input.value, 'Anden tekst'); assert.equal(f.el.ownerDocument.focused, input)
  assert.equal(f.calls.length, 0)
  const quick = find(f.el, 'div').find(n => n.children.some(c => c.textContent === 'B'))
  assert.deepEqual(quick.children.map(n => n.textContent), ['B', 'A', 'C'])
  input.value = 'Redigeret svar'; await input.event('input')
  await button(f.el, 'Send').event('click')
  assert.equal(f.calls[0][0], 'send'); assert.equal(f.calls[0][1].content, 'Redigeret svar')
  assert.equal(f.controller.snapshot().draft, '')
  assert.deepEqual(f.controller.templates().map(row => row.name), ['B', 'A', 'C'])
  assert.equal(f.storage.writes.length, 1)
  assert.match(f.storage.writes[0][0], /^entropi2:conversation:quick-reply-usage:v1:owner$/)
  assert.deepEqual(JSON.parse(f.storage.writes[0][1]), [['B', 1]])
  f.cleanup()
})

test('usage persists across controllers, ties retain source order, coach scopes stay separate', () => {
  const shared = store(), f = fixture('coach', shared)
  f.controller.selectTemplate('C'); f.controller.selectTemplate('B')
  assert.deepEqual(f.controller.templates().map(r => r.name), ['B', 'C', 'A'])
  f.cleanup()
  const next = fixture('coach', shared)
  assert.deepEqual(next.controller.templates().map(r => r.name), ['B', 'C', 'A'])
  next.controller.selectTemplate('C')
  assert.deepEqual(next.controller.templates().map(r => r.name), ['C', 'B', 'A'])
  const writes = shared.writes.length
  next.setScope({ ownerId: 'another' })
  assert.throws(() => next.controller.selectTemplate('A'))
  assert.throws(() => next.controller.templates())
  assert.equal(shared.writes.length, writes)
  next.cleanup()
  const usage = createQuickReplyUsage(() => shared), rows = [{ name: 'A' }, { name: 'B' }, { name: 'C' }]
  assert.deepEqual(usage.order(rows, 'another').map(r => r.name), ['A', 'B', 'C'])
})

test('busy/error/retry do not select or count and retries retain one send identity', async () => {
  const f = fixture(); f.controller.selectTemplate('B'); f.failSend(true)
  const sending = f.controller.send()
  assert.equal(f.controller.selectTemplate('A'), false)
  assert.equal(await sending, false)
  assert.equal(f.controller.selectTemplate('A'), false)
  assert.equal(f.controller.draft('replacement'), false)
  assert.equal(f.storage.writes.length, 1)
  f.failSend(false); assert.equal(await f.controller.retry(), true)
  assert.equal(f.calls[0][1].id, f.calls[1][1].id)
  assert.equal(f.storage.writes.length, 1)
  assert.equal(f.controller.selectTemplate('missing'), false)
  f.cleanup()
})

test('malformed/unavailable/quota storage cannot block selection and retains session ordering', () => {
  const key = 'entropi2:conversation:quick-reply-usage:v1:owner'
  for (const value of ['{broken', '{}', '[[]]', '[["B",-1]]', '[["B",1.5]]']) {
    const f = fixture('coach', store({ [key]: value }))
    assert.deepEqual(f.controller.templates().map(r => r.name), ['A', 'B', 'C'])
    assert.equal(f.controller.selectTemplate('B'), true); f.cleanup()
  }
  for (const storage of [null, { getItem() { throw Error('denied') }, setItem() { throw Error('denied') } },
    { getItem: () => '[["A",1]]', setItem() { throw Error('quota') } }]) {
    const f = fixture('coach', storage)
    f.controller.selectTemplate('B'); f.controller.selectTemplate('B')
    assert.equal(f.controller.snapshot().draft, 'Anden tekst')
    assert.deepEqual(f.controller.templates().map(r => r.name), ['B', 'A', 'C']); f.cleanup()
  }
})

test('athlete and strict OFF never access preferences or templates', () => {
  const poison = new Proxy({}, { get() { assert.fail('OFF capability accessed') } })
  for (const enabled of [undefined, false, 0, 'true']) {
    const c = createConversation({ enabled, adapters: poison, storage: poison })
    assert.deepEqual(c.snapshot().thread, [])
    assert.throws(() => c.selectTemplate('A'))
    mountConversation(poison, poison, { enabled })(); c.dispose()
  }
  const f = fixture('athlete', poison)
  assert.deepEqual(f.controller.templates(), [])
  assert.equal(f.controller.selectTemplate('A'), false); f.cleanup()
})

test('copied entry factory wires existing scoped storage into actual quick-reply preferences', () => {
  const storage = store({ 'entropi_coach_message_templates_v1:owner': JSON.stringify([
    { name: 'A', text: 'Hej {atlet}' }, { name: 'B', text: 'Godt pas {atlet}' },
  ]) })
  const entry = { enabled: true, session: { user: { id: 'owner' } },
    selectedAthlete: { id: 'athlete' }, athletes: [{ id: 'athlete', name: 'Testatlet' }], storage: () => storage }
  const factory = createEntryFactory({ enabled: true, role: 'coach', getEntry: () => entry })
  const c = factory(); assert.equal(c.selectTemplate('B'), true)
  assert.equal(c.snapshot().draft, 'Godt pas Testatlet'); c.dispose()
  const next = factory()
  assert.deepEqual(next.templates().map(r => r.name), ['B', 'A'])
  assert.deepEqual(storage.writes.map(([key]) => key), ['entropi2:conversation:quick-reply-usage:v1:owner'])
  assert.equal(next.selectTemplate('A'), true); next.dispose()
})

test('failed read acknowledgement retains unread count and can be retried on explicit open', async () => {
  const f = fixture()
  f.rows.push({ id: 'one', athlete_id: 'athlete', sender_role: 'athlete', content: 'Syntetisk besked',
    created_at: '2026-11-03T12:00:00Z' })
  await f.controller.refresh(); f.failSeen(true)
  const list = find(f.el, 'ol')[0]
  await list.children[0].children[0].event('click')
  assert.equal(button(f.el, '1 ulæste · Spring til første ulæste').hidden, false)
  assert.equal(list.children[0].children[1].hidden, false)
  assert.equal(f.controller.snapshot().thread[0].unreadCoach, true)
  f.failSeen(false); await list.children[0].children[0].event('click')
  assert.equal(button(f.el, '0 ulæste · Spring til første ulæste').hidden, true)
  assert.equal(f.controller.snapshot().thread[0].unreadCoach, false)
  f.cleanup()
})

test('actual entry factory wires the ugebrev reader only for coach and rechecks authorization', async () => {
  let reads = 0
  const storage = store()
  const query = Object.fromEntries(['select', 'eq', 'gte', 'lte', 'order'].map(method => [method, () => query]))
  query.range = async () => { reads++; return { data: [] } }
  const entry = { enabled: true, session: { user: { id: 'synthetic-owner' } },
    selectedAthlete: { id: 'synthetic-athlete' }, athletes: [{ id: 'synthetic-athlete' }],
    storage: () => storage, inboxDatabase: { from: table => { assert.equal(table, 'readiness_logs'); return query } } }
  const c = createEntryFactory({ enabled: true, role: 'coach', getEntry: () => entry })()
  assert.equal((await c.weeklyLetter()).state, 'empty'); assert.equal(reads, 1)
  assert.equal(c.snapshot().draft, ''); assert.deepEqual(storage.writes, [])
  entry.athletes = []
  await assert.rejects(c.weeklyLetter()); assert.equal(reads, 1); c.dispose()
  entry.athlete = { id: 'synthetic-athlete', user_id: 'synthetic-owner' }
  const athlete = createEntryFactory({ enabled: true, role: 'athlete', getEntry: () => entry })()
  assert.equal(athlete.weeklyLetter, undefined); athlete.dispose()
  const off = createEntryFactory({ enabled: false, role: 'coach', getEntry: () => entry })()
  assert.equal(off.weeklyLetter, undefined); off.dispose()
})
