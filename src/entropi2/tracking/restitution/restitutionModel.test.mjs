import test from 'node:test'
import assert from 'node:assert/strict'
import { buildRestitution } from './restitutionModel.mjs'
import { fixture, readiness, set, date } from './restitutionFixtures.mjs'

const build = snapshot => buildRestitution(snapshot, { enabled: true })
const changeDaily = changes => { const data = fixture(); data.readinessRows = [7, 8, 9, 13].map(i => readiness(i, changes)); return data }
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }; return value }

test('literal OFF is inert, even with a poisoned snapshot', () => {
  const poison = new Proxy({}, { get() { throw Error('OFF read') } })
  for (const enabled of [undefined, false, 0, 1, 'true', null]) assert.equal(buildRestitution(poison, { enabled }), null)
  assert.equal(buildRestitution(poison), null)
})

test('loading/error/incomplete states never consume a partial data payload', () => {
  for (const status of ['loading', 'error']) {
    const data = { status, get readinessRows() { throw Error('payload read') } }
    assert.deepEqual(build(data), { status })
  }
  const data = fixture(); data.complete = false
  Object.defineProperty(data, 'exerciseLogs', { get() { throw Error('partial payload read') } })
  assert.deepEqual(build(data), { status: 'error' })
})

test('explicit source, dense complete arrays, identity and strict end day are required', () => {
  assert.equal(build({}).status, 'error')
  assert.equal(build({ status: 'ready' }).status, 'error')
  for (const changes of [null, { dailySource: 'tracking_daily_v1' },
    { athleteId: '' }, { athleteId: ' ' }, { endDate: '2026-02-30' }, { endDate: date(13) + 'T12:00:00Z' },
    { readinessRows: undefined }, { readinessRows: Array(2) }, { exerciseLogs: Array(1) },
    { readinessRows: Array(10001).fill(readiness(13)) }, { exerciseLogs: [null] }]) {
    assert.equal(build(changes === null ? null : { ...fixture(), ...changes }).status, 'error', JSON.stringify(changes)?.slice(0, 120))
  }
  for (const field of ['readinessRows', 'exerciseLogs']) {
    const data = fixture(); data[field].push({ ...data[field][0], athlete_id: 'synthetic-other' })
    assert.deepEqual(build(data), { status: 'error' })
  }
})

test('7-day wellbeing and two disjoint 7-day load windows have exact inclusive boundaries', () => {
  const data = fixture()
  data.readinessRows.unshift(readiness(6, { sleep_hours: 0 }))
  data.readinessRows.push(readiness(14, { sleep_hours: 0 }))
  data.exerciseLogs.push(set(-1, { weight: 9999 }), set(14, { weight: 9999 }))
  const result = build(data)
  assert.equal(result.status, 'ready'); assert.equal(result.level, 'god')
  assert.deepEqual([result.from, result.recentFrom, result.to], [date(0), date(7), date(13)])
  assert.deepEqual(result.metrics.sleep_hours, { count: 4, average: 8 })
  assert.deepEqual(result.load.previous, { from: date(0), to: date(6), sets: 2, recordedDays: 2, tonnage: 600 })
  assert.deepEqual(result.load.recent, { from: date(7), to: date(13), sets: 2, recordedDays: 2, tonnage: 600 })
  assert.equal(result.load.ratio, 1)
})

test('empty data and one training week stay insufficient, never zero-filled', () => {
  const empty = fixture(); empty.readinessRows = []; empty.exerciseLogs = []
  const result = build(empty)
  assert.equal(result.status, 'insufficient'); assert.equal(result.level, null)
  assert.deepEqual(result.metrics.energy, { count: 0, average: null })
  assert.equal(result.load.previous.tonnage, null); assert.equal(result.load.ratio, null)
  const one = fixture(); one.exerciseLogs = one.exerciseLogs.filter(row => row.logged_at >= date(7))
  assert.equal(build(one).status, 'insufficient')
})

test('each independent wellbeing measure requires four valid days; no score or quality substitution', () => {
  for (const field of ['sleep_hours', 'energy', 'stress', 'soreness_level']) {
    const data = fixture(); delete data.readinessRows[0][field]
    data.readinessRows[0].score = 99; data.readinessRows[0].sleep_quality = 5
    const result = build(data)
    assert.equal(result.status, 'insufficient'); assert.equal(result.level, null)
    assert.deepEqual(result.metrics[field], { count: 3, average: null })
  }
})

test('zero sleep is real; invalid, blank, string and out-of-range wellbeing remain unknown', () => {
  const zero = build(changeDaily({ sleep_hours: 0 }))
  assert.equal(zero.level, 'lav'); assert.equal(zero.metrics.sleep_hours.average, 0)
  for (const raw of [null, undefined, '', '8', false, NaN, Infinity, -1, 25]) {
    const result = build(changeDaily({ sleep_hours: raw }))
    assert.equal(result.status, 'insufficient'); assert.equal(result.metrics.sleep_hours.average, null)
    assert.equal(result.invalidMeasurements, raw == null ? 0 : 4)
  }
  for (const raw of [0, 6, 1.5, '4', NaN]) assert.equal(build(changeDaily({ energy: raw })).status, 'insufficient')
})

test('a fresh complete answer is required even with sufficient independent counts', () => {
  const data = fixture(); data.readinessRows = [7, 8, 9, 10].map(i => readiness(i))
  const stale = build(data)
  assert.equal(stale.metrics.energy.count, 4); assert.equal(stale.fresh, false); assert.equal(stale.status, 'insufficient')
  data.readinessRows.push(readiness(12))
  assert.equal(build(data).status, 'ready')
  data.readinessRows.at(-1).energy = null
  assert.equal(build(data).status, 'insufficient')
})

test('daily duplicates error; pending and out-of-window answers never satisfy coverage', () => {
  const data = fixture(); data.readinessRows.push({ ...data.readinessRows[0] })
  assert.equal(build(data).status, 'error')
  data.readinessRows = [7, 8, 9, 13].map(i => readiness(i, { _optimistic: true }))
  assert.equal(build(data).metrics.sleep_hours.count, 0)
  data.readinessRows = [0, 1, 6, 14].map(i => readiness(i))
  assert.equal(build(data).status, 'insufficient')
})

test('simple cautious thresholds produce god/ok/lav without claiming causation', () => {
  for (const [changes, level] of [
    [{}, 'god'], [{ sleep_hours: 7 }, 'god'], [{ sleep_hours: 6 }, 'ok'], [{ sleep_hours: 5.99 }, 'lav'],
    [{ energy: 3 }, 'ok'], [{ energy: 2 }, 'lav'], [{ stress: 3 }, 'ok'], [{ stress: 4 }, 'lav'],
    [{ soreness_level: 3 }, 'ok'], [{ soreness_level: 4 }, 'lav'],
  ]) assert.equal(build(changeDaily(changes)).level, level, JSON.stringify(changes))
  for (const [weight, level] of [[120, 'god'], [120.01, 'ok'], [160, 'ok']]) {
    const data = fixture(); data.exerciseLogs = [set(0), set(6), set(7, { weight }), set(13, { weight })]
    assert.equal(build(data).level, level)
  }
})

test('load uses actual completed reps, accepts production numeric strings, never planned sets or RPE', () => {
  const data = fixture(); data.exerciseLogs = [0, 6, 7, 13].map(i => set(i, {
    weight: '100,5', reps_completed: '3', sets: 99, reps: 50, rpe: 10, rpe_source: 'plan',
  }))
  const result = build(data)
  assert.equal(result.load.recent.tonnage, 603); assert.equal(result.level, 'god')
})

test('at least two distinct recorded training days per bucket; zero baseline is not comparable', () => {
  const data = fixture(); data.exerciseLogs = [set(0), set(6), set(7), set(8, { logged_at: date(7) })]
  assert.equal(build(data).status, 'insufficient')
  data.exerciseLogs = [0, 6, 7, 13].map(i => set(i, { weight: 0 }))
  const result = build(data)
  assert.equal(result.load.previous.tonnage, 0); assert.equal(result.load.ratio, null)
  assert.equal(result.status, 'insufficient')
})

test('missing, invalid and overflowing training measures suppress comparison', () => {
  for (const changes of [{ weight: null }, { weight: -1 }, { weight: Infinity }, { reps_completed: undefined },
    { reps_completed: 0 }, { reps_completed: 1.2 }, { weight: Number.MAX_VALUE, reps_completed: 3 },
    { id: '' }, { exercise_id: null }, { set_number: 0 }]) {
    const data = fixture(); Object.assign(data.exerciseLogs[0], changes)
    const result = build(data)
    assert.equal(result.status, 'insufficient', JSON.stringify(changes))
    assert.equal(result.load.ratio, null); assert.equal(result.load.uncertainSets, 1)
    assert.equal(result.load.previous.tonnage, null); assert.equal(result.load.recent.tonnage, null)
  }
  const data = fixture(); data.exerciseLogs = [0, 6, 7, 13].map(i => set(i, { weight: Number.MAX_VALUE, reps_completed: 1 }))
  assert.equal(build(data).status, 'insufficient')
})

test('exact duplicates collapse; conflicting IDs/positions/dates fail closed regardless of order', () => {
  const data = fixture(); data.exerciseLogs.push({ ...data.exerciseLogs[0], unrelated: 'synthetic-hidden' })
  assert.equal(build(data).load.previous.sets, 2)
  for (const changes of [{ weight: 500 }, { id: 'synthetic-other-set' }, { logged_at: date(-1) },
    { logged_at: date(14) }, { skipped: true }, { _optimistic: true }]) {
    const conflict = fixture(); conflict.exerciseLogs.push({ ...conflict.exerciseLogs[0], ...changes })
    assert.equal(build(conflict).status, 'insufficient', JSON.stringify(changes))
    assert.deepEqual(build(conflict), build({ ...conflict, exerciseLogs: [...conflict.exerciseLogs].reverse() }))
  }
})

test('skipped/pending sets are excluded and cannot establish training days', () => {
  for (const changes of [{ skipped: true }, { _optimistic: true }]) {
    const data = fixture(); Object.assign(data.exerciseLogs[0], changes)
    const result = build(data)
    assert.equal(result.load.excludedSets, 1); assert.equal(result.load.previous.recordedDays, 1)
    assert.equal(result.status, 'insufficient')
  }
})

test('training timestamps use Copenhagen dates across midnight and reject invalid/unzoned dates', () => {
  const data = fixture(); data.exerciseLogs[2].logged_at = '2026-10-28T23:30:00Z'
  assert.equal(build(data).load.recent.recordedDays, 2)
  for (const logged_at of ['2026-02-30', '2026-11-01T12:00:00', '2026-11-01T25:00:00Z', 'invalid']) {
    const bad = fixture(); bad.exerciseLogs[0].logged_at = logged_at
    assert.deepEqual(build(bad), { status: 'error' })
  }
})

test('leap day/year boundary/DST use calendar arithmetic independent of host timezone', () => {
  for (const [endDate, from, recentFrom] of [
    ['2024-03-01', '2024-02-17', '2024-02-24'], ['2026-01-03', '2025-12-21', '2025-12-28'],
    ['2026-10-26', '2026-10-13', '2026-10-20'],
  ]) {
    const result = build({ ...fixture(), endDate, readinessRows: [], exerciseLogs: [] })
    assert.deepEqual([result.from, result.recentFrom], [from, recentFrom])
  }
})

test('pure, frozen, no private extra reads/output, no mutation and fresh deterministic results', () => {
  const data = fixture()
  for (const row of [...data.readinessRows, ...data.exerciseLogs]) {
    Object.defineProperty(row, 'private_note', { get() { throw Error('private extra read') } })
  }
  const result = build(freeze(data))
  assert.equal(result.status, 'ready')
  assert.deepEqual(build(data), result); assert.notEqual(build(data), result)
  assert.deepEqual(build({ ...data, readinessRows: [...data.readinessRows].reverse(), exerciseLogs: [...data.exerciseLogs].reverse() }), result)
  assert.doesNotMatch(JSON.stringify(result), /synthetic-|athlete_id|private_note|exercise_id|session_id/)
})
