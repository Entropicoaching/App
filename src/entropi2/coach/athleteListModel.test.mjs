import test from 'node:test'
import assert from 'node:assert/strict'
import { coachAthleteList, MISSING_LOG_DAYS, PROGRAM_END_SOON_DAYS } from './athleteListModel.mjs'

const today = '2026-11-03'
const list = athletes => coachAthleteList({ athletes, today })

test('all athletes appear once in the fixed attention order with one short reason', () => {
  const athletes = [
    { id: 'quiet' },
    { id: 'ending', programEndDay: '2026-11-10' },
    { id: 'message', unreadMessages: 2 },
    { id: 'log', lastLogDay: '2026-10-31' },
    { id: 'deviation', deviationReported: true },
    { id: 'pain', painReported: true },
  ]
  const rows = list(athletes)
  assert.deepEqual(rows.map(r => r.athlete.id), ['deviation', 'pain', 'log', 'message', 'ending', 'quiet'])
  assert.deepEqual(rows.map(r => r.reason), ['Afvigelse meldt', 'Smerte meldt', 'Ingen log i 3 dage',
    '2 ulæste beskeder', 'Programmet slutter om 7 dage', 'Intet bekræftet opfølgningssignal'])
  assert.deepEqual(rows.map(r => r.priority), [0, 0, 1, 2, 3, 4])
  for (const row of rows) {
    assert.equal(typeof row.reason, 'string')
    assert.equal(row.reason.includes('\n'), false)
    assert.ok(row.reason.length < 80)
    assert.equal('reasons' in row, false)
  }
})

test('highest rule wins when several signals belong to one athlete', () => {
  const facts = { painReported: true, deviationReported: true, lastLogDay: '2026-10-01',
    unreadMessages: 1, programEndDay: today }
  for (const [remove, kind] of [ [null, 'pain'], ['painReported', 'deviation'],
    ['deviationReported', 'missing-log'], ['lastLogDay', 'unread'], ['unreadMessages', 'program-end'] ]) {
    if (remove) delete facts[remove]
    const rows = list([facts])
    assert.equal(rows.length, 1)
    assert.equal(rows[0].kind, kind)
  }
})

test('inactivity boundary, year/month boundary and future logs', () => {
  assert.equal(MISSING_LOG_DAYS, 3)
  for (const [lastLogDay, kind] of [ ['2026-11-01', 'none'], ['2026-10-31', 'missing-log'],
    [today, 'none'], ['2026-11-04', 'none'] ]) {
    assert.equal(list([{ lastLogDay }])[0].kind, kind)
  }
  assert.equal(coachAthleteList({ today: '2027-01-02', athletes: [{ lastLogDay: '2026-12-30' }] })[0].reason,
    'Ingen log i 3 dage')
})

test('program end includes seven days, today and overdue; eight days stays quiet', () => {
  assert.equal(PROGRAM_END_SOON_DAYS, 7)
  for (const [programEndDay, reason] of [ ['2026-11-11', 'Intet bekræftet opfølgningssignal'],
    ['2026-11-10', 'Programmet slutter om 7 dage'], ['2026-11-04', 'Programmet slutter om 1 dag'],
    [today, 'Programmet slutter i dag'], ['2026-11-02', 'Programmet er udløbet'] ]) {
    assert.equal(list([{ programEndDay }])[0].reason, reason)
  }
})

test('unknown and malformed dates never create inactivity or program signals', () => {
  for (const value of [undefined, null, '', false, 0, new Date(today), '2026-02-29',
    '2026-11-31', '2026-13-01', '2026-1-01', '2026-11-03T00:00:00Z', 'bad']) {
    assert.equal(list([{ lastLogDay: value, programEndDay: value }])[0].kind, 'none')
  }
})

test('only explicit report booleans and positive integer unread counts trigger', () => {
  for (const value of [undefined, null, false, 0, -1, 1.5, NaN, Infinity, '1', 'true', {}, []]) {
    assert.equal(list([{ painReported: value, deviationReported: value, unreadMessages: value }])[0].kind, 'none')
  }
  assert.equal(list([{ unreadMessages: 1 }])[0].reason, '1 ulæst besked')
  assert.equal(list([{ unreadMessages: Number.MAX_SAFE_INTEGER + 1 }])[0].kind, 'none')
})

test('frozen inputs, duplicate names and equal priorities retain identity and roster order', () => {
  const athletes = Object.freeze(['z', 'a', 'm'].map(id => Object.freeze({ id, name: 'Samme', unreadMessages: 1 })))
  const rows = list(athletes)
  assert.deepEqual(rows.map(r => r.athlete), athletes)
  athletes.forEach((athlete, index) => assert.equal(rows[index].athlete, athlete))
  assert.notEqual(rows, athletes)
  assert.deepEqual(list(athletes), rows)
})

test('empty roster and invalid caller contract', () => {
  assert.deepEqual(coachAthleteList({ today }), [])
  for (const value of [undefined, null, '', '2026-02-29', '2026-11-03T12:00:00Z']) {
    assert.throws(() => coachAthleteList({ today: value }), TypeError)
  }
  for (const athletes of [null, {}, 'bad', [null], [1], [[]], Array(1)]) {
    assert.throws(() => coachAthleteList({ today, athletes }), TypeError)
  }
})
