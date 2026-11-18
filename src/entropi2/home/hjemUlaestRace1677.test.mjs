import test from 'node:test'
import assert from 'node:assert/strict'
import { noteReadMessages, noteReadVideos, noteSharedVideos, unreadCoachCount, unreadVideoCount } from './ulaestBesked.mjs'

// Ordre 1677: en id, der er meldt læst i denne session, forbliver læst, selv om en senere hentning
// endnu ikke har athlete_seen_at / read_at. Nye id'er viser stadig linjen.
const video = (id, extra) => ({ id, athlete_id: 'synthetic-r1', status: 'shared', athlete_seen_at: null, ...extra })
const coachMsg = (id, extra) => ({ id, sender_role: 'coach', content: 'Hej', read_at: null, ...extra })

test('video meldt læst forbliver læst, når næste hentning mangler athlete_seen_at', () => {
  const id = 'synthetic-r1'
  noteSharedVideos(id, [video('v1')])
  noteReadVideos(id, ['v1'])
  assert.equal(unreadVideoCount(id), 0)
  noteSharedVideos(id, [video('v1')])
  assert.equal(unreadVideoCount(id), 0)
})

test('en helt ny video viser stadig linjen efter en hentning', () => {
  const id = 'synthetic-r2'
  noteSharedVideos(id, [video('v1')])
  noteReadVideos(id, ['v1'])
  noteSharedVideos(id, [video('v1'), video('v2')])
  assert.equal(unreadVideoCount(id), 1)
})

test('video meldt læst, før hentningen kommer, forbliver læst', () => {
  const id = 'synthetic-r3'
  noteReadVideos(id, ['v1'])
  noteSharedVideos(id, [video('v1')])
  assert.equal(unreadVideoCount(id), 0)
})

test('besked meldt læst forbliver læst, selv om en senere opgørelse ikke længere nævner den', () => {
  const id = 'synthetic-r4'
  noteReadMessages(id, ['m1'])
  noteReadMessages(id, [])
  assert.equal(unreadCoachCount([coachMsg('m1')], id), 0)
  assert.equal(unreadCoachCount([coachMsg('m1'), coachMsg('m2')], id), 1)
})
