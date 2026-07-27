import assert from 'node:assert/strict'
import { buildCoachPriorityItems, nextCoachPriorityItem } from '../src/coachPriority.js'

const athletes = [
  { id: 'athlete-a', name: 'Anna' },
  { id: 'athlete-b', name: 'Bo' },
]

const items = buildCoachPriorityItems({
  athletes,
  trainingSignals: [
    { o_athlete_id: 'athlete-a', o_detector: 'stagnation', o_severity: 'context', o_headline: 'Kontekst', o_detail: 'Se udviklingen' },
    { o_athlete_id: 'athlete-b', o_detector: 'dropout', o_severity: 'alert', o_headline: 'Alert', o_detail: 'Kræver handling' },
    { o_athlete_id: 'hidden-athlete', o_detector: 'rpe_drift', o_severity: 'alert', o_headline: 'Skjult', o_detail: 'Må ikke vises' },
  ],
  unreadByTrack: {
    'athlete-a': { besked: 2, teknik: 1 },
    'athlete-b': { besked: 0, teknik: 1 },
  },
  latestByTrack: {
    'athlete-a': {
      besked: { content: 'Nyere besked', created_at: '2026-07-02T08:00:00Z' },
      teknik: { content: 'Ugyldig tid', created_at: 'ikke-en-dato' },
    },
    'athlete-b': {
      besked: { content: 'Læst besked', created_at: '2026-06-01T08:00:00Z' },
      teknik: { content: 'Ældste ulæste', created_at: '2026-07-01T08:00:00Z' },
    },
  },
  videoReviewQueue: [
    { id: 'video-a', athlete_id: 'athlete-a', lift: 'squat', created_at: '2026-06-30T08:00:00Z' },
    { id: 'video-hidden', athlete_id: 'hidden-athlete', lift: 'bench', created_at: '2026-06-01T08:00:00Z' },
  ],
  describeVideo: video => `Video ${video.lift}`,
})

assert.deepEqual(items.map(item => item.key), [
  'signal-athlete-b-dropout-1',
  'message-athlete-b-teknik',
  'message-athlete-a-besked',
  'message-athlete-a-teknik',
  'video-video-a',
  'signal-athlete-a-stagnation-0',
])
assert.equal(items[0].rank, 0, 'alerts must be first')
assert.equal(items[1].detail, 'Ældste ulæste', 'oldest unread message must lead its rank')
assert.equal(items[2].count, 2, 'unread count must be preserved')
assert.equal(items[3].createdAt, 'ikke-en-dato', 'invalid timestamps must sort last without crashing')
assert.equal(items[4].detail, 'Video squat', 'video description must use the supplied formatter')
assert.equal(items.at(-1).rank, 3, 'context signals must be last')
assert.equal(items.some(item => item.athlete.id === 'hidden-athlete'), false, 'items for athletes outside the visible list must be excluded')
assert.equal(items.some(item => item.key === 'message-athlete-b-besked'), false, 'read message tracks must not enter the priority queue')
assert.equal(nextCoachPriorityItem(items, items[0].key)?.key, items[1].key, 'next item must skip the currently open priority item')
assert.equal(nextCoachPriorityItem(items, null)?.key, items[0].key, 'without a current item the queue must start at its first priority')
assert.equal(nextCoachPriorityItem([items[0]], items[0].key), null, 'next item must be absent when only the current item remains')

console.log('OK: coach priority order, age handling and visibility filters are valid')
