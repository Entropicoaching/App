import test from 'node:test'
import assert from 'node:assert/strict'
import { createConversation } from './conversationController.mjs'
import { mountConversation } from './ConversationView.mjs'
import { fixture, find, deferred } from './accessibilityFixture.mjs'

async function mount(t, { count = 0, role = 'athlete', send } = {}) {
  const f = fixture(), calls = []
  const controller = createConversation({ enabled: true, storage: () => null, uuid: () => 'synthetic-send', adapters: {
    scope: () => ({ role, ownerId: 'synthetic-owner', athleteId: 'synthetic' }),
    load: async () => ({ messages: Array.from({ length: count }, (_, i) => ({ id: 'synthetic-' + i,
      athlete_id: 'synthetic', sender_role: 'coach', content: 'Syntetisk besked ' + i,
      created_at: '2026-11-05T12:00:00Z', read_at: null })), analyses: [] }),
    seen: () => assert.fail('shortcut acknowledged a message'),
    send: async row => { calls.push(row); return send ? send(row) : row },
  } })
  const cleanup = mountConversation(f.host, controller, { enabled: true })
  t.after(cleanup); await controller.refresh()
  const write = find(f.host, 'button').find(n => n.textContent === 'Skriv til din coach')
  const input = find(f.host, 'textarea')[0]
  return { ...f, controller, cleanup, write, input, calls }
}

for (const count of [0, 50]) test(`write shortcut: ${count} messages; one click reaches the existing draft without reads or sends`, async t => {
  const f = await mount(t, { count })
  const before = f.controller.snapshot().thread.map(item => [item.key, item.unreadAthlete])
  assert.equal(f.doc.activeElement, f.doc.body, 'mount focus is unchanged')
  assert.equal(f.write.hidden, false); assert.equal(f.write.type, 'button')
  assert.equal(f.write.style.minHeight, '44px')
  assert.ok(f.host.children.indexOf(f.write) < f.host.children.indexOf(find(f.host, 'ol')[0]))
  assert.ok(f.host.children.indexOf(find(f.host, 'ol')[0]) < f.host.children.indexOf(f.input.parentNode))
  f.controller.draft('Syntetisk kladde med flere linjer\nbevares')
  for (const reduced of [false, true, false]) {
    f.setReduced(reduced); await f.write.click()
    assert.equal(f.doc.activeElement, f.input)
    assert.deepEqual(f.doc.focusOptions, { preventScroll: true })
    assert.equal(f.doc.scrolled.node, f.input)
    assert.deepEqual(f.doc.scrolled.options, { block: 'center', behavior: reduced ? 'instant' : 'smooth' })
    assert.equal(find(f.host, 'textarea')[0], f.input)
    assert.equal(f.input.value, 'Syntetisk kladde med flere linjer\nbevares')
  }
  assert.deepEqual(f.queries, Array(3).fill('(prefers-reduced-motion: reduce)'))
  delete f.win.matchMedia; await f.write.click()
  assert.equal(f.doc.scrolled.options.behavior, 'smooth')
  assert.deepEqual(f.controller.snapshot().thread.map(item => [item.key, item.unreadAthlete]), before)
  assert.deepEqual(f.calls, [])
  f.cleanup(); f.doc.scrolled = null; await f.write.click()
  assert.equal(f.doc.scrolled, null, 'disposed shortcut stays inert')
})

test('write shortcut follows the existing send/error lock and preserves the failed draft', async t => {
  const gate = deferred()
  const f = await mount(t, { count: 50, send: async () => { await gate.promise; throw Error('Syntetisk sendefejl') } })
  f.controller.draft('Syntetisk ventende besked')
  const sending = f.controller.send()
  assert.equal(f.write.disabled, true); assert.equal(f.input.disabled, true)
  await f.write.click(); assert.equal(f.doc.scrolled, undefined)
  gate.resolve(); await sending
  assert.equal(f.write.disabled, true); assert.equal(f.input.disabled, true)
  assert.equal(f.input.value, 'Syntetisk ventende besked')
  assert.equal(f.calls.length, 1)
  await f.write.click(); assert.equal(f.doc.scrolled, undefined)
})

test('coach keeps the existing composer without an athlete shortcut action', async t => {
  const f = await mount(t, { role: 'coach' })
  assert.equal(f.write.hidden, true)
  await f.write.click()
  assert.equal(f.doc.scrolled, undefined); assert.deepEqual(f.calls, [])
})
