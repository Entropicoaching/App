import test from 'node:test'
import assert from 'node:assert/strict'
import { app, nodes, text } from './vcQueueHarness.mjs'
import { sortVideoQueueByWait } from './videoQueueWait.mjs'

const athlete = { id: 'synthetic-review', name: 'Test Kontrol' }
const video = id => ({ key: id, kind: 'video', athlete, video: { id, created_at: '2026-10-26T12:00:00Z' }, title: id, label: 'Video' })
const props = items => ({ athletes: [athlete], coachPriorityItems: items, hiddenAthleteIds: new Set(),
  latestByTrack: {}, unreadByTrack: {}, inboxRefreshStatus: { kind: 'success' },
  openCoachPriorityItem() {}, refreshCoachInbox() {} })

test('frisk modprøve: alle aldre i samme render deler tidspunkt over en dagsgrænse', async () => {
  const host = await app(false, true)
  const clock = Date.now
  let calls = 0
  Date.now = () => Date.parse('2026-10-28T12:00:00Z') + calls++ * 86400000
  try {
    const tree = host.render(props([video('a'), video('b')]))
    const rows = nodes(tree).filter(n => n.props?.['data-video-wait'])
    assert.equal(rows.length, 2)
    assert.equal(text(rows[0]), '2 dage · Løftdata ikke angivet')
    assert.equal(text(rows[1]), text(rows[0]))
  } finally { Date.now = clock }
})

test('frisk modprøve: ens og ukendte tider bevarer præcis inputidentitet', () => {
  const a = video('z'), b = video('a')
  const unknown = video('unknown'); unknown.video.created_at = null
  const invalid = video('invalid'); invalid.video.created_at = 'bad'
  assert.deepEqual(sortVideoQueueByWait([unknown, a, invalid, b]), [a, b, unknown, invalid])
})

test('frisk DOM modprøve: opdaterede rækker sorteres på ny og forsvundne videoer fjernes', async () => {
  const host = await app(false, true)
  const a = video('a'), b = video('b')
  const p = props([a, b])
  const ids = () => nodes(host.render(p)).filter(n => n.props?.['data-video-wait']).map(n => n.props['data-video-wait'])
  assert.deepEqual(ids(), ['a', 'b'])
  p.coachPriorityItems = [{ ...b, video: { ...b.video, created_at: '2026-10-20T12:00:00Z' } }, a]
  assert.deepEqual(ids(), ['b', 'a'])
  p.coachPriorityItems = [a]
  assert.deepEqual(ids(), ['a'])
})
