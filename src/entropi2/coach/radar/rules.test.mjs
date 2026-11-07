import test from 'node:test'
import assert from 'node:assert/strict'
import { RADAR_WEIGHTS, RADAR_RULES, unansweredMessages, unansweredVideos, missedSessions,
  risingRpe, risingPain, fallingReadiness, fallingSleep, endingBlock, upcomingCompetition,
  noRecentLog, rankRadar, shiftDay, trendBasis } from './rules.mjs'
import { DEFAULT_COACH_RADAR, coachRadarEnabled } from './flag.mjs'

const today = '2026-11-06'
const series = (before, after) => [13, 10, 7, 6, 3, 0].map((age, i) => ({ day: shiftDay(today, -age), value: i < 3 ? before : after }))

test('separate default OFF and strict explicit opt-in; OFF never touches data', () => {
  assert.equal(DEFAULT_COACH_RADAR, false)
  for (const value of [undefined, null, false, 1, 'true', '1', {}]) assert.equal(coachRadarEnabled(value), false)
  assert.equal(coachRadarEnabled(true), true)
  assert.deepEqual(rankRadar({ get entries() { throw Error('OFF read') } }), [])
})
for (const [rule, field, key] of [[unansweredMessages, 'pendingMessages', 'messages'], [unansweredVideos, 'pendingVideos', 'videos'], [missedSessions, 'missedSessions', 'missed']]) {
  test(`${key}: pure fixed weight, count and absent/invalid evidence`, () => {
    const input = Object.freeze({ [field]: 2 })
    assert.equal(rule(input).points, RADAR_WEIGHTS[key])
    assert.match(rule(input).reason, /^2 /)
    for (const value of [undefined, null, 0, -1, 1.5, NaN, Infinity, '2']) assert.equal(rule({ [field]: value }), null)
    assert.equal(rule(), null)
  })
}
for (const [rule, field, before, after, key] of [
  [risingRpe, 'rpe', 7, 8, 'rpe'], [fallingReadiness, 'readiness', 80, 70, 'readiness'],
  [fallingSleep, 'sleep', 8, 7, 'sleep'],
]) {
  test(`${key}: exact trend threshold, two windows and insufficient/missing evidence`, () => {
    const values = series(before, after), facts = { [field]: values }
    const previous = JSON.stringify(facts)
    assert.equal(rule(facts, today).points, RADAR_WEIGHTS[key])
    assert.equal(rule({ [field]: [...values].reverse() }, today).reason, rule(facts, today).reason)
    assert.equal(JSON.stringify(facts), previous)
    for (const points of [[], values.slice(1), values.map(p => ({ ...p, value: null })), series(before, before), [...values, values[0]], [...values, { day: shiftDay(today, 1), value: after }]])
      assert.equal(rule({ [field]: points }, today), null)
    assert.equal(rule(facts, '2026-02-30'), null)
    assert.equal(rule({}, today), null)
  })
}
test('pain compares the same named area, never soreness or a different body area', () => {
  const pain = [{ location: 'knæ', points: series(2, 4) }]
  assert.equal(risingPain({ pain }, today).points, 55)
  assert.match(risingPain({ pain }, today).reason, /knæ/)
  assert.equal(risingPain({ pain: [{ location: '', points: series(2, 4) }] }, today), null)
  assert.equal(risingPain({ soreness_level: series(2, 4) }, today), null)
  assert.equal(risingPain({ pain: [
    { location: 'knæ', points: series(2, 4).slice(0, 3) },
    { location: 'ryg', points: series(2, 4).slice(3) },
  ] }, today), null)
  assert.equal(risingPain({ pain: [{ location: 'knæ', points: series(2, 3.9) }] }, today), null)
})
test('trend invalid values, stale samples, future and duplicate days cannot create signals', () => {
  for (const value of [-1, 101, '90', NaN, Infinity]) {
    const points = series(80, 60); points[0].value = value
    assert.equal(fallingReadiness({ readiness: points }, today), null)
  }
  const stale = [13, 12, 10, 6, 5, 3].map((age, i) => ({ day: shiftDay(today, -age), value: i < 3 ? 8 : 6 }))
  assert.equal(fallingSleep({ sleep: stale }, today), null)
  assert.equal(trendBasis(series(8, 7), today, 0, 24, 1, -1).recentDays, 3)
})
for (const [rule, field, window, weight] of [[endingBlock, 'blockEnd', 7, 15], [upcomingCompetition, 'competitionDate', 21, 10]]) {
  test(`${field}: inclusive civil date boundaries, past and unknown dates`, () => {
    for (const days of [0, 1, window]) assert.equal(rule({ [field]: shiftDay(today, days) }, today).points, weight)
    for (const days of [-1, window + 1]) assert.equal(rule({ [field]: shiftDay(today, days) }, today), null)
    for (const date of [null, '2026-02-30', '2026-11-06T00:00:00Z']) assert.equal(rule({ [field]: date }, today), null)
    assert.match(rule({ [field]: today }, today).reason, /i dag/)
  })
}
test('five days without log requires explicit complete absence evidence', () => {
  assert.equal(noRecentLog({ noLogFiveDays: true }).points, 20)
  for (const value of [undefined, null, false, 5, 'true']) assert.equal(noRecentLog({ noLogFiveDays: value }), null)
})
test('all ten rules contribute once; sum, strongest reason and literal ID produce deterministic order', () => {
  assert.equal(RADAR_RULES.length, 10)
  const facts = { pendingMessages: 2, pendingVideos: 2, missedSessions: 1, rpe: series(7, 8),
    pain: [{ location: 'knæ', points: series(2, 4) }], readiness: series(80, 60), sleep: series(8, 6),
    blockEnd: today, competitionDate: today, noLogFiveDays: true }
  const entries = ['synthetic-z', 'synthetic-a'].map(id => ({ athlete: { id, name: 'Syntetisk' }, facts }))
  const before = JSON.stringify(entries), rows = rankRadar({ enabled: true, today, entries })
  assert.deepEqual(rows.map(r => r.athlete.id), ['synthetic-a', 'synthetic-z'])
  assert.equal(rows[0].score, 305)
  assert.equal(rows[0].signals.length, 10)
  assert.match(rows[0].reason, /^Smerte stiger/)
  assert.deepEqual(rankRadar({ enabled: true, today, entries: [...entries].reverse() }), rows)
  assert.equal(JSON.stringify(entries), before)
  assert.deepEqual(rankRadar({ enabled: true, today, entries: [...entries, entries[0]] }).map(r => r.athlete.id), ['synthetic-a'])
  assert.deepEqual(rankRadar({ enabled: true, today, entries: [{ athlete: { id: 'empty' }, facts: {} }] }), [])
})
