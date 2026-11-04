import test from 'node:test'
import assert from 'node:assert/strict'
import { compareWeeks, difference } from './compareWeeks.mjs'
import { fixture, freeze, today } from './syntheticFixture.mjs'

const model = p => compareWeeks(p, today)
const metric = (m, key) => m.metrics.find(row => row.key === key)
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`)

test('two weeks use actual copied helpers, raw totals and second-minus-first differences without mutation', () => {
  const p = freeze(fixture()), before = structuredClone(p), m = model(p)
  assert.equal(m.ready, true); assert.deepEqual(p, before)
  assert.equal(m.first.end, '2026-11-01'); assert.equal(m.first.provisional, false)
  assert.equal(m.second.through, today); assert.equal(m.second.provisional, true)
  for (const [key, a, b, delta] of [['sessions', 1, 1, 0], ['sets', 2, 2, 0],
    ['volume', 800, 880, 80], ['rpe', 7.5, 8.5, 1], ['mealDays', 1, 1, 0],
    ['kcal', 1500, 1600, 100], ['protein', 130, 140, 10], ['weight', 80, 85, 5]]) {
    assert.deepEqual(metric(m, key), { key, label: metric(m, key).label, unit: metric(m, key).unit, first: a, second: b, delta })
  }
  close(m.lifts[0].first, 100 * (1 + 5 / 30)); close(m.lifts[0].delta, 10 * (1 + 5 / 30))
})

test('invalid, reversed, overlapping or future dates never produce comparisons', () => {
  for (const snapshot of [null, undefined, {}, false, []]) assert.equal(compareWeeks(snapshot, today).ready, false)
  for (const change of [p => { p.athleteId = '' }, p => { p.first.start = '2026-02-30' },
    p => { p.second.start = p.first.start }, p => { p.first.start = p.second.start },
    p => { p.second.start = '2026-10-30' }, p => { p.second.start = '2026-11-05' },
    p => { delete p.first }, p => { p.second.start = '2026-11-02T00:00:00Z' }]) {
    const p = fixture(); change(p); assert.equal(model(p).ready, false)
  }
  for (const clock of [undefined, null, new Date(), '2026-02-29', '2026-11-04T00:00:00Z'])
    assert.equal(compareWeeks(fixture(), clock).ready, false)
})

test('ready empty sources prove zero counts and volume but never zero e1RM, RPE, energy or weight', () => {
  const p = fixture(); for (const kind of ['training', 'nutrition', 'weight']) p.first[kind].rows = []
  const m = model(p)
  for (const key of ['sessions', 'sets', 'volume', 'mealDays']) assert.equal(metric(m, key).first, 0)
  for (const key of ['rpe', 'kcal', 'protein', 'weight']) {
    assert.equal(metric(m, key).first, null); assert.equal(metric(m, key).delta, null)
  }
  assert.equal(m.first.weight.days, 0); assert.equal(m.lifts[0].first, null)
})

test('incomplete, stale, wrong-athlete, malformed and pending sources remain unknown independently', () => {
  const changes = [s => { s.complete = false }, s => { s.state = 'loading' }, s => { s.state = 'error' },
    s => { s.athleteId = 'other' }, s => { s.from = '2026-10-25' }, s => { s.through = today },
    s => { s.rows = null }, s => { s.rows.push(null) }, s => { s.rows[0].athlete_id = 'other' },
    s => { s.rows[0]._optimistic = true }, s => { delete s.rows[0].id },
    s => { s.rows.push({ ...s.rows[0], weight: 999, kcal: 999 }) }]
  for (const [kind, key] of [['training', 'volume'], ['nutrition', 'mealDays'], ['weight', 'weight']]) {
    for (const change of changes) {
      const p = fixture(); change(p.first[kind]); const m = model(p)
      assert.equal(metric(m, key).first, null, `${kind} ${change}`)
      assert.equal(metric(m, key).delta, null)
      assert.equal(m.second.training.volume, 880)
    }
    const p = fixture(); delete p.first[kind]; assert.equal(metric(model(p), key).first, null)
  }
})

test('exact duplicate IDs count once; ambiguous physical set positions invalidate training', () => {
  const p = fixture()
  for (const kind of ['training', 'nutrition', 'weight']) p.first[kind].rows.push(structuredClone(p.first[kind].rows[0]))
  assert.deepEqual(model(p), model(fixture()))
  p.first.training.rows.push({ ...p.first.training.rows[0], id: 'new-id' })
  assert.equal(model(p).first.training.volume, null)
})

test('skipped sets never count; missing session identity affects only session count', () => {
  const p = fixture(); p.first.training.rows[1].skipped = true
  let m = model(p); assert.equal(m.first.training.volume, 500); assert.equal(m.first.training.rpe, 7)
  assert.equal(m.first.training.sets, 1)
  delete p.first.training.rows[0].exercises.sessions.id
  m = model(p); assert.equal(m.first.training.sessions, null); assert.equal(m.first.training.volume, 500)
  p.first.training.rows[0].skipped = true
  m = model(p); assert.equal(m.first.training.sessions, 0); assert.equal(m.first.training.volume, 0)
})

test('RPE requires athlete provenance; invalid values and defaults are not observations', () => {
  for (const rating of [undefined, '', 'NaN', -1, 11, Infinity]) {
    const p = fixture(); for (const row of p.first.training.rows) row.rpe_actual = rating
    assert.equal(model(p).first.training.rpe, null); assert.equal(model(p).first.training.rpeCount, 0)
  }
  for (const source of [undefined, 'default', 'coach', 'planned']) {
    const p = fixture(); for (const row of p.first.training.rows) row.rpe_source = source
    assert.equal(model(p).first.training.rpe, null)
  }
  const p = fixture(); p.first.training.rows[0].rpe_actual = '7,5'
  assert.equal(model(p).first.training.rpe, 7.75)
})

test('top e1RM separates lift variants and excludes light, high-rep, deload and unknown-block sets', () => {
  for (const change of [r => { r.exercises.name = 'Squat backoff' }, r => { r.reps_completed = 9 },
    r => { r.exercises.sessions.weeks.block_name = 'Deload' }, r => { r.exercises.sessions.weeks.block_name = 'taper' },
    r => { delete r.exercises.sessions.weeks.block_name }]) {
    const p = fixture(); change(p.first.training.rows[0]); assert.equal(model(p).first.training.lifts.length, 0)
    assert.ok(model(p).first.training.volume > 0)
  }
  const p = fixture(); p.second.training.rows[0].exercises.name = 'Front squat'
  const m = model(p); assert.equal(m.lifts.length, 2)
  assert.ok(m.lifts.every(row => row.delta === null))
})

test('nutrition uses daily totals before averaging and excludes day receipts', () => {
  const p = fixture(), rows = p.first.nutrition.rows
  rows.push({ ...rows[0], id: 'third-meal', date: '2026-10-27', kcal: 500, protein: 50 })
  rows.push({ ...rows[0], id: 'receipt', date: '2026-10-28', meal: ' [appData2-day-v1][]', kcal: 99999, protein: 99999 })
  const m = model(p); assert.equal(m.first.nutrition.days, 2)
  assert.equal(m.first.nutrition.kcal, 1000); assert.equal(m.first.nutrition.protein, 90)
  rows[0].protein = ''; assert.equal(model(p).first.nutrition.days, null)
})

test('weight averages distinct unambiguous days; repeats do not overweight a day and conflicts are reported', () => {
  const p = fixture(), rows = p.first.weight.rows
  rows.push({ ...rows[0], id: 'w3', logged_at: '2026-10-27', weight: 82 })
  assert.deepEqual(model(p).first.weight, { days: 2, mean: 81, conflicts: 0 })
  rows.push({ ...rows[0], id: 'w4', weight: 81 })
  assert.deepEqual(model(p).first.weight, { days: 1, mean: 82, conflicts: 1 })
  rows[2].weight = 0; assert.equal(model(p).first.weight.mean, null)
})

test('Danish midnight and DST select civil dates without rolling invalid dates into the range', () => {
  const p = fixture(), row = p.first.training.rows[0]
  row.logged_at = '2026-10-25T23:30:00Z' // Copenhagen: Monday 26th, after DST switch.
  assert.equal(model(p).first.training.volume, 800)
  for (const value of ['2026-10-25T22:30:00Z', '2026-11-01T23:30:00Z',
    '2026-10-26T10:00:00', '2026-10-26T25:00:00Z', '2026-10-32', undefined]) {
    row.logged_at = value; assert.equal(model(p).first.training.volume, null, value)
  }
})

test('numeric invalidity and overflow remain unknown; valid zero loads do not become strength estimates', () => {
  for (const [field, value] of [['weight', Infinity], ['weight', -1], ['weight', true], ['reps_completed', 2.5],
    ['reps_completed', 0], ['reps_completed', ''], ['weight', '1.000,0'], ['skipped', 'false']]) {
    const p = fixture(); p.first.training.rows[0][field] = value; assert.equal(model(p).first.training.volume, null)
  }
  const p = fixture(); for (const row of p.first.training.rows) row.weight = 1e308
  assert.equal(model(p).first.training.volume, null)
  for (const row of p.first.training.rows) row.weight = 0
  assert.equal(model(p).first.training.volume, 0); assert.equal(model(p).first.training.lifts.length, 0)
  assert.equal(difference(null, 1), null); assert.equal(difference(3, 1), -2)
  assert.equal(difference(-1e308, 1e308), null)
})
