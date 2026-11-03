import test from 'node:test'
import assert from 'node:assert/strict'
import { createOwnQuickReplies } from './ownQuickReplies.mjs'
import { createConversation } from './conversationController.mjs'
import { createConversationAdapters } from './conversationAdapters.mjs'
import { mountConversation } from './ConversationView.mjs'

// Inert text/event DOM: native button activation is represented explicitly.
// No layout engine, browser, storage, database or real user is accessed.
class Element {
  constructor(tagName, ownerDocument) {
    Object.assign(this, { tagName, ownerDocument, children: [], style: {}, dataset: {},
      attributes: {}, events: new Map(), value: '', disabled: false, hidden: false, _text: '' })
  }
  set textContent(text) { this._text = String(text); this.children = [] }
  get textContent() { return this._text + this.children.map(child => child.textContent).join(' ') }
  setAttribute(key, value) { this.attributes[key] = String(value) }
  append(...children) { this.children.push(...children) }
  replaceChildren(...children) { this._text = ''; this.children = children }
  addEventListener(event, fn) { this.events.set(event, fn) }
  event(type, event = {}) { if (!this.disabled) return this.events.get(type)?.(event) }
  click() { return this.event('click') }
  focus() { if (!this.disabled) this.ownerDocument.focused = this }
  key(key, extra = {}) {
    const event = { key, prevented: false, preventDefault() { this.prevented = true }, ...extra }
    this.event('keydown', event)
    if (!event.prevented && this.tagName === 'button' && ['Enter', ' '].includes(key)) this.click()
    return event
  }
}
const nodes = (root, tag) => [...(root.tagName === tag ? [root] : []), ...root.children.flatMap(child => nodes(child, tag))]
const button = (root, text) => {
  const matches = nodes(root, 'button').filter(el => el.textContent === text)
  assert.equal(matches.length, 1, text); return matches[0]
}
const labelled = (root, label) => nodes(root, 'textarea').find(el => el.attributes['aria-label'] === label)
const key = owner => `entropi2:conversation:own-quick-replies:v1:${encodeURIComponent(owner)}`
function store(initial = {}) {
  const data = new Map(Object.entries(initial)), reads = [], writes = []
  return { data, reads, writes, getItem(k) { reads.push(k); return data.get(k) ?? null },
    setItem(k, v) { writes.push([k, v]); data.set(k, v) } }
}
function fixture({ owner = 'coach-one', role = 'coach', storage = store(), enabled = true } = {}) {
  let scope = { enabled: true, ownerId: owner, role, athleteId: 'synthetic-athlete',
    athleteUserId: owner, athletes: [{ id: 'synthetic-athlete', name: 'Testatlet' }] }
  const calls = []
  const adapters = createConversationAdapters({ enabled, getScope: () => scope, storage: () => storage,
    database: new Proxy({}, { get() { assert.fail('Unexpected database access') } }) })
  // Only message writes are synthetic; real adapter scope/templates and real controller/view run.
  adapters.send = async row => { calls.push(row); return { ...row, created_at: '2026-11-03T12:00:00Z' } }
  adapters.load = async () => ({ messages: [], analyses: [] })
  const controller = createConversation({ enabled, adapters, storage: () => storage, uuid: () => 'synthetic-message' })
  const doc = { createElement: tag => new Element(tag, doc) }, root = doc.createElement('root')
  root.style.width = '390px'
  const cleanup = mountConversation(root, controller, { enabled })
  return { root, controller, cleanup, storage, calls, adapters, scope: patch => { scope = { ...scope, ...patch } } }
}
function add(f, text) {
  button(f.root, 'Nyt hurtigsvar').click()
  const editor = labelled(f.root, 'Tekst til eget hurtigsvar')
  editor.value = text; editor.event('input'); button(f.root, 'Gem hurtigsvar').click()
}

test('actual controller/view CRUD, persisted reload, standard replies and explicit edited send', async () => {
  const standardKey = 'entropi_coach_message_templates_v1:coach-one'
  const storage = store({ [standardKey]: JSON.stringify([
    { name: 'Godt pas', text: 'Godt pas, {atlet}!' }, { name: 'Hvil', text: 'Hvil i dag.' },
  ]) })
  const f = fixture({ storage })
  assert.deepEqual(storage.reads, []); assert.deepEqual(storage.writes, [])
  button(f.root, 'Hent hurtige svar').click()
  button(f.root, 'Godt pas').click()
  assert.equal(f.controller.snapshot().draft, 'Godt pas, Testatlet!')
  button(f.root, 'Mine hurtigsvar').key('Enter')
  add(f, '  Syntetisk eget svar  ')
  assert.deepEqual(f.controller.ownQuickReplies(), ['Syntetisk eget svar'])
  button(f.root, 'Syntetisk eget svar').key(' ')
  const input = labelled(f.root, 'Din besked')
  assert.equal(input.value, 'Syntetisk eget svar'); assert.equal(f.root.ownerDocument.focused, input)
  assert.deepEqual(f.calls, [])
  button(f.root, 'Redigér').click()
  const editor = labelled(f.root, 'Tekst til eget hurtigsvar')
  editor.value = 'Redigeret hurtigsvar'; editor.event('input')
  assert.equal(editor.key('Enter', { ctrlKey: true }).prevented, true)
  assert.deepEqual(f.controller.ownQuickReplies(), ['Redigeret hurtigsvar'])
  assert.equal(input.value, 'Syntetisk eget svar')
  button(f.root, 'Redigeret hurtigsvar').click()
  input.value = 'Tilpasset besked'; input.event('input')
  await button(f.root, 'Send').click()
  assert.equal(f.calls.length, 1); assert.equal(f.calls[0].content, 'Tilpasset besked')
  button(f.root, 'Hvil').click(); assert.equal(input.value, 'Hvil i dag.')
  assert.equal(storage.data.get(standardKey), JSON.stringify([
    { name: 'Godt pas', text: 'Godt pas, {atlet}!' }, { name: 'Hvil', text: 'Hvil i dag.' },
  ]))
  f.cleanup()
  const reloaded = fixture({ storage }); button(reloaded.root, 'Mine hurtigsvar').click()
  assert.ok(button(reloaded.root, 'Redigeret hurtigsvar'))
  button(reloaded.root, 'Slet').click()
  assert.deepEqual(reloaded.controller.ownQuickReplies(), [])
  assert.deepEqual(JSON.parse(storage.data.get(key('coach-one'))), [])
  assert.ok(storage.writes.every(([k]) => k.startsWith('entropi2:conversation:')))
  reloaded.cleanup()
})

test('240 characters and 12 rows enforced on all mutations, including edit and malformed indices', () => {
  const storage = store(), library = createOwnQuickReplies(() => storage)
  for (const text of ['', '   ', 'x'.repeat(241), null]) assert.throws(() => library.save('coach', null, text))
  assert.equal(storage.writes.length, 0)
  library.save('coach', null, 'x'.repeat(240))
  for (let i = 1; i < 12; i++) library.save('coach', null, `Svar ${i}`)
  assert.throws(() => library.save('coach', null, 'Trettende'))
  assert.throws(() => library.save('coach', 0, 'x'.repeat(241)))
  for (const index of [-1, 12, NaN, '0', undefined]) {
    assert.throws(() => library.save('coach', index, 'Ny'))
    assert.throws(() => library.remove('coach', index))
  }
  assert.equal(library.save('coach', 0, 'Ny').rows.length, 12)
  library.remove('coach', 0); assert.equal(library.save('coach', null, 'Plads igen').rows.length, 12)
  const copy = library.list('coach'); copy.length = 0; assert.equal(library.list('coach').length, 12)
})

test('malformed/oversized storage is ignored; unavailable/throwing storage keeps session CRUD', () => {
  for (const raw of ['{', '{}', '[null]', '[""]', '["   "]', JSON.stringify(['x'.repeat(241)]),
    JSON.stringify(Array(13).fill('Svar'))]) {
    const storage = store({ [key('owner')]: raw }), library = createOwnQuickReplies(() => storage)
    assert.deepEqual(library.list('owner'), []); assert.deepEqual(storage.writes, [])
    assert.deepEqual(library.save('owner', null, 'Gyldig').rows, ['Gyldig'])
  }
  for (const storage of [() => null, () => { throw Error('denied') }, () => ({
    getItem() { throw Error('denied') }, setItem() { throw Error('quota') },
  }), () => ({ getItem: () => '["Eksisterende"]', setItem() { throw Error('quota') } })]) {
    const library = createOwnQuickReplies(storage), index = library.list('coach').length
    assert.equal(library.save('coach', null, 'Session').persisted, false)
    assert.equal(library.save('coach', index, 'Rettet').persisted, false)
    assert.equal(library.list('coach')[index], 'Rettet')
    assert.equal(library.remove('coach', index).persisted, false)
  }
})

test('separate coaches, stale scope, athlete, OFF and disposed controller cannot access preferences', () => {
  const storage = store(), one = fixture({ storage })
  one.controller.ownQuickReplies('save', null, 'Kun coach et')
  const two = fixture({ storage, owner: 'coach-two' })
  assert.deepEqual(two.controller.ownQuickReplies(), [])
  const accesses = storage.reads.length + storage.writes.length
  one.scope({ ownerId: 'coach-two' })
  assert.throws(() => one.controller.ownQuickReplies())
  assert.throws(() => one.controller.ownQuickReplies('save', null, 'Forkert'))
  assert.equal(storage.reads.length + storage.writes.length, accesses)
  one.cleanup(); two.cleanup()
  assert.throws(() => two.controller.ownQuickReplies('remove', 0))
  const poison = new Proxy({}, { get() { assert.fail('Forbidden preference access') } })
  const athlete = fixture({ role: 'athlete', storage: poison })
  assert.throws(() => athlete.controller.ownQuickReplies()); athlete.cleanup()
  for (const enabled of [undefined, false, 0, 'true']) {
    const controller = createConversation({ enabled, adapters: poison, storage: poison })
    assert.throws(() => controller.ownQuickReplies())
    mountConversation(poison, poison, { enabled })(); controller.dispose()
  }
})

test('keyboard cancel/composition, 390px style constraints, capacity and cleanup', () => {
  const f = fixture(); button(f.root, 'Mine hurtigsvar').click()
  button(f.root, 'Nyt hurtigsvar').key('Enter')
  const editor = labelled(f.root, 'Tekst til eget hurtigsvar')
  assert.equal(editor.maxLength, 240); assert.equal(editor.style.width, '100%')
  assert.equal(f.root.ownerDocument.focused, editor)
  editor.value = 'Annulleret'; editor.key('Escape')
  assert.deepEqual(f.controller.ownQuickReplies(), [])
  assert.equal(f.root.ownerDocument.focused, button(f.root, 'Nyt hurtigsvar'))
  button(f.root, 'Nyt hurtigsvar').click(); editor.value = 'Komposition'
  editor.key('Enter', { ctrlKey: true, isComposing: true })
  assert.deepEqual(f.controller.ownQuickReplies(), [])
  button(f.root, 'Annullér').click()
  for (let i = 0; i < 12; i++) add(f, `${i}`.padEnd(240, 'x'))
  assert.equal(button(f.root, 'Nyt hurtigsvar').disabled, true)
  const long = button(f.root, '0'.padEnd(240, 'x'))
  assert.equal(long.style.maxWidth, '100%'); assert.equal(long.style.minWidth, '0')
  assert.equal(long.style.overflowWrap, 'anywhere'); assert.equal(long.style.minHeight, '44px')
  const row = nodes(f.root, 'div').find(el => el.children.includes(long))
  assert.equal(row.style.flexWrap, 'wrap'); assert.equal(row.style.gap, '8px')
  for (const b of nodes(f.root, 'button')) assert.equal(b.type, 'button')
  const stale = button(f.root, 'Gem hurtigsvar'), writes = f.storage.writes.length
  f.cleanup(); stale.click(); long.click()
  assert.equal(f.storage.writes.length, writes); assert.equal(f.root.children.length, 0)
})

test('quota warning is visible and pending/failed send blocks library writes and draft replacement', async () => {
  const f = fixture({ storage: { getItem: () => null, setItem() { throw Error('quota') } } })
  button(f.root, 'Mine hurtigsvar').click(); add(f, 'Midlertidigt svar')
  assert.match(f.root.textContent, /Kun gemt i denne samtale/)
  button(f.root, 'Midlertidigt svar').click()
  // Separate real controller with a deliberately unresolved synthetic send.
  let finish, fail = false
  const storage = store(), adapters = { scope: () => ({ role: 'coach', ownerId: 'coach', athleteId: 'athlete' }),
    send: () => new Promise((resolve, reject) => { finish = () => fail ? reject(Error('synthetic failure')) : resolve({}) }),
    load: async () => ({ messages: [], analyses: [] }) }
  const c = createConversation({ enabled: true, storage: () => storage, adapters, uuid: () => 'msg' })
  c.ownQuickReplies('save', null, 'Eksisterende'); c.draft('Sender')
  const pending = c.send(); const writes = storage.writes.length
  assert.throws(() => c.ownQuickReplies('save', 0, 'Forkert'))
  assert.equal(c.draft('Forkert'), false)
  fail = true; finish(); assert.equal(await pending, false)
  assert.throws(() => c.ownQuickReplies('remove', 0)); assert.equal(storage.writes.length, writes)
  assert.equal(c.snapshot().draft, 'Sender')
  c.dispose(); f.cleanup()
})

test('actual view locks own controls during send, keeps editor text, and reports invalid input', async () => {
  const f = fixture(); button(f.root, 'Mine hurtigsvar').click()
  add(f, 'Svar'); button(f.root, 'Svar').click()
  button(f.root, 'Nyt hurtigsvar').click()
  const editor = labelled(f.root, 'Tekst til eget hurtigsvar')
  editor.value = ' '; button(f.root, 'Gem hurtigsvar').click()
  assert.match(f.root.textContent, /Skriv mellem 1 og 240 tegn/)
  editor.value = 'Uafsluttet redigering'
  let finish
  f.adapters.send = row => new Promise(resolve => { finish = () => resolve({ ...row, created_at: '2026-11-03T12:00:00Z' }) })
  const pending = button(f.root, 'Send').click()
  const writes = f.storage.writes.length
  for (const name of ['Mine hurtigsvar', 'Nyt hurtigsvar', 'Gem hurtigsvar', 'Slet', 'Redigér', 'Svar']) {
    const control = button(f.root, name); assert.equal(control.disabled, true); control.click()
  }
  assert.equal(editor.disabled, true); assert.equal(editor.value, 'Uafsluttet redigering')
  assert.equal(f.storage.writes.length, writes)
  finish(); await pending
  assert.equal(editor.disabled, false); assert.equal(editor.value, 'Uafsluttet redigering')
  button(f.root, 'Gem hurtigsvar').click()
  assert.deepEqual(f.controller.ownQuickReplies(), ['Svar', 'Uafsluttet redigering'])
  f.cleanup()
})
