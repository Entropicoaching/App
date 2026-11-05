import test from 'node:test'
import assert from 'node:assert/strict'
import { homeRecord } from './homeRecord.mjs'
import { readHomeRecordHistory } from './homeRecordRead.mjs'

const athlete = { id: 'synthetic-record-owner' }
const now = new Date('2026-11-05T12:00:00Z')
const row = (exercise_id, weight, logged_at = '2026-11-04T12:00:00Z', extra = {}) => ({
  athlete_id: athlete.id, exercise_id, set_number: 1, weight, reps_completed: 3,
  skipped: false, logged_at, exercises: { name: 'Squat', sessions: { weeks: { block_name: 'Styrke' } } }, ...extra,
})
function fixture() {
  const currentWeek = { id: 'synthetic-week', athlete_id: athlete.id, block_name: 'Styrke', start_date: '2026-11-02',
    sessions: [{ id: 'synthetic-session', exercises: [{ id: 'synthetic-squat', name: 'Squat', sets: 2 }] }] }
  const props = { enabled: true, athlete, currentWeek, allWeeks: [currentWeek], exerciseLogs: [
    row('synthetic-squat', 140), row('synthetic-squat', 100, '2026-11-04T12:02:00Z', { set_number: 2 }),
  ] }
  const history = { status: 'ready', complete: true, athleteId: athlete.id, rows: [row('synthetic-old', 130, '2025-01-02T10:00:00Z')] }
  return { props, history }
}
const result = (f, at = now) => homeRecord(f.props, f.history, at)

test('latest completed session celebrates Analysis maximum, date and Danish decimal inputs without mutation', () => {
  const f = fixture(), before = JSON.stringify(f)
  const freeze = x => { if (x && typeof x === 'object') { Object.values(x).forEach(freeze); Object.freeze(x) } }
  freeze(f)
  assert.deepEqual(result(f), { lift: 'Squat', weight: 140, reps: 3, date: '2026-11-04' })
  assert.equal(JSON.stringify(f), before)
  const decimal = fixture(); decimal.props.exerciseLogs[0].weight = '140,5'
  assert.equal(result(decimal).weight, 140.5)
})

test('uses both Analysis maxima: more reps at equal weight and an improved e1RM at a lighter weight', () => {
  const f = fixture(); f.history.rows[0].weight = 140; f.history.rows[0].reps_completed = 2
  assert.equal(result(f).reps, 3)
  f.history.rows[0].weight = 150; f.history.rows[0].reps_completed = 1
  f.props.exerciseLogs[0].reps_completed = 8
  assert.equal(result(f).weight, 140)
  assert.equal(result(f).reps, 8)
})

test('the first confirmed session establishes a baseline; another lift or unconfirmed prior set is not enough', () => {
  for (const prior of [[], [row('synthetic-old', 130, '2026-10-01T10:00:00Z', { skipped: true })],
    [row('synthetic-old', 130, '2026-10-01T10:00:00Z', { pending: true })],
    [row('synthetic-old', 130, '2026-10-01T10:00:00Z', { _optimistic: true })],
    [row('synthetic-old', 130, '2026-10-01T10:00:00Z', { exercises: { name: 'Bænkpres', sessions: { weeks: { block_name: 'Styrke' } } } })]]) {
    const f = fixture(); f.history.rows = prior
    assert.equal(result(f), null)
  }
  const f = fixture()
  f.props.currentWeek.sessions[0].exercises.push({ id: 'synthetic-bench', name: 'Bænkpres', sets: 1 })
  f.props.exerciseLogs.push(row('synthetic-bench', 300))
  f.props.exerciseLogs[0].weight = 100
  assert.equal(result(f), null, 'a first bench session cannot borrow the squat baseline')
  f.props.exerciseLogs[0].weight = 140
  assert.equal(result(f).lift, 'Squat')
})

test('strictly three elapsed days from the record set, including Copenhagen DST and mounted expiry', () => {
  const f = fixture()
  assert.ok(result(f, new Date('2026-11-07T11:59:59.999Z')))
  assert.equal(result(f, new Date('2026-11-07T12:00:00Z')), null)
  assert.equal(result(f, new Date('2026-11-04T11:59:59Z')), null)
  const week = f.props.currentWeek; week.start_date = '2026-10-19'
  f.props.exerciseLogs.forEach((r, i) => { r.logged_at = `2026-10-24T22:0${i}:00Z` })
  assert.equal(result(f, new Date('2026-10-27T21:59:59Z')).date, '2026-10-25')
  assert.equal(result(f, new Date('2026-10-27T22:00:00Z')), null)
})

test('incomplete, pending, parked, queued, optimistic and conflicting positions cannot complete the session', () => {
  for (const change of [
    f => f.props.exerciseLogs.pop(),
    f => { f.props.exerciseLogs[1].pending = true },
    f => { f.props.exerciseLogs[1]._optimistic = true },
    f => { f.props.pendingSyncKeys = ['synthetic-squat_2'] },
    f => { f.props.parkedSets = [{ exerciseId: 'synthetic-squat', setNumber: 2 }] },
    f => { f.props.exerciseLogs.push({ ...f.props.exerciseLogs[1], weight: 900 }) },
    f => { f.props.exerciseLogs.push({ ...f.props.exerciseLogs[1], _optimistic: true }) },
    f => { f.props.exerciseLogs[1].logged_at = '2026-11-04T12:00:00' },
    f => { f.props.exerciseLogs[1].athlete_id = 'synthetic-other' },
  ]) { const f = fixture(); change(f); assert.equal(result(f), null) }
  const f = fixture(); f.props.exerciseLogs.push({ ...f.props.exerciseLogs[0] })
  assert.ok(result(f), 'exact repeated slot remains a single confirmation')
})

test('a skipped slot completes Home as before but cannot itself be a record', () => {
  const f = fixture(); f.props.exerciseLogs[1].skipped = true
  assert.ok(result(f))
  f.props.exerciseLogs[0].skipped = true
  assert.equal(result(f), null)
})

test('latest completed nonrecord session replaces an earlier celebration; a later incomplete session does not', () => {
  const f = fixture(), week = f.props.currentWeek
  week.sessions.push({ id: 'synthetic-later', exercises: [{ id: 'synthetic-later-squat', name: 'Squat', sets: 2 }] })
  f.props.exerciseLogs.push(row('synthetic-later-squat', 100, '2026-11-05T10:00:00Z'))
  assert.ok(result(f))
  f.props.exerciseLogs.push(row('synthetic-later-squat', 100, '2026-11-05T10:02:00Z', { set_number: 2 }))
  assert.equal(result(f), null)
})

test('same-day equal records, older higher records and future sets never create a new record', () => {
  for (const old of [row('synthetic-old', 140), row('synthetic-old', 200, '2025-01-02T10:00:00Z')]) {
    const f = fixture(); f.history.rows = [old]; assert.equal(result(f), null)
  }
  const f = fixture(); f.props.exerciseLogs[0].logged_at = '2026-11-06T12:00:00Z'
  assert.equal(result(f), null)
})

test('unknown newer program logs and ambiguous simultaneous completions cannot select an older celebration', () => {
  const f = fixture(); f.history.rows.push(row('synthetic-unknown', 150, '2026-11-05T10:00:00Z'))
  assert.equal(result(f), null)
  const tied = fixture()
  tied.props.currentWeek.sessions.push({ id: 'synthetic-same-time', exercises: [{ id: 'synthetic-other-squat', name: 'Squat', sets: 1 }] })
  tied.props.exerciseLogs.push(row('synthetic-other-squat', 100, '2026-11-04T12:02:00Z'))
  assert.equal(result(tied), null)
})

test('Analysis filters exclude deload, taper, variants, backoff, invalid values and reps outside 1–8', () => {
  for (const block of ['Deload', 'Taper', 'Aflastning', '', undefined]) {
    const f = fixture(); f.props.currentWeek.block_name = block; assert.equal(result(f), null)
  }
  for (const name of ['Front squat', 'Squat backoff', 'Squat teknik single', 'Unknown']) {
    const f = fixture(); f.props.currentWeek.sessions[0].exercises[0].name = name; assert.equal(result(f), null)
  }
  for (const value of [9, 0, -1, 1.5, null, Infinity]) {
    const f = fixture(); f.props.exerciseLogs[0].reps_completed = value; assert.equal(result(f), null)
  }
  for (const value of [0, -1, '', Infinity, Number.MAX_VALUE]) {
    const f = fixture(); f.props.exerciseLogs[0].weight = value; assert.equal(result(f), null)
  }
})

test('explicit local edits/undo replace saved history, and prior-week records survive the week boundary', () => {
  const f = fixture(); f.history.rows.push(...f.props.exerciseLogs)
  f.props.exerciseLogs = []; assert.equal(result(f), null)
  const oldWeek = f.props.currentWeek
  f.props.currentWeek = { id: 'synthetic-next-week', athlete_id: athlete.id, block_name: 'Styrke', start_date: '2026-11-09', sessions: [] }
  f.props.allWeeks.push(f.props.currentWeek)
  oldWeek.start_date = '2026-11-02'
  f.history.rows[1].logged_at = '2026-11-08T12:00:00Z'
  f.history.rows[2].logged_at = '2026-11-08T12:02:00Z'
  assert.equal(result(f, new Date('2026-11-09T12:00:00Z')).weight, 140)
})

test('missing/error/offline/foreign snapshots suppress the card and OFF/preview never inspect history', () => {
  for (const change of [
    f => { f.history.status = 'error' }, f => { f.history.complete = false },
    f => { f.history.athleteId = 'synthetic-other' }, f => { f.history.rows[0].athlete_id = 'synthetic-other' },
    f => { f.history.rows = Array(1) }, f => { f.props.allWeeks.push(null) },
    f => { f.props.currentWeek.sessions.push(null) }, f => { f.props.currentWeek.sessions.push(...Array(1)) },
    f => { f.props.currentWeek.sessions[0].exercises = Array(1) },
    f => { f.props.programError = true }, f => { f.props.offlineSnapshotAt = 'synthetic' },
    f => { f.props.exerciseLogsError = true }, f => { f.props.exerciseLogsLoading = true },
    f => { f.props.currentWeek.athlete_id = 'synthetic-other' },
    f => { f.props.currentWeek.sessions[0].exercises.push({ id: 'synthetic-squat', name: 'Squat', sets: 1 }) },
  ]) { const f = fixture(); change(f); assert.equal(result(f), null) }
  const denied = new Proxy({}, { get() { assert.fail('OFF/preview data access') } })
  for (const props of [{ enabled: false }, { enabled: true, sessionReadOnly: true }, { enabled: true, readOnly: true }])
    assert.equal(homeRecord(props, denied, now), null)
})

function service(pages) {
  const calls = []; let index = 0
  const client = { from(table) {
    calls.push(['from', table])
    const query = { then(resolve, reject) { return Promise.resolve(pages[index++]).then(resolve, reject) } }
    for (const method of ['select', 'eq', 'order', 'range']) query[method] = (...args) => { calls.push([method, ...args]); return query }
    return query
  } }
  return { client, calls }
}

test('actual reader paginates all history, scopes each page by athlete and retains only existing required fields', async () => {
  const a = row('synthetic-a', 140), b = row('synthetic-b', 200, '2025-01-02T12:00:00Z')
  Object.defineProperty(a, 'privateField', { get() { assert.fail('unrelated field') } })
  const f = service([{ data: [a] }, { data: [b] }, { data: [] }])
  const data = await readHomeRecordHistory({ athleteId: athlete.id, client: f.client })
  assert.equal(data.status, 'ready'); assert.equal(data.rows.length, 2); assert.equal(data.complete, true)
  assert.deepEqual(f.calls.filter(c => c[0] === 'eq'), Array(3).fill(['eq', 'athlete_id', athlete.id]))
  assert.deepEqual(f.calls.filter(c => c[0] === 'range'), [['range', 0, 999], ['range', 1, 1000], ['range', 2, 1001]])
  assert.match(f.calls.find(c => c[0] === 'select')[1], /set_number.*skipped.*block_name/)
  assert.equal('privateField' in data.rows[0], false)
})

test('actual reader rejects failed/truncated, malformed and mixed-owner pages without loading the default client', async () => {
  for (const page of [{ data: null }, { data: [], error: { message: 'synthetic' } },
    { data: [row('synthetic-a', 140, undefined, { athlete_id: 'synthetic-other' })] },
    { data: [row('synthetic-a', 140, undefined, { set_number: null })] }, { data: [null] }]) {
    const f = service([page, { data: [] }]); assert.equal((await readHomeRecordHistory({ athleteId: athlete.id, client: f.client })).status, 'error')
  }
  const many = service(Array.from({ length: 200 }, () => ({ data: [row('synthetic-a', 140)] })))
  assert.equal((await readHomeRecordHistory({ athleteId: athlete.id, client: many.client })).status, 'error')
  assert.equal((await readHomeRecordHistory({ athleteId: '', client: { from() { assert.fail('invalid scope read') } } })).status, 'error')
})
