import test from 'node:test'
import assert from 'node:assert/strict'
import { load } from './load.mjs'
import { weeklyLoad } from '../analysis/weeklyLoad.mjs'

const asOf = '2026-11-04'
const dates = ['2026-10-08', '2026-10-15', '2026-10-22', '2026-10-29']
const row = (logged_at, weight = 100, extra = {}) => ({ logged_at, weight,
  reps_completed: 5, ...extra })
const four = () => dates.map(day => row(day))
const at = (result, date) => result.days.find(day => day.date === date)
const ratings = weights => dates.map((day, i) => row(day, weights[i], { reps_completed: 1 }))

test('empty snapshot: complete day/week axes, zero totals, null evidence', () => {
  const result = load([], asOf)
  assert.equal(result.days.length, 28)
  assert.equal(result.days[0].date, '2026-10-08')
  assert.equal(result.days.at(-1).date, asOf)
  assert.ok(result.days.every(day => day.tonnage === 0 && day.sets === 0 && day.averageRpe === null))
  assert.ok(result.weeks.every(week => week.tonnage === 0))
  for (const key of ['acuteLoad', 'chronicLoad', 'acuteChronicRatio', 'signal']) assert.equal(result[key], null)
})

test('sums actual completed sets daily and reuses existing calendar-week output', () => {
  const logs = four()
  logs.push(row(dates[3], '50,5', { reps_completed: '10', sets: 99 }))
  const result = load(logs, asOf)
  assert.equal(at(result, dates[3]).tonnage, 1005)
  assert.equal(at(result, dates[3]).sets, 2)
  assert.equal(result.acuteLoad, 1005)
  assert.equal(result.chronicLoad, 626.25)
  assert.equal(result.acuteChronicRatio, 1005 / 626.25)
  assert.deepEqual(result.weeks, weeklyLoad(logs, asOf).weeks)
})

test('missing RPE never suppresses tonnage; only explicit ratings contribute', () => {
  const logs = four()
  logs.push(row(dates[3], 100, { rpe_actual: 8, rpe_source: 'athlete' }),
    row(dates[3], 100, { rpe_actual: 6, rpe_source: 'athlete' }),
    row(dates[3], 100, { rpe_actual: 10, rpe_source: 'planned' }))
  const result = load(logs, asOf)
  assert.equal(at(result, dates[3]).tonnage, 2000)
  assert.equal(at(result, dates[3]).rpeCount, 2)
  assert.equal(at(result, dates[3]).averageRpe, 7)
  assert.equal(result.signal, 'belastningsspring')
})

test('rolling 7/28 windows include their first day and exclude previous/future days', () => {
  const logs = four().concat(row('2026-10-07', 999), row('2026-11-05', 999),
    row('2026-10-28', 10), row('2026-11-04', 20))
  const result = load(logs, asOf)
  assert.equal(result.acuteLoad, 600)
  assert.equal(result.chronicLoad, 537.5)
  assert.equal(result.acuteChronicRatio, 600 / 537.5)
})

test('only one week and missing historical bucket leave chronic, ratio and signal null', () => {
  for (const logs of [[row(asOf)], four().filter((_, i) => i !== 1)]) {
    const result = load(logs, asOf)
    assert.equal(result.acuteLoad, 500)
    assert.equal(result.chronicLoad, null)
    assert.equal(result.acuteChronicRatio, null)
    assert.equal(result.signal, null)
  }
})

test('strict threshold edges and stable history', () => {
  for (const [weights, ratio, signal] of [
    [[5, 5, 5, 9], 1.5, 'normal'],
    [[4, 4, 4, 3], 0.8, 'normal'],
    [[5, 5, 5, 10], 1.6, 'belastningsspring'],
    [[4, 4, 4, 2], 8 / 14, 'belastningsspring'],
    [[5, 5, 5, 5], 1, 'normal'],
  ]) {
    const result = load(ratings(weights), asOf)
    assert.equal(result.acuteChronicRatio, ratio)
    assert.equal(result.signal, signal)
  }
})

test('measured zero is distinct from missing records and zero denominator', () => {
  const zero = load(ratings([0, 0, 0, 0]), asOf)
  assert.equal(zero.acuteLoad, 0)
  assert.equal(zero.chronicLoad, 0)
  assert.equal(zero.acuteChronicRatio, null)
  assert.equal(zero.signal, null)
  const low = load(ratings([5, 5, 5, 0]), asOf)
  assert.equal(low.acuteChronicRatio, 0)
  assert.equal(low.signal, 'belastningsspring')
  const absent = load(four().slice(0, 3), asOf)
  assert.equal(absent.acuteLoad, null)
  assert.equal(absent.signal, null)
})

test('bad measurements suppress affected windows without tainting unrelated days', () => {
  for (const bad of [{ weight: null }, { weight: -1 }, { reps_completed: 0 },
    { reps_completed: 1.5 }, { weight: Infinity }, { weight: Number.MAX_VALUE }]) {
    const logs = four().concat(row(dates[0], 100, bad))
    const result = load(logs, asOf)
    assert.equal(at(result, dates[0]).tonnage, null)
    assert.equal(at(result, dates[1]).tonnage, 500)
    assert.equal(result.acuteLoad, 500)
    assert.equal(result.chronicLoad, null)
    assert.equal(result.signal, null)
  }
  const logs = four(); logs[3].weight = null
  assert.equal(load(logs, asOf).acuteLoad, null)
})

test('overflow across individually finite days produces null', () => {
  const logs = ratings([1e308, 1e308, 1e308, 1e308])
  const result = load(logs, asOf)
  assert.equal(result.acuteLoad, 1e308)
  assert.equal(result.chronicLoad, null)
  assert.equal(result.signal, null)
})

test('Danish Sunday/Monday boundary, DST and exact instant cutoff', () => {
  const logs = [row('2026-11-01T22:59:59Z'), row('2026-11-01T23:00:00Z'),
    row('2026-11-02T12:00:01Z'), row('2026-11-02T12:00:00Z')]
  const result = load(logs, '2026-11-02T12:00:00Z')
  assert.equal(at(result, '2026-11-01').tonnage, 500)
  assert.equal(at(result, '2026-11-02').tonnage, 1000)
  assert.equal(result.weeks[2].tonnage, 500)
  assert.equal(result.weeks[3].tonnage, 1000)
  const dst = load([row('2026-10-24T22:30:00Z'), row('2026-10-25T22:30:00Z')], '2026-10-26')
  assert.equal(at(dst, '2026-10-25').tonnage, 1000)
  const summer = load([row('2026-06-07T22:00:00Z')], '2026-06-08')
  assert.equal(at(summer, '2026-06-08').tonnage, 500)
})

test('invalid inputs and timestamps use upstream validation', () => {
  for (const anchor of [undefined, null, {}, 0, '', '2026-02-30',
    '2026-11-04T12:00:00', new Date(NaN)]) assert.equal(load([], anchor), null)
  for (const logs of [undefined, null, {}]) assert.equal(load(logs, asOf), null)
  const bad = [null, '', '2026-02-30', '2026-11-02T24:00:00Z', '2026-11-02T10:00:00',
    '2026-11-02T12:00:00+01:99', '2026-11-05']
  assert.equal(load(bad.map(date => row(date)), asOf).acuteLoad, null)
})

test('leap/year transitions and Date anchors have no host timezone arithmetic', () => {
  assert.equal(at(load([row('2024-02-29')], '2024-03-01'), '2024-02-29').tonnage, 500)
  const result = load([row('2025-12-31'), row('2026-01-01')], new Date('2026-01-01T12:00:00Z'))
  assert.equal(result.days.at(-1).date, '2026-01-01')
  assert.equal(result.weeks[3].start, '2025-12-29')
  assert.equal(result.acuteLoad, 1000)
})

test('duplicates, cross-day identity conflicts, skipped and pending rows agree with weeklyLoad', () => {
  const saved = row(dates[3], 100, { id: 'set-1' })
  const logs = [saved, { ...saved }, row(dates[3], 200, { skipped: true }),
    row(dates[3], 200, { _optimistic: true }), null, []]
  assert.equal(load(logs, asOf).acuteLoad, 500)
  for (const identity of [{ id: 'set-1' }, { exercise_id: 'ex', set_number: 1 }]) {
    const a = row(dates[3], 100, identity), b = { ...a, logged_at: asOf }
    const result = load([a, b], asOf)
    assert.ok(result.days.every(day => day.sets === 0))
    assert.ok(result.weeks.every(week => week.sets === 0))
  }
})

test('pure, frozen input preserved, fresh results and permutation invariant', () => {
  const logs = Object.freeze(four().map(row => Object.freeze(row)))
  const before = JSON.stringify(logs), first = load(logs, asOf)
  assert.deepEqual(first, load([...logs].reverse(), asOf))
  first.days[0].tonnage = -100; first.weeks[0].tonnage = -100
  const second = load(logs, asOf)
  assert.equal(second.days[0].tonnage, 500)
  assert.equal(second.weeks[0].tonnage, 500)
  assert.equal(JSON.stringify(logs), before)
})
