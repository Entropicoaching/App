import test from 'node:test'
import assert from 'node:assert/strict'
import { createConversation } from './conversationController.mjs'
import { mountConversation } from './ConversationView.mjs'
import { readWeeklyLetter } from '../coach/ugebrev/readWeeklyLetter.mjs'
import { calendarDay } from '../../calendarDate.js'

// Text/event fixture for the actual imperative view. No React replacement/loader.
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
  async click() { if (!this.disabled) return this.events.get('click')?.() }
  focus() { this.ownerDocument.focused = this }
}
const find = (el, tag) => [...(el.tagName === tag ? [el] : []), ...el.children.flatMap(n => find(n, tag))]
const button = (root, text) => find(root, 'button').find(n => n.textContent === text)
function fixture(role = 'coach') {
  const doc = { createElement: tag => new Element(tag, doc) }, root = doc.createElement('root')
  const now = new Date('2026-11-04T12:00:00Z'), writes = []
  let scope = { role, ownerId: 'synthetic-owner', athleteId: 'synthetic-athlete' }
  let rows = Array.from({ length: 4 }, (_, i) => ({ id: `s${i}`, athlete_id: scope.athleteId,
    logged_date: `2026-11-0${i + 1}`, sleep_hours: 5 })), fail = false, pending
  const query = Object.fromEntries(['select', 'eq', 'gte', 'lte', 'order'].map(method => [method, () => query]))
  query.range = async () => { if (pending) await pending; if (fail) throw Error('synthetic failure'); return { data: rows } }
  const controller = createConversation({ enabled: true, storage: () => null, uuid: () => 'synthetic-send', adapters: {
    scope: () => scope, load: async () => ({ messages: [], analyses: [] }),
    send: async row => { writes.push(row); return { ...row, created_at: now.toISOString() } },
  } })
  controller.weeklyLetter = () => readWeeklyLetter({ enabled: true, getScope: () => scope,
    now: () => now, database: { from: () => query } })
  const cleanup = mountConversation(root, controller, { enabled: true, now: () => now })
  return { root, controller, writes, cleanup, empty: () => { rows = [] }, fail: () => { fail = true },
    pending: promise => { pending = promise }, scope: patch => { scope = { ...scope, ...patch } } }
}

test('actual model + reader + controller + view: coach button above existing field, editable, manual send only', async () => {
  const f = fixture(); await f.controller.refresh()
  const b = button(f.root, 'Lav udkast til ugebrev'), input = find(f.root, 'textarea')[0]
  const compose = find(f.root, 'section')[0]
  assert.equal(compose.children[0].children[0], b); assert.equal(compose.children[1], input)
  assert.equal(b.type, 'button'); assert.equal(b.style.minHeight, '44px')
  await b.click()
  assert.match(input.value, /søvn/); assert.match(f.root.textContent, /Øvrige data er ukendte/)
  assert.equal(f.root.ownerDocument.focused, input); assert.deepEqual(f.writes, [])
  assert.equal(b.disabled, true)
  input.value = 'Syntetisk coachredigering'; input.events.get('input')()
  assert.equal(f.controller.snapshot().draft, input.value)
  await button(f.root, 'Send').click()
  assert.equal(f.writes.length, 1); assert.equal(f.writes[0].content, 'Syntetisk coachredigering')
  assert.equal(input.value, ''); f.cleanup()
})

test('empty and error preserve the editable field with honest status and no writes', async () => {
  for (const kind of ['empty', 'fail']) {
    const f = fixture(); f[kind](); await f.controller.refresh()
    await button(f.root, 'Lav udkast til ugebrev').click()
    assert.match(f.root.textContent, kind === 'empty' ? /Ingen kendte søvnregistreringer/ : /Udkastet kunne ikke dannes/)
    if (kind === 'fail') assert.ok(find(f.root, 'p').some(p => p.attributes.role === 'alert'))
    assert.equal(f.controller.snapshot().draft, ''); assert.deepEqual(f.writes, []); f.cleanup()
  }
})

test('draft typed during pending read survives; changed scope and disposal cannot apply result', async () => {
  for (const action of ['edit', 'scope', 'dispose']) {
    const f = fixture(); await f.controller.refresh()
    let resolve; f.pending(new Promise(r => { resolve = r }))
    const b = button(f.root, 'Lav udkast til ugebrev'), operation = b.click()
    assert.equal(b.disabled, true)
    if (action === 'edit') f.controller.draft('Min syntetiske tekst')
    if (action === 'scope') f.scope({ athleteId: 'other' })
    if (action === 'dispose') f.cleanup()
    resolve(); await operation
    if (action === 'edit') assert.equal(f.controller.snapshot().draft, 'Min syntetiske tekst')
    if (action === 'scope') assert.equal(f.controller.snapshot().draft, '')
    if (action === 'dispose') assert.equal(f.root.children.length, 0)
    assert.deepEqual(f.writes, []); if (action !== 'dispose') f.cleanup()
  }
})

test('athlete has no attached ugebrev tools; strict OFF has no reads', async () => {
  const f = fixture('athlete'); await f.controller.refresh()
  assert.equal(button(f.root, 'Lav udkast til ugebrev'), undefined); f.cleanup()
  const poison = new Proxy({}, { get() { assert.fail('OFF access') } })
  mountConversation(poison, poison, { enabled: false })()
  assert.equal(calendarDay('2026-11-04T23:01:00Z'), '2026-11-05')
})
