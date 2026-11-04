import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSleepOverview } from './sleepModel.mjs'
import { fixture, date, readiness, quality, set } from './sleepFixtures.mjs'
const build = (snapshot, weeks = 6) => buildSleepOverview(snapshot, { enabled: true, weeks })

test('literal OFF is inert, including poisoned input and options', () => {
  const poison = new Proxy({}, { get() { throw Error('OFF read') } })
  assert.equal(buildSleepOverview(poison), null)
  for (const enabled of [undefined, false, null, 0, 1, 'true']) {
    assert.equal(buildSleepOverview(poison, { enabled, get weeks() { throw Error('OFF option') } }), null)
  }
  assert.equal(buildSleepOverview(poison, null), null)
})

test('loading and failed/incomplete snapshots do not inspect payload', () => {
  for (const status of ['loading', 'error', 'ready']) {
    assert.deepEqual(build({ status, complete: false,
      get readinessRows() { throw Error('partial data read') } }),
    { status: status === 'loading' ? 'loading' : 'error' })
  }
  for (const snapshot of [null, undefined, [], 'ready']) assert.equal(build(snapshot).status, 'error')
})

test('all supported periods include every day exactly once, without a clock', () => {
  for (let weeks = 4; weeks <= 8; weeks++) {
    const result = build(fixture(), weeks)
    assert.equal(result.status, 'empty')
    assert.equal(result.weeks.length, weeks)
    assert.equal(result.days.length, weeks * 7)
    assert.equal(new Set(result.days.map(d => d.date)).size, weeks * 7)
    assert.equal(result.days.at(-1).date, date(41))
    assert.ok(result.days.every(d => d.hours === null && d.quality === null))
    assert.ok(result.weeks.every(w => w.hours.average === null && w.quality.average === null))
  }
  assert.equal(buildSleepOverview(fixture(), { enabled: true }).weeks.length, 6)
  for (const weeks of [0, 3, 9, 4.5, '6', NaN, Infinity]) assert.equal(build(fixture(), weeks).status, 'error')
})

test('dates are strict; leap day and DST use actual copied calendar helpers', () => {
  for (const endDate of ['', '2026-02-30', '2026-11-04T12:00:00Z', '0000-01-01', undefined]) {
    assert.equal(build({ ...fixture(), endDate }).status, 'error')
  }
  const leap = build({ ...fixture(), endDate: '2024-03-01' }, 4)
  assert.ok(leap.days.some(d => d.date === '2024-02-29'))
  const data = fixture()
  data.readinessRows = [{ ...readiness(0), logged_date: '2026-10-25' }]
  data.exerciseLogs = [set(0, { logged_at: '2026-10-24T23:30:00Z' })]
  assert.equal(build(data).sessions[0].date, '2026-10-25')
  assert.equal(build(data).pairedRpeDays, 1)
  for (const logged_at of ['2026-02-30', '2026-10-25T02:00:00', '2026-10-25T25:00:00Z']) {
    data.exerciseLogs = [set(0, { logged_at })]
    assert.equal(build(data).status, 'error')
  }
})

test('hours and quality join canonical sources, with independent four-day minimums', () => {
  const data = fixture()
  data.readinessRows = [0, 1, 2, 3].map(i => readiness(i, { sleep_hours: 0 }))
  data.qualityRows = [0, 1, 2].map(i => quality(i))
  let first = build(data).weeks[0]
  assert.deepEqual(first.hours, { count: 4, average: 0 })
  assert.deepEqual(first.quality, { count: 3, average: null })
  data.qualityRows.push(quality(3, { sleep_quality: 2 }))
  first = build(data).weeks[0]
  assert.deepEqual(first.quality, { count: 4, average: 3.5 })
  assert.equal(build(data).days[4].hours, null)
  assert.equal(build(data).days[4].quality, null)
})

test('invalid values remain unknown; energy/score and wrong source fields never substitute', () => {
  for (const invalid of [null, undefined, '', '7', '7,5', NaN, Infinity, -1, 25]) {
    const data = fixture(); data.readinessRows = [readiness(0, { sleep_hours: invalid, energy: 5, readiness_score: 99, sleep_quality: 5 })]
    assert.equal(build(data).days[0].hours, null)
    assert.equal(build(data).days[0].quality, null)
  }
  for (const invalid of [0, 6, 3.5, '4', NaN, Infinity]) {
    const data = fixture(); data.qualityRows = [quality(0, { sleep_quality: invalid, sleep_hours: 9 })]
    assert.equal(build(data).days[0].hours, null)
    assert.equal(build(data).days[0].quality, null)
    assert.equal(build(data).invalidMeasurements, 1)
  }
})

test('complete, dense, scoped collections are mandatory; daily duplicates are errors', () => {
  for (const key of ['readinessRows', 'qualityRows', 'exerciseLogs']) {
    for (const rows of [undefined, null, new Array(1), [null], [[]], [{ athlete_id: 'other' }], new Array(10001)]) {
      assert.equal(build({ ...fixture(), [key]: rows }).status, 'error', key)
    }
  }
  for (const key of ['readinessRows', 'qualityRows']) {
    const row = key === 'readinessRows' ? readiness(0) : quality(0)
    assert.equal(build({ ...fixture(), [key]: [row, { ...row }] }).status, 'error')
    assert.equal(build({ ...fixture(), [key]: [{ ...row, logged_date: '2026-02-30' }] }).status, 'error')
  }
})

test('old/future and optimistic sleep do not fill gaps or shift buckets', () => {
  const data = fixture()
  data.readinessRows = [-1, 42].map(i => readiness(i))
  data.qualityRows = [-1, 42].map(i => quality(i))
  data.readinessRows.push(readiness(0, { _optimistic: true }))
  data.exerciseLogs = [-1, 42].map(i => set(i))
  assert.equal(build(data).status, 'empty')
  assert.equal(build(data).sessions.length, 0)
})

test('pas pairs same-date sleep with mean of explicit own set RPE, never planned RPE', () => {
  const data = fixture(); data.readinessRows = [readiness(0)]; data.qualityRows = [quality(0)]
  data.exerciseLogs = [set(0), set(0, { id: 'synthetic-second', set_number: 2, rpe_actual: 6 }),
    set(0, { id: 'synthetic-third', set_number: 3, rpe_source: undefined, rpe_actual: 10 })]
  const result = build(data)
  assert.equal(result.sessions.length, 1)
  assert.equal(result.sessions[0].rpe, 7)
  assert.equal(result.sessions[0].ratedSets, 2)
  assert.equal(result.sessions[0].sets, 3)
  assert.equal(result.sessions[0].hours, 7.5)
  assert.equal(result.sessions[0].quality, 4)
  assert.equal(result.pairedRpeDays, 1)
  assert.equal(result.pairedPerformanceDays, 1)
})

test('existing persisted provenance marker survives copied rpeOrigin import', () => {
  const data = fixture(), row = set(0, { rpe_source: undefined })
  row.note = `\n[appData2-rpe-v1:${JSON.stringify([8, 100, 3, date(0)])}]`
  data.exerciseLogs = [row]
  assert.equal(build(data).sessions[0].rpe, 8)
  data.exerciseLogs[0] = { ...row, weight: 101 }
  assert.equal(build(data).sessions[0].rpe, null)
})

test('multiple sessions stay separate; paired counts count days and never impute missing sleep', () => {
  const data = fixture(); data.readinessRows = [readiness(0)]
  data.exerciseLogs = [set(0), set(0, { id: 'synthetic-other', exercise_id: 'synthetic-other', session_id: 'synthetic-other' }), set(1)]
  const result = build(data)
  assert.equal(result.sessions.length, 3)
  assert.equal(result.pairedRpeDays, 1)
  assert.equal(result.pairedPerformanceDays, 1)
  assert.equal(result.sessions[2].hours, null)
  assert.ok(!('correlation' in result) && !('recommendation' in result))
})

test('exact duplicate copies collapse; ID and position conflicts exclude every copy', () => {
  const data = fixture(), row = set(0)
  data.exerciseLogs = [row, structuredClone(row)]
  assert.equal(build(data).sessions[0].sets, 1)
  for (const other of [{ ...row, weight: 110 }, { ...row, id: 'synthetic-other' },
    { ...row, exercises: { name: 'Bench' } }, { ...row, session_id: 'synthetic-other' }]) {
    data.exerciseLogs = [row, other]
    assert.equal(build(data).sessions.length, 0)
    assert.equal(build(data).excludedSets, 2)
    data.exerciseLogs.reverse()
    assert.equal(build(data).sessions.length, 0)
  }
})

test('unidentified, skipped or optimistic sets never enter pas context', () => {
  for (const patch of [{ id: null }, { exercise_id: null }, { set_number: null }, { session_id: null }, { skipped: true }, { _optimistic: true }]) {
    const data = fixture(); data.exerciseLogs = [set(0, patch)]
    assert.equal(build(data).sessions.length, 0)
  }
  const data = fixture(); data.exerciseLogs = [set(0, { session_id: undefined,
    exercises: { name: 'Squat', session_id: 'synthetic-nested' } })]
  assert.equal(build(data).sessions.length, 1)
})

test('performance is Epley per exact main lift; no variants, light sets, deload or invalid reps', () => {
  const data = fixture(); data.exerciseLogs = [set(0)]
  assert.ok(Math.abs(build(data).sessions[0].performance[0].e1rm - 110) < 1e-9)
  for (const patch of [{ exercises: { name: 'Front squat' } }, { exercises: { name: 'Squat backoff' } },
    { exercises: { name: 'Squat', sessions: { weeks: { block_name: 'Deload' } } } },
    { reps_completed: 9 }, { reps_completed: 2.5 }, { reps_completed: 0 }, { weight: Infinity }, { weight: null }]) {
    data.exerciseLogs = [set(0, patch)]
    assert.equal(build(data).sessions[0].performance.length, 0, JSON.stringify(patch))
  }
  data.exerciseLogs = [set(0), set(0, { id: 'synthetic-bench', exercise_id: 'synthetic-bench', weight: 50, exercises: { name: 'Bench' } })]
  assert.equal(build(data).sessions[0].performance.length, 2)
})

test('no private extras read/projected, no input mutation, exceptions become generic errors', () => {
  const data = fixture(); data.readinessRows = [readiness(0)]; data.qualityRows = [quality(0)]; data.exerciseLogs = [set(0)]
  for (const obj of [data, ...data.readinessRows, ...data.qualityRows, ...data.exerciseLogs]) {
    Object.defineProperty(obj, 'cycle', { enumerable: true, get() { throw Error('private read') } })
    Object.freeze(obj)
  }
  for (const rows of [data.readinessRows, data.qualityRows, data.exerciseLogs]) Object.freeze(rows)
  const result = build(data)
  assert.equal(result.status, 'ready')
  assert.doesNotMatch(JSON.stringify(result), /cycle|synthetic-|athlete_id|session_id|note/)
  assert.deepEqual(build({ status: 'ready', complete: true, get athleteId() { throw Error('synthetic-detail') } }), { status: 'error' })
})
