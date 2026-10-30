import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { acknowledgeInboxReplies } from './indbakke2.mjs'
import { fixture, reply, dom, tick } from './indbakke4Fixture.mjs'

test('OFF view and default helper perform no acknowledgement', async () => {
  for (const query of ['', '?indbakke2=0', '?indbakke2=1&indbakke2=1']) {
    const f = fixture({ query }); await f.open()
    assert.equal(f.unread, 1); assert.deepEqual(f.calls, [])
  }
  const f = fixture()
  assert.deepEqual(await acknowledgeInboxReplies({ database: f.database, athleteId: 'a', messages: f.p.messages }), {})
  assert.deepEqual(f.calls, []); dom.reset()
})
test('ON actual mounted inbox shows reply, then clears unread only after acknowledged write', async () => {
  const f = fixture(); let finish; f.faults.wait = new Promise(resolve => { finish = resolve })
  const before = await f.open()
  assert.match(dom.text(before), /1 ulæste/); assert.match(dom.text(before), /Godt arbejde/)
  assert.equal(f.unread, 1); assert.equal(f.p.messages[0].read_at, null)
  finish(); await tick()
  assert.equal(f.unread, 0); assert.match(f.p.messages[0].read_at, /^202\d-/)
  const after = f.render(); dom.flush(); await tick()
  assert.match(dom.text(after), /0 ulæste/); assert.doesNotMatch(dom.text(after), /Ulæst/)
  assert.equal(f.calls.length, 1); assert.equal(f.calls[0].table, 'messages')
  assert.deepEqual(f.calls[0].filters, [['athlete_id', 'a'], ['sender_role', 'coach']])
  assert.deepEqual(f.calls[0].ids, ['reply']); assert.equal(f.calls[0].selected, 'id')
  assert.deepEqual(Object.keys(f.calls[0].payload), ['read_at']); dom.reset()
})
test('only own displayed incoming snapshot across both tracks is acknowledged', async () => {
  const messages = [reply('a'), reply('technical', 'a', { category: 'teknik' }),
    reply('other', 'b'), reply('out', 'a', { sender_role: 'athlete' }), reply('read', 'a', { read_at: 'seen' })]
  const f = fixture({ messages }); f.rows.push(reply('arrived-after-render'))
  await f.open()
  assert.deepEqual(f.calls[0].ids, ['a', 'technical'])
  for (const id of ['other', 'out', 'arrived-after-render']) assert.equal(f.rows.find(row => row.id === id).read_at, null)
  assert.equal(f.rows.find(row => row.id === 'read').read_at, 'seen')
  assert.doesNotMatch(dom.text(f.render()), /message:other/)
  assert.equal(dom.nodes(f.render()).filter(n => n.type === 'li').length, 4); dom.reset()
})
test('missing replies, blank content, missing identity and already read rows do not write', async () => {
  for (const messages of [[], [reply('read', 'a', { read_at: 'seen' })],
    [reply('own', 'a', { sender_role: 'athlete' })], [reply('empty', 'a', { content: ' ' })],
    [reply('missing', 'a', { content: undefined })], [reply('', 'a')]]) {
    const f = fixture({ messages }); await f.open(); assert.deepEqual(f.calls, [])
  }
  const f = fixture({ athleteId: '' }); await f.open(); assert.deepEqual(f.calls, []); dom.reset()
})
for (const failure of ['error', 'throw', 'zero', 'noData']) {
  test(`read receipt ${failure}: retain unread, safe alert and retry`, async () => {
    const f = fixture(); f.faults[failure] = true
    await f.open()
    assert.equal(f.unread, 1); assert.equal(f.p.messages[0].read_at, null)
    const tree = f.render()
    assert.match(dom.text(tree), /kunne ikke markeres som læst/)
    assert.doesNotMatch(dom.text(tree), /PRIVATE|missing column|backend/)
    assert.equal(dom.nodes(tree).filter(n => n.props.role === 'alert').length, 1)
    delete f.faults[failure]; await f.retry()
    assert.equal(f.unread, 0); assert.doesNotMatch(dom.text(f.render()), /kunne ikke markeres/); dom.reset()
  })
}
test('unmount suppresses delayed local changes', async () => {
  const f = fixture(); let finish; f.faults.wait = new Promise(resolve => { finish = resolve })
  await f.open(); dom.reset(); finish(); await tick()
  assert.equal(f.unread, 1); assert.equal(f.p.messages[0].read_at, null)
})
test('scope switch suppresses delayed result for previous athlete', async () => {
  const f = fixture(); let finish; f.faults.wait = new Promise(resolve => { finish = resolve })
  await f.open(); f.p.athleteId = 'b'; f.p.messages = [reply('b', 'b')]; f.rows.push(reply('b', 'b'))
  f.render(); dom.flush(); delete f.faults.wait; finish(); await tick()
  assert.equal(f.p.messages[0].id, 'b'); assert.ok(f.p.messages[0].read_at); assert.equal(f.unread, 0); dom.reset()
})
test('new message snapshot prevents delayed response from overwriting latest messages', async () => {
  const f = fixture(); let finish; f.faults.wait = new Promise(resolve => { finish = resolve })
  await f.open(); f.p.messages = [reply(), reply('new')]; f.rows.push(reply('new'))
  f.render(); dom.flush(); delete f.faults.wait; finish(); await tick()
  assert.deepEqual(f.p.messages.map(m => m.id), ['reply', 'new']); assert.equal(f.unread, 0); dom.reset()
})
test('message HTML stays text throughout acknowledgement', async () => {
  const f = fixture(); await f.open(); const tree = f.render()
  assert.match(dom.text(tree), /<img src=x onerror=bad\(\)>/)
  assert.equal(dom.nodes(tree).some(n => ['img', 'script'].includes(n.type) || n.props.dangerouslySetInnerHTML), false)
  const escaped = dom.text(tree).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  assert.match(escaped, /&lt;img/); assert.doesNotMatch(escaped, /<img/); dom.reset()
})
test('actual source wiring keeps OFF factory/effect and scopes new acknowledgement to athlete', () => {
  const source = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
  const athlete = source('./AthleteView.jsx'), factory = source('./athlete/beskederOgVaegt.jsx')
  assert.match(athlete, /factory=\{indbakke2 \? indbakke2Factory : beskederFactory\}/)
  assert.match(athlete, /inboxReadEnabled: indbakke2 && role === 'athlete' && !coachAthleteId/)
  assert.match(athlete, /inboxDatabase, athleteId: athlete\?\.id/)
  assert.match(athlete, /setMessages, setUnreadMsgCount,/)
  assert.match(factory, /return \{\s*inboxDatabase: supabase,/)
  assert.match(athlete, /enterContact\(\{ enabled: contactLatest/)
  assert.equal(athlete.split('\n')[4], "import { indbakke2Enabled } from './indbakke2.mjs'")
})
