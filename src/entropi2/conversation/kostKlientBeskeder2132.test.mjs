import test from 'node:test'
import assert from 'node:assert/strict'
import { mountConversation } from './ConversationView.mjs'
import { createConversation } from './conversationController.mjs'
import { laesSkjulTraening } from './kostKlientLaesning.mjs'
import { fixture, find } from './accessibilityFixture.mjs'

// Ordre 2132: kun syntetiske atleter. Svaret bygges som i Supabase-klienten: { data, error }.
const atlet = (kostPakke = true) => ({ id: 'synthetic-athlete', kostPakke })
function klient({ uger = [], logs = [], fejl = null, kast = false } = {}) {
  const kald = []
  return { kald, from(tabel) {
    kald.push(tabel)
    const svar = () => kast ? Promise.reject(Error('synthetic')) : Promise.resolve(
      fejl === tabel ? { data: null, error: Error('synthetic') } : { data: tabel === 'weeks' ? uger : logs, error: null })
    const q = { select: () => q, eq: () => q, gt: () => q, order: () => q, limit: () => q, range: () => q,
      then: (a, b) => svar().then(a, b) }
    return q
  } }
}

test('kostklient: kostpakke, ingen uge og ingen historik skjuler træningsknapper', async () => {
  assert.equal(await laesSkjulTraening(klient(), atlet()), true)
})
test('træningsatlet med uge eller løftehistorik er uændret', async () => {
  assert.equal(await laesSkjulTraening(klient({ uger: [{ id: 'w1' }] }), atlet()), false)
  assert.equal(await laesSkjulTraening(klient({ logs: [{ weight: 80 }] }), atlet()), false)
})
test('ingen kostpakke læser intet og skjuler intet', async () => {
  const k = klient()
  assert.equal(await laesSkjulTraening(k, atlet(false)), false)
  assert.equal(await laesSkjulTraening(k, { id: 'synthetic-athlete' }), false)
  assert.deepEqual(k.kald, [])
})
test('fejlet læsning skjuler aldrig knapper', async () => {
  assert.equal(await laesSkjulTraening(klient({ fejl: 'weeks' }), atlet()), false)
  assert.equal(await laesSkjulTraening(klient({ fejl: 'exercise_logs' }), atlet()), false)
  assert.equal(await laesSkjulTraening(klient({ kast: true }), atlet()), false)
  assert.equal(await laesSkjulTraening(null, atlet()), false)
})

async function visning(skjul) {
  const f = fixture(), controller = f.createController()
  const dispose = mountConversation(f.host, controller, { enabled: true })
  await controller.refresh()
  const knapper = () => find(f.host, 'button').map(n => n.textContent)
  const delRaekke = () => find(f.host, 'details').some(n => n.children[0]?.textContent === 'Del et sæt fra passet')
  if (skjul != null) controller.setSkjulTraening(skjul)
  return { f, controller, dispose, knapper, delRaekke }
}
test('visning: knapperne vises som i dag, til læsningen siger kostklient', async () => {
  const v = await visning()
  try {
    assert.ok(v.knapper().includes('Send video')); assert.equal(v.delRaekke(), true)
    v.controller.setSkjulTraening(true)
    assert.ok(!v.knapper().includes('Send video')); assert.equal(v.delRaekke(), false)
    assert.ok(v.knapper().includes('Send'), 'Send står stadig')
    assert.equal(find(v.f.host, 'textarea').length > 0, true, 'skrivefeltet står stadig')
    v.controller.setSkjulTraening(false)
    assert.ok(v.knapper().includes('Send video')); assert.equal(v.delRaekke(), true)
  } finally { v.dispose() }
})
test('visning: samtalen er uændret for en kostklient', async () => {
  const v = await visning(true)
  try { assert.match(v.f.host.textContent, /Syntetisk besked/) } finally { v.dispose() }
})
