// Separate review probes against the actual module, using synthetic facts only.
import test from 'node:test'
import assert from 'node:assert/strict'
import { coachAthleteList } from './athleteListModel.mjs'

test('review: every combination of five attention signals obeys the rule order', () => {
  const athletes = Array.from({ length: 32 }, (_, mask) => ({
    id: `synthetic-${mask}`, painReported: Boolean(mask & 1),
    deviationReported: Boolean(mask & 2),
    lastLogDay: mask & 4 ? '2026-10-31' : '2026-11-03',
    unreadMessages: mask & 8 ? 1 : 0,
    programEndDay: mask & 16 ? '2026-11-10' : '2026-11-11',
  }))
  const expectedPriority = mask => mask & 3 ? 0 : mask & 4 ? 1 : mask & 8 ? 2 : mask & 16 ? 3 : 4
  const before = structuredClone(athletes)
  const rows = coachAthleteList({ athletes, today: '2026-11-03' })
  const expectedIds = Array.from({ length: 32 }, (_, i) => i)
    .sort((a, b) => expectedPriority(a) - expectedPriority(b))
    .map(i => `synthetic-${i}`)
  assert.deepEqual(rows.map(row => row.athlete.id), expectedIds)
  assert.equal(new Set(rows.map(row => row.athlete)).size, 32)
  for (const row of rows) {
    const mask = Number(row.athlete.id.split('-')[1])
    assert.equal(row.priority, expectedPriority(mask))
    assert.equal(row.kind, mask & 1 ? 'pain' : mask & 2 ? 'deviation' : mask & 4 ? 'missing-log'
      : mask & 8 ? 'unread' : mask & 16 ? 'program-end' : 'none')
  }
  assert.deepEqual(athletes, before)
})

test('review: calendar-day thresholds hold across leap day and both DST changes', () => {
  for (const [today, lastLogDay, programEndDay] of [
    ['2028-03-02', '2028-02-28', '2028-03-09'],
    ['2026-03-30', '2026-03-27', '2026-04-06'],
    ['2026-10-26', '2026-10-23', '2026-11-02'],
  ]) {
    const rows = coachAthleteList({ today, athletes: [{ lastLogDay }, { programEndDay }] })
    assert.equal(rows[0].reason, 'Ingen log i 3 dage')
    assert.equal(rows[1].reason, 'Programmet slutter om 7 dage')
  }
})

test('review: unknown facts do not suppress a separate confirmed signal', () => {
  const rows = coachAthleteList({ today: '2026-11-03', athletes: [
    { lastLogDay: '2026-02-30', unreadMessages: 1 },
    { painReported: 'true', deviationReported: true, programEndDay: 'invalid' },
    { lastLogDay: '2026-11-04', unreadMessages: '5', programEndDay: '2026-11-03' },
  ] })
  assert.deepEqual(rows.map(row => row.kind), ['deviation', 'unread', 'program-end'])
})
