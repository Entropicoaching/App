import test from 'node:test'
import assert from 'node:assert/strict'
import { weeklyConversationSummary as summary } from './weeklyConversationSummary.mjs'

const start = '2026-11-02T00:00:00+01:00', end = '2026-11-09T00:00:00+01:00'
const options = { enabled: true, athleteId: 'synthetic-athlete', start, end }
const message = (id, sender_role, created_at, extra = {}) => ({ id, sender_role, created_at,
  athlete_id: options.athleteId, content: 'Syntetisk tekst', ...extra })
const video = (id, extra = {}) => ({ id, athlete_id: options.athleteId, status: 'shared',
  created_at: '2026-10-01T12:00:00Z', shared_at: '2026-11-03T12:00:00Z', ...extra })
const empty = { totalMessages: 0, athleteMessages: 0, coachMessages: 0,
  unansweredMessages: 0, unreadMessages: 0, videoFeedback: 0 }

test('strict OFF never inspects inputs and defaults to OFF', () => {
  assert.equal(summary(), null)
  for (const enabled of [undefined, false, 0, 1, 'true']) {
    const input = { enabled }
    for (const key of ['athleteId', 'start', 'end', 'messages', 'analyses'])
      Object.defineProperty(input, key, { get() { assert.fail('OFF read') } })
    assert.equal(summary(input), null)
  }
})

test('empty loaded snapshot returns zero counts', () => {
  assert.deepEqual(summary(options), empty)
})

test('unsorted conversation separates answered, read and unread messages', () => {
  const messages = [message('last', 'athlete', '2026-11-06T12:00:00Z', { read_by_coach: true }),
    message('reply', 'coach', '2026-11-04T12:00:00Z'),
    message('first', 'athlete', '2026-11-03T12:00:00Z'),
    message('second', 'athlete', '2026-11-03T13:00:00Z')]
  assert.deepEqual(summary({ ...options, messages }), { totalMessages: 4, athleteMessages: 3,
    coachMessages: 1, unansweredMessages: 1, unreadMessages: 2, videoFeedback: 0 })
})

test('start inclusive, end exclusive; future replies cannot erase week-end backlog', () => {
  const messages = [message('before', 'athlete', '2026-11-01T22:59:59Z'),
    message('start', 'athlete', '2026-11-01T23:00:00Z'),
    message('end', 'coach', '2026-11-08T23:00:00Z'),
    message('future', 'coach', '2026-11-09T12:00:00Z')]
  assert.deepEqual(summary({ ...options, messages }), { ...empty, totalMessages: 1,
    athleteMessages: 1, unansweredMessages: 1, unreadMessages: 1 })
})

test('equal timestamps conservatively remain unanswered regardless of IDs or order', () => {
  const messages = [message('z', 'coach', '2026-11-03T12:00:00Z'),
    message('a', 'athlete', '2026-11-03T12:00:00Z')]
  assert.equal(summary({ ...options, messages }).unansweredMessages, 1)
  assert.equal(summary({ ...options, messages: messages.toReversed() }).unansweredMessages, 1)
})

test('actual copied model scopes, validates roles and deduplicates IDs in each collection', () => {
  const messages = [null, message('same', 'athlete', '2026-11-03T12:00:00Z'),
    message('same', 'coach', '2026-11-04T12:00:00Z'),
    message('foreign', 'athlete', start, { athlete_id: 'other' }),
    message('bad id', 'athlete', start), message('role', 'system', start),
    message('content', 'athlete', start, { content: null })]
  const analyses = [video('same'), video('same'), video('other', { athlete_id: 'other' })]
  assert.deepEqual(summary({ ...options, messages, analyses }), { ...empty,
    totalMessages: 1, coachMessages: 1, videoFeedback: 1 })
})

test('video feedback uses shared time and visibility, with legacy timeline fallbacks', () => {
  const analyses = [video('shared'), video('draft', { status: 'draft', source_mode: 'athlete_submission' }),
    video('hidden', { status: 'archived' }), video('old', { shared_at: '2026-11-01T12:00:00Z' }),
    video('end', { shared_at: end }), video('legacy', { shared_at: null, analyzed_at: start }),
    video('created', { shared_at: null, created_at: start })]
  const messages = [message('question', 'athlete', start)]
  assert.deepEqual(summary({ ...options, messages, analyses }), { ...empty,
    totalMessages: 1, athleteMessages: 1, unansweredMessages: 1, unreadMessages: 1, videoFeedback: 3 })
})

test('invalid or timezone-ambiguous row dates do not enter aggregates', () => {
  const dates = [null, 0, '', 'invalid', '2026-11-03', '2026-11-03T12:00:00',
    '2026-11-31T12:00:00Z', '2026-13-03T12:00:00Z']
  assert.deepEqual(summary({ ...options,
    messages: dates.map((date, i) => message(`m${i}`, 'coach', date)),
    analyses: dates.map((date, i) => video(`v${i}`, { shared_at: date, created_at: date })),
  }), empty)
})

test('invalid enabled scope, boundaries or collections fail explicitly', () => {
  for (const patch of [{ athleteId: '' }, { athleteId: 'bad id' }, { start: end },
    { start: '2026-11-10T00:00:00Z' }, { start: '2026-11-02' }, { end: null },
    { start: '2026-02-30T00:00:00Z' }, { messages: null }, { analyses: {} }])
    assert.throws(() => summary({ ...options, ...patch }), TypeError)
})

test('explicit Copenhagen DST week accepts 169 elapsed hours and equivalent offsets', () => {
  const period = { start: '2026-10-19T00:00:00+02:00', end: '2026-10-26T00:00:00+01:00' }
  const messages = [message('a', 'athlete', '2026-10-25T02:30:00+02:00'),
    message('c', 'coach', '2026-10-25T02:30:00+01:00')]
  const result = summary({ ...options, ...period, messages })
  assert.equal(result.totalMessages, 2); assert.equal(result.unansweredMessages, 0)
  assert.deepEqual(summary({ ...options, start: '2026-10-18T22:00:00Z',
    end: '2026-10-25T23:00:00Z', messages }), result)
})

test('frozen inputs stay intact, repeated calls agree and output contains only counters', () => {
  const messages = Object.freeze([Object.freeze(message('one', 'athlete', start))])
  const analyses = Object.freeze([Object.freeze(video('one'))])
  const input = Object.freeze({ ...options, messages, analyses })
  const before = JSON.stringify(input), first = summary(input)
  assert.deepEqual(summary(input), first); assert.equal(JSON.stringify(input), before)
  assert.ok(Object.values(first).every(value => Number.isSafeInteger(value) && value >= 0))
  first.totalMessages = 99
  assert.equal(summary(input).totalMessages, 1)
})
