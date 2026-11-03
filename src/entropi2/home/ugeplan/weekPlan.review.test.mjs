import test from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'
import { weekPlanModel } from './weekPlanModel.mjs'
register('./syntheticReactLoader.mjs', import.meta.url)
const { default: WeekPlan } = await import('./WeekPlan.mjs')

// Independent synthetic scenarios: no producer fixture or expected-value helper.
const make = (start, now) => ({ athleteId: 42, now, exerciseLogs: [],
  week: { athlete_id: 42, start_date: start, sessions: [
    { id: 'review', title: 'Syntetisk pas', weekday: 6, exercises: [{ id: 'review-ex', sets: 1 }] },
  ] } })

test('review: year boundary and both DST weekends preserve dated rows', () => {
  for (const [start, now, date, day] of [
    ['2025-12-29', '2026-01-04T12:00:00Z', '2026-01-04', 'Søn. 4/1'],
    ['2026-03-23', '2026-03-29T12:00:00Z', '2026-03-29', 'Søn. 29/3'],
    ['2026-10-19', '2026-10-25T12:00:00Z', '2026-10-25', 'Søn. 25/10'],
  ]) {
    const row = weekPlanModel(make(start, now)).rows[0]
    assert.equal(row.date, date); assert.equal(row.day, day); assert.equal(row.label, 'I dag')
  }
})

test('review: rejected dates and absent clock never create a dated plan', () => {
  for (const start of ['2026-02-30', 'invalid', null])
    assert.deepEqual(weekPlanModel(make(start, '2026-11-03T12:00:00Z')), { state: 'missing', rows: [] })
  for (const now of [undefined, null, NaN, '2026-11-03', 'invalid'])
    assert.equal(weekPlanModel(make('2026-11-02', now)).state, 'missing')
})

test('review: conflicting and duplicate slots do not falsely complete a session', () => {
  const p = make('2026-11-02', '2026-11-03T12:00:00Z')
  const row = { exercise_id: 'review-ex', set_number: 1, logged_at: '2026-11-02T12:00:00Z' }
  p.exerciseLogs = [row, { ...row }]
  assert.equal(weekPlanModel(p).rows[0].label, 'Klaret')
  p.exerciseLogs[1].skipped = true
  assert.equal(weekPlanModel(p).rows[0].label, 'Status ukendt')
  p.exerciseLogs = [{ ...row, athlete_id: 99 }]
  assert.equal(weekPlanModel(p).rows[0].label, 'Kommende')
})

test('review: no clock, callback, network or storage use during rendering', () => {
  const RealDate = globalThis.Date
  const fetch = globalThis.fetch
  const forbidden = () => assert.fail('Unexpected side effect')
  globalThis.Date = class extends RealDate {
    constructor(...args) { assert.ok(args.length, 'Ambient clock'); super(...args) }
    static now() { return forbidden() }
  }
  globalThis.fetch = forbidden
  try {
    const p = { ...make('2026-11-02', '2026-11-03T12:00:00Z'), enabled: true,
      getNow: forbidden, onStartSession: forbidden, storage: { getItem: forbidden, setItem: forbidden } }
    assert.equal(WeekPlan(p).type, 'section')
    assert.equal(WeekPlan({ enabled: false, get week() { return forbidden() } }), null)
  } finally { globalThis.Date = RealDate; globalThis.fetch = fetch }
})
