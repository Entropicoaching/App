import test from 'node:test'
import assert from 'node:assert/strict'
import { weeklyLoad } from './weeklyLoad.mjs'

const asOf = '2026-11-04'
const days = ['2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02']
const row = (logged_at, weight = 100, extra = {}) => ({ logged_at, weight,
  reps_completed: 5, ...extra })
const four = () => days.map(day => row(day))
const current = result => result.weeks[3]

test('sums actual per-set reps × kg; no planned sets multiplier or heavy-set filter', () => {
  const logs = four()
  logs.push(row(days[3], '50,5', { reps_completed: '10', sets: 99,
    exercises: { name: 'Accessory', sessions: { weeks: { block_name: 'Deload' } } } }))
  const result = weeklyLoad(logs, asOf)
  assert.equal(current(result).sets, 2)
  assert.equal(current(result).tonnage, 1005)
  assert.equal(result.chronicLoad, 500)
  assert.equal(result.acuteChronicRatio, 2.01)
})

test('chronic mean uses exactly the preceding three calendar weeks', () => {
  const logs = days.map((d, i) => row(d, (i + 1) * 100))
  logs.push(row('2026-10-11', 999), row('2026-11-09', 999))
  const result = weeklyLoad(logs, asOf)
  assert.deepEqual(result.weeks.map(w => w.tonnage), [500, 1000, 1500, 2000])
  assert.equal(result.chronicLoad, 1000)
  assert.equal(result.acuteChronicRatio, 2)
})

test('empty weeks and insufficient consecutive history leave ratio null', () => {
  const empty = weeklyLoad([], asOf)
  assert.deepEqual(empty.weeks.map(w => [w.sets, w.tonnage, w.averageRpe]),
    Array.from({ length: 4 }, () => [0, 0, null]))
  assert.equal(empty.chronicLoad, null)
  for (let missing = 0; missing < 4; missing++) {
    const result = weeklyLoad(four().filter((_, i) => i !== missing), asOf)
    assert.equal(result.acuteChronicRatio, null)
  }
})

test('missing RPE does not dilute average or suppress tonnage; no inferred RPE', () => {
  const logs = four()
  logs.push(row(days[3], 100, { rpe_actual: 8, rpe_source: 'athlete' }),
    row(days[3], 100, { rpe: 6, rpe_source: 'athlete' }),
    row(days[3], 100, { rpe_actual: 10 }),
    row(days[3], 100, { rpe_actual: 9, rpe_source: 'planned' }))
  const result = weeklyLoad(logs, asOf)
  assert.equal(current(result).averageRpe, 7)
  assert.equal(current(result).rpeCount, 2)
  assert.equal(current(result).tonnage, 2500)
  assert.equal(result.acuteChronicRatio, 5)
})

test('RPE note provenance is read from actual imported helper', () => {
  const log = row(days[3], 100, { rpe_actual: 7.5 })
  log.note = '\n[appData2-rpe-v1:' + JSON.stringify([7.5, 100, 5, days[3]]) + ']'
  assert.equal(current(weeklyLoad([log], asOf)).averageRpe, 7.5)
  log.weight = 101
  assert.equal(current(weeklyLoad([log], asOf)).averageRpe, null)
})

test('invalid RPE is omitted, including strings, nonfinite and out of range', () => {
  for (const rpe_actual of [null, undefined, '', '8', -1, 11, NaN, Infinity]) {
    assert.equal(current(weeklyLoad([row(days[3], 100, { rpe_actual, rpe_source: 'athlete' })], asOf)).averageRpe, null)
  }
  assert.equal(current(weeklyLoad([row(days[3], 100, { rpe_actual: 0, rpe_source: 'athlete' })], asOf)).averageRpe, 0)
})

test('Sunday/Monday uses Danish midnight and does not depend on host timezone', () => {
  const result = weeklyLoad([
    row('2026-11-01T22:59:59Z'), row('2026-11-01T23:00:00Z'),
  ], '2026-11-02T00:30:00+01:00')
  assert.equal(result.weeks[2].sets, 1)
  assert.equal(current(result).sets, 1)
  assert.equal(current(result).start, '2026-11-02')
  const summer = weeklyLoad([row('2026-06-07T22:00:00Z')], '2026-06-08')
  assert.equal(current(summer).sets, 1)
})

test('year boundary, leap day and explicit Date anchor', () => {
  const result = weeklyLoad([row('2025-12-31'), row('2026-01-01')], new Date('2026-01-01T12:00:00Z'))
  assert.equal(current(result).start, '2025-12-29')
  assert.equal(current(result).end, '2026-01-04')
  assert.equal(current(result).tonnage, 1000)
  assert.equal(current(weeklyLoad([row('2024-02-29')], '2024-03-01')).sets, 1)
})

test('rejects invalid, timezone-free and future timestamps including later today', () => {
  const bad = [null, '', '2026-02-30', '2026-11-02T24:00:00Z',
    '2026-11-02T10:60:00Z', '2026-11-02T10:00:00', '2026-11-02T10:00:00+01:99',
    '2026-11-05', '2026-11-04T13:00:00Z']
  const result = weeklyLoad(bad.map(d => row(d)), '2026-11-04T12:00:00Z')
  assert.equal(current(result).sets, 0)
  assert.equal(weeklyLoad([], '2026-02-30'), null)
  for (const anchor of [undefined, null, 0, {}, new Date(NaN), '2026-11-04T12:00:00'])
    assert.equal(weeklyLoad([], anchor), null)
  for (const logs of [undefined, null, {}]) assert.equal(weeklyLoad(logs, asOf), null)
})

test('missing/invalid measurements taint total, rather than implying zero load', () => {
  const bad = [{ weight: null }, { weight: -1 }, { weight: Infinity }, { weight: '' },
    { reps_completed: 0 }, { reps_completed: 1.5 }, { reps_completed: null },
    { weight: Number.MAX_VALUE }, { reps_completed: Number.MAX_SAFE_INTEGER + 1 }]
  for (const change of bad) {
    const logs = four(); logs.push(row(days[3], 100, change))
    const result = weeklyLoad(logs, asOf)
    assert.equal(current(result).tonnage, null)
    assert.equal(result.acuteChronicRatio, null)
  }
  const prior = four(); prior[1].weight = null
  assert.equal(weeklyLoad(prior, asOf).chronicLoad, null)
})

test('zero load is measurable but a zero chronic denominator never divides', () => {
  assert.equal(weeklyLoad(days.map(d => row(d, 0)), asOf).acuteChronicRatio, null)
  const logs = four(); logs[3].weight = 0
  assert.equal(weeklyLoad(logs, asOf).acuteChronicRatio, 0)
})

test('skipped/pending rows omitted; exact copies count once and conflicts count neither', () => {
  const saved = row(days[3], 100, { id: 'set-1' })
  const logs = [saved, { ...saved }, row(days[3], 200, { skipped: true }),
    row(days[3], 200, { _optimistic: true }), null, []]
  assert.equal(current(weeklyLoad(logs, asOf)).tonnage, 500)
  for (const identity of [{ id: 'set-1' }, { exercise_id: 'ex', set_number: 1 }, { exercise_id: 'ex' }]) {
    const a = row(days[3], 100, identity), b = { ...a, weight: 101 }
    assert.equal(current(weeklyLoad([a, b], asOf)).sets, 0)
    assert.equal(current(weeklyLoad([a, { ...a }], asOf)).sets, 1)
  }
})

test('pure: frozen input preserved, fresh outputs, repeatable and permutation invariant', () => {
  const logs = four().map(r => Object.freeze(r)); Object.freeze(logs)
  const snapshot = JSON.stringify(logs), first = weeklyLoad(logs, asOf)
  assert.deepEqual(first, weeklyLoad([...logs].reverse(), asOf))
  first.weeks[0].tonnage = 0
  assert.equal(weeklyLoad(logs, asOf).weeks[0].tonnage, 500)
  assert.equal(JSON.stringify(logs), snapshot)
})
