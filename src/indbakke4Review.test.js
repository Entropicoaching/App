import test from 'node:test'
import assert from 'node:assert/strict'
import { acknowledgeInboxReplies } from './indbakke2.mjs'
import { fixture, reply, dom, tick } from './indbakke4Fixture.mjs'

test('counter: permission revoked during write cannot change the visible unread state', async () => {
  const f = fixture(); let finish; f.faults.wait = new Promise(resolve => { finish = resolve })
  await f.open(); f.p.inboxReadEnabled = false; f.render(); dom.flush()
  finish(); await tick(); assert.equal(f.unread, 1); assert.equal(f.p.messages[0].read_at, null)
  assert.equal(f.calls.length, 1); dom.reset()
})
test('counter: permissive response cannot reveal foreign messages or videos', async () => {
  const f = fixture({ messages: [reply(), reply('foreign', 'b', { content: 'FOREIGN SECRET' })] })
  f.p.sharedVideoAnalyses = [{ id: 'foreign-video', athlete_id: 'b', athlete_seen_at: null }]
  f.p.renderSharedFeedbackCards = () => dom.createElement('p', null, 'FOREIGN VIDEO')
  await f.open(); const text = dom.text(f.render())
  assert.doesNotMatch(text, /FOREIGN/); assert.deepEqual(f.calls[0].ids, ['reply']); assert.equal(f.unread, 0); dom.reset()
})
test('counter: malformed success data is never accepted as a receipt', async () => {
  for (const data of [null, {}, [{ id: 'foreign' }], [{ id: 'reply' }, { id: 'foreign' }]]) {
    const result = await acknowledgeInboxReplies({ enabled: true, athleteId: 'a', messages: [reply()],
      database: { from() { const q = { update() { return q }, eq() { return q }, in() { return q }, select() { return Promise.resolve({ data }) } }; return q } } })
    assert.deepEqual(result, { error: true })
  }
})
test('counter: same message id in a different thread is never locally acknowledged', async () => {
  const f = fixture({ messages: [reply('same'), reply('same', 'b')] })
  await f.open()
  assert.ok(f.p.messages[0].read_at); assert.equal(f.p.messages[1].read_at, null)
  assert.equal(f.rows[1].read_at, null); assert.deepEqual(f.calls[0].ids, ['same']); dom.reset()
})
test('counter: StrictMode effect replay is idempotent and does not touch outgoing replies', async () => {
  const f = fixture({ messages: [reply(), reply('outgoing', 'a', { sender_role: 'athlete' })] })
  let finish; f.faults.wait = new Promise(resolve => { finish = resolve })
  await f.open(); dom.reset(); await f.open(); finish(); await tick()
  assert.equal(f.unread, 0); assert.equal(f.p.messages[1].read_at, null)
  assert.ok(f.calls.every(call => call.ids.join(',') === 'reply')); dom.reset()
})
test('counter: duplicate snapshot ids are acknowledged once and immutable input stays unchanged', async () => {
  const messages = [Object.freeze(reply()), Object.freeze(reply())]
  const f = fixture({ messages }); const snapshot = Object.freeze(messages)
  const result = await acknowledgeInboxReplies({ enabled: true, athleteId: 'a', messages: snapshot, database: f.database })
  assert.deepEqual(f.calls[0].ids, ['reply']); assert.ok(result.messages.every(row => row.read_at))
  assert.ok(snapshot.every(row => row.read_at === null)); dom.reset()
})
test('counter: missing identity hides ON thread; invalid flag or expired scope cannot access database', async () => {
  const f = fixture({ athleteId: '' }); await f.open()
  assert.equal(dom.nodes(f.render()).filter(n => n.type === 'li').length, 0)
  assert.deepEqual(f.calls, []); dom.reset()
  const database = { from() { assert.fail('unexpected database access') } }
  for (const options of [{ athleteId: undefined, enabled: true }, { athleteId: 'a', enabled: 1 },
    { athleteId: 'a', enabled: true, isCurrent: () => false }]) {
    assert.deepEqual(await acknowledgeInboxReplies({ database, messages: [reply()], ...options }), {})
  }
})
