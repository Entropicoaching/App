import test from 'node:test'
import assert from 'node:assert/strict'
import { createConversation } from './conversationController.mjs'
import { timestampContent } from './conversationModel.mjs'
import { mountConversation } from './ConversationView.mjs'
import { fixture, find, row, deferred } from './accessibilityFixture.mjs'

const video = { id: 'synthetic-video', athlete_id: 'synthetic', lift: 'squat',
  created_at: '2026-11-02T08:00:00Z', status: 'shared' }
const visible = 'Squat-video 2. nov. ved 3,5 s\nHold brystet oppe.'
const content = timestampContent(video, 3.5, 'Hold brystet oppe.')
const message = overrides => ({ id: 'timed', athlete_id: 'synthetic', sender_role: 'coach',
  category: 'teknik', created_at: '2026-11-02T09:00:00Z', content, ...overrides })

function setup(role = 'athlete', messages = [message()], send) {
  const f = fixture(), calls = []
  const controller = createConversation({ enabled: true, storage: () => null, uuid: () => 'synthetic-send',
    adapters: {
      scope: () => ({ role, athleteId: 'synthetic', ownerId: 'synthetic-owner' }),
      load: async () => ({ messages, analyses: [video] }),
      seen: async item => { calls.push(['seen', item.key]); return { ...item.value, read_at: 'seen', read_by_coach: true } },
      send: async value => { calls.push(['send', { ...value }]); return send(value, messages) },
    } })
  const dispose = mountConversation(f.host, controller, { enabled: true })
  return { ...f, controller, calls, dispose }
}

test('existing timed feedback hides only stored metadata in both preview and expanded conversation, for both roles', async () => {
  for (const role of ['athlete', 'coach']) {
    const f = setup(role)
    try {
      await f.controller.refresh()
      const item = row(f.host, 'message:timed')
      assert.equal(item.children[2].textContent, visible)
      assert.equal(item.children[1].textContent, visible)
      assert.doesNotMatch(f.host.textContent, /Video-id:|synthetic-video/)
      assert.deepEqual(f.calls, [])
      await item.children[0].click()
      assert.equal(row(f.host, 'message:timed').children[1].hidden, false)
      assert.equal(row(f.host, 'message:timed').children[1].textContent, visible)
      assert.match(f.controller.snapshot().thread.find(i => i.key === 'message:timed').value.content,
        /\nVideo-id: synthetic-video$/)
      assert.deepEqual(f.calls, role === 'athlete' ? [['seen', 'message:timed']] : [])
    } finally { f.dispose() }
  }
})

test('ordinary messages, athlete text, invalid markers and non-final id lines remain literal text', async () => {
  const cases = [
    message({ category: 'besked' }),
    message({ sender_role: 'athlete' }),
    message({ content: 'Video-id: synthetic-video\nBehold denne forklaring.' }),
    message({ content: 'En note\nVideo-id: ugyldigt id' }),
    message({ content: '<img onerror=synthetic>\nEn note uden metadata.' }),
  ]
  for (const value of cases) {
    const f = setup('athlete', [value])
    try {
      await f.controller.refresh()
      const item = row(f.host, 'message:timed')
      assert.equal(item.children[1].textContent, value.content)
      assert.equal(item.children[2].textContent, value.content)
      assert.equal(find(item, 'img').length, 0)
      assert.deepEqual(f.calls, [])
    } finally { f.dispose() }
  }
})

test('missing lift/date invents no label data; long preview is truncated after metadata removal', async () => {
  for (const text of ['Kort note', 'x'.repeat(180)]) {
    const value = message({ content: timestampContent({ id: video.id }, 0, text) })
    const f = setup('athlete', [value])
    try {
      await f.controller.refresh()
      const expected = `Video ved 0 s\n${text}`
      const item = row(f.host, 'message:timed')
      assert.equal(item.children[1].textContent, expected)
      assert.equal(item.children[2].textContent, expected.length > 120 ? `${expected.slice(0, 120)}…` : expected)
      assert.doesNotMatch(item.textContent, /Video-id:|synthetic-video|dato mangler|ukendt/)
    } finally { f.dispose() }
  }
})

test('pending, failed and retried timed send hides metadata while preserving exact stored id and retry identity', async () => {
  const gate = deferred()
  let attempts = 0
  const f = setup('coach', [], async (value, messages) => {
    if (++attempts === 1) { await gate.promise; throw Error('Syntetisk sendefejl') }
    const saved = { ...value, created_at: '2026-11-02T09:00:00Z' }
    messages.push(saved); return saved
  })
  try {
    await f.controller.refresh()
    f.controller.draft('Hold brystet oppe.')
    const sending = f.controller.send({ analysisId: video.id, seconds: 3.5 })
    const pending = find(f.host, 'li').find(n => n.dataset.pending)
    assert.equal(pending.textContent, `${visible}\nSender…`)
    gate.resolve(); assert.equal(await sending, false)
    assert.equal(find(f.host, 'li').find(n => n.dataset.pending).textContent,
      `${visible}\nIkke bekræftet. Prøv igen med samme besked.`)
    assert.equal(f.controller.snapshot().draft, 'Hold brystet oppe.')
    assert.equal(await f.controller.retry(), true)
    const writes = f.calls.filter(c => c[0] === 'send').map(c => c[1])
    assert.equal(writes.length, 2); assert.deepEqual(writes[0], writes[1])
    assert.equal(writes[1].content, content); assert.equal(writes[1].category, 'teknik')
    assert.equal(row(f.host, 'message:synthetic-send').children[1].textContent, visible)
    assert.equal(f.controller.snapshot().draft, '')
    assert.doesNotMatch(f.host.textContent, /Video-id:|synthetic-video/)
  } finally { gate.resolve(); f.dispose() }
})

test('strict OFF never reads a root or controller', () => {
  const poison = new Proxy({}, { get() { assert.fail('OFF access') } })
  for (const enabled of [undefined, false, 0, 'true']) mountConversation(poison, poison, { enabled })()
})
