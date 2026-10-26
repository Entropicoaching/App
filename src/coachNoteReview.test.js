import test from 'node:test'
import assert from 'node:assert/strict'
import { pendingCoachNotes } from './coachNoteSignal.js'
import { summarizeCoachMessages } from './coachInboxState.js'
import { app } from './coachNoteTestHelpers.mjs'

const message = (id, hour, extra = {}) => ({ id, athlete_id: 'a', category: 'besked',
  sender_role: 'athlete', content: id, created_at: `2026-10-26T${hour}:00:00Z`, ...extra })

test('modproeve: alle tidligere noter afsluttes, flere nye noter taelles', () => {
  const rows = [message('a1', '08'), message('a2', '09'),
    message('svar', '10', { sender_role: 'coach' }), message('a3', '11'), message('a4', '12')]
  const result = pendingCoachNotes(rows).a.besked
  assert.equal(result.count, 2)
  assert.equal(result.latestNote.id, 'a4')
  assert.equal(result.oldestAt, rows[3].created_at)
})

test('modproeve: begge spor og flere atleter holdes adskilt', () => {
  const rows = [message('a', '08'), message('teknik', '09', { category: 'teknik' }),
    message('b', '08', { athlete_id: 'b' }), message('svar', '10', { sender_role: 'coach' })]
  const pending = pendingCoachNotes(rows)
  assert.equal(pending.a.besked, undefined)
  assert.equal(pending.a.teknik.count, 1)
  assert.equal(pending.b.besked.count, 1)
})

test('modproeve: aeldste ubesvarede note styrer koeen, skjult atlet udelades', async () => {
  const load = await app({ enabled: true })
  const { useCoachPrioritet } = await load('src/dashboard/useCoachPrioritet.js')
  const rows = [message('a-old', '08'), message('a-new', '12'), message('b', '10', { athlete_id: 'b' })]
  const summary = summarizeCoachMessages(rows, { noteSignalEnabled: true })
  const options = { athletes: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
    hiddenAthleteIds: new Set(), trainingSignals: [], videoReviewQueue: [], ...summary }
  const items = useCoachPrioritet(options).coachPriorityItems
  assert.equal(items[0].athlete.id, 'a')
  assert.equal(items[0].detail, 'a-new')
  assert.equal(items[0].count, 2)
  const hidden = useCoachPrioritet({ ...options, hiddenAthleteIds: new Set(['a']) }).coachPriorityItems
  assert.equal(hidden.length, 1)
  assert.equal(hidden[0].athlete.id, 'b')
})

test('modproeve: laest-status og pinned aendrer hverken aaben eller afsluttet traad', () => {
  const rows = [message('a', '08', { pinned: true, read_by_coach: false })]
  assert.equal(pendingCoachNotes(rows).a.besked.count, 1)
  rows[0].read_by_coach = true
  assert.equal(pendingCoachNotes(rows).a.besked.count, 1)
  rows.push(message('svar', '09', { sender_role: 'coach', pinned: false }))
  assert.deepEqual(pendingCoachNotes(rows), {})
})
