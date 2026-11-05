import test from 'node:test'
import assert from 'node:assert/strict'
import { createConversation } from './conversationController.mjs'
import { mountConversation } from './ConversationView.mjs'
import { fixture, find, deferred } from './accessibilityFixture.mjs'

for (const role of ['athlete', 'coach']) test(`${role}: read retry and wait labels preserve drafts and separate send retry`, async t => {
  const f = fixture(), gate = deferred()
  let reads = 0, sends = 0
  const controller = createConversation({ enabled: true, storage: () => null,
    uuid: () => 'synthetic:send', adapters: {
      scope: () => ({ role, ownerId: 'synthetic:owner', athleteId: 'synthetic:athlete' }),
      async load() {
        reads++
        if (reads === 1) throw Error('synthetic read failure')
        await gate.promise
        return { messages: [], analyses: [] }
      },
      send: async () => { sends++; throw Error('synthetic send failure') },
    } })
  t.after(mountConversation(f.host, controller, { enabled: true }))
  await controller.refresh()
  controller.draft('Syntetisk kladde')
  const reload = find(f.host, 'button').find(n => n.textContent === 'Hent igen')
  assert.equal(reload.style.minHeight, '44px')
  const pending = reload.click()
  assert.equal(reload.textContent, 'Henter…')
  assert.ok(find(f.host, 'p').some(n => n.textContent === 'Henter samtalen…'))
  assert.equal(sends, 0); assert.equal(reads, 2)
  assert.equal(find(f.host, 'textarea')[0].value, 'Syntetisk kladde')
  gate.resolve(); await pending
  assert.equal(reload.textContent, 'Hent igen')
  assert.equal(controller.snapshot().draft, 'Syntetisk kladde')
  await find(f.host, 'button').find(n => n.textContent === 'Send').click()
  assert.equal(sends, 1)
  assert.ok(find(f.host, 'button').some(n => n.textContent === 'Prøv afsendelse igen'))
  assert.equal(reload.textContent, 'Hent igen')
  await reload.click()
  assert.equal(sends, 1); assert.equal(reads, 3)
})
