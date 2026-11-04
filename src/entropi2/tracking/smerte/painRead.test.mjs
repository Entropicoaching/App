import test from 'node:test'
import assert from 'node:assert/strict'
import { readPainHistory, hasReadinessPain } from './painRead.mjs'
import { buildPainHistory } from './painModel.mjs'
import { addCalendarDays } from '../../../calendarDate.js'

const athleteId = 'synthetic-athlete', asOf = '2026-11-04'
const row = { athlete_id: athleteId, logged_date: asOf, pain: 8, pain_location: 'Testknæ' }
const options = { enabled: true, athleteId, asOf }
const run = (readiness, extra = {}) => readPainHistory({ ...options, readiness, ...extra })

test('actual projection: existing readiness rows, 4/6/8-week boundaries, no IO or unrelated fields', () => {
  for (const weeks of [4, 6, 8]) {
    const from = addCalendarDays(asOf, 1 - weeks * 7)
    const input = Object.freeze({ ...row, get cycle() { throw Error('private field read') },
      get soreness_level() { throw Error('soreness read') } })
    const readiness = Object.freeze([input, { ...row, logged_date: from, pain: 2 },
      { ...row, logged_date: addCalendarDays(from, -1), pain: 10 }])
    const data = readPainHistory({ ...options, readiness, weeks, get client() { throw Error('client access') } })
    assert.deepEqual(data.daily, [
      { athleteId, day: asOf, source: 'athlete_manual', pain: 8, painLocation: 'Testknæ' },
      { athleteId, day: from, source: 'athlete_manual', pain: 2, painLocation: 'Testknæ' },
    ])
    const model = buildPainHistory({ enabled: true, data, weeks })
    assert.equal(model.state, 'ready'); assert.equal(model.areas[0].count, 2)
    assert.equal(hasReadinessPain({ ...options, weeks, readiness }), true)
  }
})

test('actual projection: literal OFF does not inspect snapshot or scope', () => {
  for (const enabled of [undefined, false, 'true', 1]) {
    const input = { enabled, get athleteId() { throw Error('OFF scope') },
      get readiness() { throw Error('OFF rows') } }
    assert.deepEqual(readPainHistory(input), { state: 'off' })
    assert.equal(hasReadinessPain(input), false)
  }
})

test('production-shaped readiness: no pain field, null pain and global zero never establish area pain', () => {
  for (const readiness of [[], [{ athlete_id: athleteId, logged_date: asOf,
    soreness_level: 5, sore_zones: ['Testryg'], readiness_score: 20 }],
  [{ ...row, pain: null, pain_location: null }], [{ ...row, pain: 0, pain_location: null }]]) {
    const data = run(readiness)
    assert.equal(data.state, 'ready')
    assert.equal(buildPainHistory({ enabled: true, data }).state, 'empty')
    assert.equal(hasReadinessPain({ ...options, readiness }), false)
  }
  assert.equal(hasReadinessPain({ ...options, readiness: [{ ...row, pain: 0 }] }), true)
})

test('missing relation/404 or unavailable snapshot cannot produce a section or expose diagnostics', () => {
  for (const readiness of [undefined, null, { data: null, error: { code: '42P01', message: 'relation does not exist' } },
    { data: null, error: { code: 'PGRST205' }, status: 404 }]) {
    assert.deepEqual(run(readiness), { state: 'error' })
    assert.equal(hasReadinessPain({ ...options, readiness }), false)
  }
})

test('invalid scope, duplicate dates, foreign athletes, origins and malformed observations fail closed', () => {
  for (const extra of [{ athleteId: '' }, { asOf: '2026-02-30' }, { weeks: 3 }, { weeks: '6' }])
    assert.deepEqual(run([row], extra), { state: 'error' })
  for (const readiness of [[row, row], [{ ...row, athlete_id: 'other' }], [{ ...row, source: 'watch' }],
    [{ ...row, pain: '8' }], [{ ...row, pain: 11 }], [{ ...row, pain: 2.5 }],
    [{ ...row, pain_location: null }], [{ ...row, pain_location: ' ' }],
    [{ ...row, logged_date: '2026-02-30' }], Array(91).fill(row)]) {
    assert.deepEqual(run(readiness), { state: 'error' })
    assert.equal(hasReadinessPain({ ...options, readiness }), false)
  }
})

test('latest-90 existing snapshot covers eight weeks; future-heavy truncated snapshots are rejected', () => {
  const readiness = Array.from({ length: 90 }, (_, i) => ({ ...row, logged_date: addCalendarDays(asOf, -i) }))
  const data = run(readiness, { weeks: 8 })
  assert.equal(data.daily.length, 56)
  assert.equal(buildPainHistory({ enabled: true, data, weeks: 8 }).absentDays, 0)
  const future = readiness.map((r, i) => ({ ...r, logged_date: addCalendarDays(asOf, 80 - i) }))
  assert.deepEqual(run(future, { weeks: 8 }), { state: 'error' })
})
