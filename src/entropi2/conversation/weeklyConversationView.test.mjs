import test from 'node:test'
import assert from 'node:assert/strict'
import { createConversation } from './conversationController.mjs'
import { mountConversation } from './ConversationView.mjs'
import { conversationWeek } from './conversationWeek.mjs'

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
}
const find = (el, tag) => [...(el.tagName === tag ? [el] : []), ...el.children.flatMap(n => find(n, tag))]
function fixture(role = 'coach', clock = () => new Date('2026-11-04T12:00:00Z')) {
  const doc = { createElement: tag => new Element(tag, doc) }, root = doc.createElement('root')
  let scope = { role, athleteId: 'synthetic', ownerId: 'synthetic-owner' }, fail = false
  const messages = [], analyses = [], writes = []
  const controller = createConversation({ enabled: true, storage: () => null, adapters: {
    scope: () => scope,
    load: async () => { if (fail) throw Error('Synthetic load failure'); return { messages, analyses } },
    seen: async () => { writes.push('seen'); throw Error('Unexpected write') },
  } })
  const dispose = mountConversation(root, controller, { enabled: true, now: clock })
  return { root, controller, messages, analyses, writes, dispose,
    fail: value => { fail = value }, scope: value => { scope = { ...scope, ...value } } }
}
const message = (id, sender_role, created_at, extra = {}) => ({ id, sender_role, created_at,
  athlete_id: 'synthetic', content: 'Syntetisk tekst', ...extra })
const summary = f => f.root.children[1]

test('actual controller/view shows weekly counts at top with native collapsed details and no writes', async () => {
  const f = fixture()
  assert.equal(summary(f).hidden, true)
  assert.equal(summary(f).textContent.includes('Henter ugens'), false)
  f.messages.push(message('old', 'athlete', '2026-11-01T12:00:00Z'),
    message('a', 'athlete', '2026-11-02T12:00:00Z'),
    message('b', 'coach', '2026-11-03T12:00:00Z'),
    message('c', 'athlete', '2026-11-04T10:00:00Z', { read_by_coach: true }),
    message('foreign', 'athlete', '2026-11-04T10:00:00Z', { athlete_id: 'other' }))
  f.analyses.push({ id: 'v', athlete_id: 'synthetic', status: 'shared',
    created_at: '2026-10-01T12:00:00Z', shared_at: '2026-11-04T11:00:00Z' })
  await f.controller.refresh()
  assert.match(summary(f).children[0].textContent, /Denne uge · 3 beskeder · 1 ubesvarede · 1 video-feedback/)
  const details = find(summary(f), 'details')[0]
  assert.equal(details.open, false); assert.equal(details.hidden, false)
  assert.equal(details.children[0].tagName, 'summary')
  assert.match(details.textContent, /2 fra atleten · 1 fra coachen/)
  // Native browser disclosure owns opening; state emissions must preserve it.
  details.open = true; f.controller.draft('Kladde')
  assert.equal(details.open, true); assert.deepEqual(f.writes, [])
  assert.match(find(f.root, 'ol')[0].textContent, /Coach · /)
  f.dispose()
})

test('loaded empty week is honest zero data, not loading or an error', async () => {
  const f = fixture(); await f.controller.refresh()
  assert.match(summary(f).children[0].textContent, /0 beskeder · 0 ubesvarede · 0 video-feedback/)
  assert.equal(summary(f).hidden, false)
  assert.equal(find(summary(f), 'details')[0].hidden, true)
  assert.doesNotMatch(summary(f).textContent, /Ingen beskeder eller video-feedback/)
  assert.equal(find(summary(f), 'details')[0].open, false)
  f.dispose()
})

test('failed refresh suppresses stale counters, retry restores them, changed scope never leaks counts', async () => {
  const f = fixture(); f.messages.push(message('a', 'athlete', '2026-11-03T12:00:00Z'))
  await f.controller.refresh(); assert.match(summary(f).textContent, /1 beskeder/)
  f.fail(true); await f.controller.refresh()
  assert.equal(summary(f).hidden, true)
  assert.match(f.root.textContent, /Samtalen kunne ikke hentes sikkert/)
  assert.doesNotMatch(summary(f).textContent, /1 beskeder/)
  assert.equal(find(summary(f), 'details')[0].hidden, true)
  f.fail(false); await f.controller.refresh(); assert.match(summary(f).textContent, /1 beskeder/)
  f.scope({ athleteId: 'other' }); await f.controller.refresh()
  assert.doesNotMatch(summary(f).textContent, /1 beskeder/)
  assert.deepEqual(f.writes, []); f.dispose()
})

test('invalid calendar hides optional summary and athlete view never consults summary clock', async () => {
  const f = fixture('coach', () => new Date(NaN)); await f.controller.refresh()
  assert.equal(summary(f).hidden, true); assert.equal(summary(f).textContent.trim(), 'Ugens detaljer'); f.dispose()
  const athlete = fixture('athlete', () => assert.fail('athlete clock accessed'))
  await athlete.controller.refresh()
  assert.equal(summary(athlete).hidden, true); assert.equal(summary(athlete).textContent.includes('beskeder'), false)
  athlete.dispose()
})

test('strict OFF does not inspect root/controller/clock', () => {
  const poison = new Proxy({}, { get() { assert.fail('OFF access') } })
  for (const enabled of [undefined, false, 0, 'true'])
    mountConversation(poison, poison, { enabled, now: poison })()
})

test('Copenhagen calendar boundaries include Monday local midnight and DST changes', () => {
  for (const [now, start, end, hours] of [
    ['2026-11-01T23:30:00Z', '2026-11-01T23:00:00.000Z', '2026-11-08T23:00:00.000Z', 168],
    ['2026-10-25T12:00:00Z', '2026-10-18T22:00:00.000Z', '2026-10-25T23:00:00.000Z', 169],
    ['2026-03-29T12:00:00Z', '2026-03-22T23:00:00.000Z', '2026-03-29T22:00:00.000Z', 167],
    ['2027-01-01T12:00:00Z', '2026-12-27T23:00:00.000Z', '2027-01-03T23:00:00.000Z', 168],
  ]) {
    assert.deepEqual(conversationWeek(new Date(now)), { start, end })
    assert.equal((Date.parse(end) - Date.parse(start)) / 3600000, hours)
  }
})
