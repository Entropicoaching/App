import test from 'node:test'
import assert from 'node:assert/strict'
import { timestampContent } from './entropi2/conversation/conversationModel.mjs'
import { markerReplyPreview, markerReplyContent } from './videoMarkerReplies.mjs'
import { latestContact as baseContact } from './nytBasePrototype.mjs'
import { latestContact as simpleContact } from './athlete/enkelPrototype.mjs'
import { contactSummary } from './athlete/athleteShortcuts.mjs'
import { buildCoachPriorityItems } from './coachPriority.js'
import { coachHomeModel } from './entropi2/coach/coachModel.mjs'
import { weekEvaluation } from './entropi2/coach/evaluering/evaluationModel.mjs'
import { syntheticWeek } from './entropi2/coach/evaluering/syntheticFixture.mjs'

const athlete = Object.freeze({ id: 'synthetic-athlete', name: 'Syntetisk atlet' })
const visible = 'Video ved 3,5 s\nHold brystet oppe.'
const content = timestampContent({ id: 'synthetic-video' }, 3.5, 'Hold brystet oppe.')
const message = Object.freeze({ id: 'synthetic-message', athlete_id: athlete.id, sender_role: 'coach', category: 'teknik',
  created_at: '2026-10-30T12:00:00Z', content: content.replaceAll('\n', '\r\n') + ' \r\n' })
const expected = visible.replaceAll('\n', '\r\n')

test('all shared legacy inbox renderers hide timed metadata with marker replies OFF or ON', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  try {
    for (const flag of [null, '1']) {
      Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => flag } })
      assert.equal(markerReplyPreview(message), expected)
      const reply = { sender_role: 'athlete', category: 'teknik', athlete_id: athlete.id,
        content: markerReplyContent({ athleteId: athlete.id, analysisId: 'synthetic-video' }, { id: 'marker', start: 2 }, 'Et spørgsmål') }
      assert.equal(markerReplyPreview(reply), flag === '1' ? 'Svar til videomarkering ved 2.00 s: Et spørgsmål' : reply.content)
    }
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original)
    else delete globalThis.localStorage
  }
})

test('both prototype home previews and shortcuts strip metadata before truncation', () => {
  for (const fn of [baseContact, simpleContact, contactSummary]) {
    assert.equal(fn([message], []).text, expected)
    assert.equal(fn([message], []).track, 'teknik')
    const ordinary = { ...message, category: 'besked' }
    const result = fn([ordinary], []).text
    assert.match(result, /Video-id: synthetic-video/)
    const long = { ...message, content: timestampContent({ id: 'synthetic-video' }, 0, 'x'.repeat(180)) }
    assert.doesNotMatch(fn([long], []).text, /Video-id:|synthetic-video/)
  }
  assert.equal(message.content, content.replaceAll('\n', '\r\n') + ' \r\n')
})

test('coach priority cards preserve identity and counts while showing clean text', () => {
  const items = buildCoachPriorityItems({ athletes: [athlete], trainingSignals: [],
    unreadByTrack: { [athlete.id]: { teknik: 1 } }, latestByTrack: { [athlete.id]: { teknik: message } },
    videoReviewQueue: [], describeVideo: () => assert.fail('No video') })
  assert.equal(items.length, 1)
  assert.equal(items[0].detail, expected)
  assert.equal(items[0].key, `message-${athlete.id}-teknik`)
  assert.equal(items[0].count, 1)
})

test('Entropi 2 coach home uses the same display rule over existing scoped reads', () => {
  const day = '2026-11-03', owner = 'synthetic-owner'
  const receipt = { day, ids: [athlete.id], state: 'ready', rows: [message] }
  const model = coachHomeModel({ session: { user: { id: owner } }, athletes: [athlete],
    readContext: { coachId: owner, day, athleteIds: [athlete.id] },
    coachMorningData: { messages: receipt },
    latestByTrack: { [athlete.id]: { teknik: message } }, unreadByTrack: { [athlete.id]: { teknik: 1 } } }, day)
  assert.equal(model.inbox.length, 1)
  assert.equal(model.inbox[0].item.detail, expected)
  assert.equal(model.inbox[0].item.key, `message-${athlete.id}-teknik`)
})

test('evaluation timeline strips display metadata without mutating source receipts', () => {
  const input = syntheticWeek()
  input.messages.rows = [message]
  const original = JSON.stringify(input)
  const model = weekEvaluation(input)
  const entry = model.notes.entries.find(n => n.key === `message-${message.id}`)
  assert.equal(entry.text, expected)
  assert.equal(entry.title, 'Coach')
  assert.equal(JSON.stringify(input), original)
})
