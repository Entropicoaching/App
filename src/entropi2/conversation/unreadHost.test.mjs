import test from 'node:test'
import assert from 'node:assert/strict'
import { unreadSummary, sameUnread, seenSharedVideos, shareUnread, CONVERSATION_UNREAD_EVENT } from './unreadHost.mjs'

const thread = [
  { kind: 'message', key: 'message:a', value: { id: 'a' }, unreadAthlete: true, unreadCoach: false },
  { kind: 'message', key: 'message:b', value: { id: 'b' }, unreadAthlete: false, unreadCoach: true },
  { kind: 'video', key: 'video:v1', value: { id: 'v1' }, unreadAthlete: false, unreadCoach: true },
  { kind: 'video', key: 'video:v2', value: { id: 'v2' }, unreadAthlete: true, unreadCoach: false },
]

test('ulæst-sammendrag: kun en indlæst og tilgængelig samtale giver et tal', () => {
  assert.equal(unreadSummary({ available: true, loaded: false, athleteId: 'x', thread }), null)
  assert.equal(unreadSummary({ available: false, loaded: true, athleteId: 'x', thread }), null)
  assert.deepEqual(unreadSummary({ available: true, loaded: true, role: 'athlete', athleteId: 'x', thread }),
    { role: 'athlete', athleteId: 'x', messages: 1, videos: 1, readVideoIds: ['v1'] })
  assert.deepEqual(unreadSummary({ available: true, loaded: true, role: 'coach', athleteId: 'x', thread }),
    { role: 'coach', athleteId: 'x', messages: 1, videos: 1, readVideoIds: ['v2'] })
})

test('ulæst-sammendrag: ens tal giver ingen ny besked til værten', () => {
  const a = { role: 'athlete', athleteId: 'x', messages: 1, videos: 0, readVideoIds: ['v1'] }
  assert.equal(sameUnread(a, { ...a, readVideoIds: ['v1'] }), true)
  assert.equal(sameUnread(a, { ...a, messages: 0 }), false)
  assert.equal(sameUnread(a, { ...a, role: 'coach' }), false)
  assert.equal(sameUnread(null, a), false)
})

test('atletens delte videoer: en video læst i samtalen tæller ikke længere i fanens prik', () => {
  const rows = [{ id: 'v1', athlete_seen_at: null }, { id: 'v2', athlete_seen_at: null }]
  const next = seenSharedVideos(rows, { role: 'athlete', readVideoIds: ['v1'] }, '2026-11-09T20:00:00Z')
  assert.deepEqual(next, [{ id: 'v1', athlete_seen_at: '2026-11-09T20:00:00Z' }, { id: 'v2', athlete_seen_at: null }])
  assert.equal(seenSharedVideos(next, { role: 'athlete', readVideoIds: ['v1'] }), next)
  assert.equal(seenSharedVideos(rows, { role: 'coach', readVideoIds: ['v1'] }), rows)
})

function host() {
  const calls = [], events = []
  let videos = [{ id: 'v1', athlete_seen_at: null }]
  const entry = { athlete: { id: 'atlet-1' }, setUnreadMsgCount: n => calls.push(n),
    setSharedVideoAnalyses: fn => { videos = fn(videos) } }
  const target = { dispatchEvent: event => events.push([event.type, event.detail]) }
  return { calls, events, entry, target, videos: () => videos }
}

test('deling: atletens prik får samtalens tal og læste videoer straks, også første gang', () => {
  const h = host()
  shareUnread(h.entry, { role: 'athlete', athleteId: 'atlet-1', messages: 0, videos: 0, readVideoIds: ['v1'] }, null, h.target)
  assert.deepEqual(h.calls, [0])
  assert.ok(h.videos()[0].athlete_seen_at)
  assert.deepEqual(h.events, [])
  // En samtale for en anden atlet rører ikke værtens tal.
  shareUnread(h.entry, { role: 'athlete', athleteId: 'atlet-2', messages: 3, videos: 0, readVideoIds: [] }, null, h.target)
  assert.deepEqual(h.calls, [0])
})

test('deling: coachens indbakke får kun besked, når tallet ændrer sig efter åbning', () => {
  const h = host()
  const first = { role: 'coach', athleteId: 'atlet-1', messages: 2, videos: 0, readVideoIds: [] }
  shareUnread({}, first, null, h.target)
  assert.deepEqual(h.events, [])
  const next = { ...first, messages: 1 }
  shareUnread({}, next, first, h.target)
  assert.deepEqual(h.events, [[CONVERSATION_UNREAD_EVENT, next]])
  assert.deepEqual(h.calls, [])
})
