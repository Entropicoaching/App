import test from 'node:test'
import assert from 'node:assert/strict'
import { buildPainHistory } from './painModel.mjs'

const row = (day, pain, painLocation = 'Testknæ') => ({ day, pain, painLocation, source: 'athlete_manual' })
const data = daily => ({ state: 'ready', complete: true, athleteId: 'synthetic-athlete', asOf: '2026-11-04', daily })
const run = (daily, extra = {}) => buildPainHistory({ enabled: true, weeks: 4, data: data(daily), ...extra })
const trendRows = () => [row('2026-10-08', 2), row('2026-10-15', 2), row('2026-10-21', 2),
  row('2026-10-22', 4), row('2026-10-29', 4), row('2026-11-04', 4)]

test('OFF is literal opt-in and never reads data', () => {
  for (const enabled of [undefined, false, null, 'true', 1]) {
    const options = { enabled, get data() { throw Error('OFF read') } }
    assert.deepEqual(buildPainHistory(options), { state: 'off' })
  }
  assert.deepEqual(buildPainHistory(null), { state: 'off' })
})

test('4–8 week inclusive date windows; leap day and invalid configuration', () => {
  for (let weeks = 4; weeks <= 8; weeks++) {
    const result = run([], { weeks })
    assert.equal(result.weeks, weeks)
    assert.equal(result.absentDays, weeks * 7)
    assert.equal(result.state, 'empty')
  }
  assert.equal(run([]).from, '2026-10-08')
  assert.equal(run([], { weeks: 8 }).from, '2026-09-10')
  const leap = run([], { data: { ...data([]), asOf: '2024-03-27' } })
  assert.equal(leap.from, '2024-02-29')
  for (const weeks of [3, 9, 4.5, null, '4', NaN]) assert.equal(run([], { weeks }).state, 'error')
  for (const asOf of ['2026-02-30', '2026-1-01', '2026-11-04T12:00:00Z', null]) {
    assert.equal(run([], { data: { ...data([]), asOf } }).state, 'error')
  }
})

test('zero is an observation only for the named area; legacy soreness is never converted', () => {
  const result = run([row('2026-11-01', 0), row('2026-11-02', 0, null),
    { day: '2026-11-03', source: 'athlete_manual', soreness_level: 5, sore_zones: ['Ryg'] }])
  assert.equal(result.areas.length, 1)
  assert.deepEqual(result.areas[0].latest, { day: '2026-11-01', value: 0 })
  assert.equal(result.areas[0].history.at(-1).average, 0)
  assert.equal(result.areas[0].history[0].average, null)
  assert.equal(result.unlocatedDays, 1)
  assert.equal(result.missingDays, 1)
  assert.equal(result.absentDays, 25)
})

test('7+ includes historical dates and 10; 6 has no high flag; areas remain separate', () => {
  const result = run([row('2026-10-07', 10), row('2026-10-08', 7), row('2026-11-01', 10),
    row('2026-11-02', 1), row('2026-11-03', 6, 'Testryg'), row('2026-11-05', 10)])
  assert.equal(result.areas.length, 2)
  assert.equal(result.areas[0].latest.value, 1)
  assert.deepEqual(result.areas[0].high, [{ day: '2026-10-08', value: 7 }, { day: '2026-11-01', value: 10 }])
  assert.equal(result.areas[1].high.length, 0)
})

test('rising compares disjoint 14 day windows with at least 3 dates in each', () => {
  const area = run(trendRows()).areas[0]
  assert.equal(area.rising, true)
  assert.equal(area.trend.before, 2); assert.equal(area.trend.after, 4)
  assert.equal(area.trend.previousTo, '2026-10-21'); assert.equal(area.trend.recentFrom, '2026-10-22')
  for (const changed of [trendRows().slice(1), trendRows().slice(0, -1),
    trendRows().map(r => ({ ...r, pain: r.day >= '2026-10-22' ? 3 : 2 })),
    trendRows().map(r => ({ ...r, pain: r.day >= '2026-10-22' ? 1 : 2 }))]) {
    assert.equal(run(changed).areas[0].rising, false)
  }
  assert.equal(run(trendRows(), { weeks: 8 }).areas[0].rising, true)
  const separate = trendRows().map(r => r.day >= '2026-10-22' ? { ...r, painLocation: 'Testryg' } : r)
  assert.ok(run(separate).areas.every(a => !a.rising))
})

test('bad source, mixed athletes, duplicate days, invalid scores and sparse arrays fail closed', () => {
  const good = row('2026-11-01', 7)
  const invalid = [null, [], { ...good, source: 'watch' }, { ...good, day: '2026-02-30' },
    { ...good, athleteId: 'other' }, { ...good, athlete_id: 'other' },
    ...[-1, 11, 1.5, NaN, Infinity, '7', true].map(pain => ({ ...good, pain })),
    ...[null, '', ' ', 3, 'x'.repeat(121)].map(painLocation => ({ ...good, painLocation }))]
  for (const bad of invalid) assert.equal(run([bad]).state, 'error')
  assert.equal(run([good, good]).state, 'error')
  assert.equal(run(Array(2)).state, 'error')
  for (const value of [null, {}, 'invalid', Array(10001)]) {
    assert.equal(run([], { data: data(value) }).state, 'error')
  }
  for (const extra of [{ state: 'error' }, { complete: false }, { athleteId: '' }]) {
    assert.equal(run([], { data: { ...data([]), ...extra } }).state, 'error')
  }
  assert.equal(run([], { data: { state: 'loading' } }).state, 'loading')
})

test('input is immutable, arbitrary private properties are not read or emitted', () => {
  const rows = trendRows().reverse().map(r => Object.freeze({ ...r,
    get cycle() { throw Error('private read') } }))
  const input = Object.freeze({ ...data(Object.freeze(rows)), get privateNotes() { throw Error('private read') } })
  const result = run([], { data: input })
  assert.equal(result.areas[0].rising, true)
  assert.doesNotMatch(JSON.stringify(result), /cycle|privateNotes|synthetic-athlete/)
  result.areas[0].observations[0].value = 99
  assert.equal(rows.at(-1).pain, 2)
})
