import test from 'node:test'
import assert from 'node:assert/strict'
import { blokslutModel as model } from './blokslutModel.mjs'
import { snapshot } from './blokslutFixture.mjs'

test('all four main lifts compare first/latest week with shared Epley formula', () => {
  const m = model(snapshot())
  assert.equal(m.status, 'ready'); assert.equal(m.completed, 3); assert.equal(m.planned, 3)
  assert.deepEqual(m.lifts.map(r => r.delta), [11, 11, 11, 11])
  assert.ok(Math.abs(m.lifts[0].baseline.value - 110) < 1e-9)
  assert.ok(Math.abs(m.lifts[0].current.value - 121) < 1e-9)
  assert.deepEqual(m.weeks.map(w => w.tonnage), [1380, 1440, 1500])
  assert.deepEqual(m.weeks.map(w => w.sets), [4, 4, 4])
  assert.equal(m.through, '2026-11-04'); assert.equal(m.weeks.at(-1).end, m.through)
})

test('empty, missing, pending, failed and invalid inputs remain distinguishable', () => {
  const m = model(snapshot({ exerciseLogs: [] }))
  assert.equal(m.status, 'ready'); assert.equal(m.completed, 0); assert.equal(m.confirmed, 0)
  assert.ok(m.lifts.every(r => r.delta === null)); assert.ok(m.weeks.every(w => w.tonnage === 0))
  assert.equal(model(snapshot({ exerciseLogs: undefined })).status, 'empty')
  assert.equal(model(snapshot({ loading: true })).status, 'loading')
  assert.equal(model(snapshot({ error: 'Do not expose raw error' })).status, 'error')
  assert.doesNotMatch(model(snapshot({ error: 'Do not expose raw error' })).message, /Do not expose/)
  for (const now of [undefined, null, 'bad', '2026-02-30', new Date('bad'), '2026-11-04T12:00:00', '2026-10-01'])
    assert.equal(model(snapshot({ now })).status, 'error', String(now))
})

test('incomplete/duplicate plan never becomes an understated denominator', () => {
  const changes = [p => p.block.weeks.pop(), p => p.block.weeks[1].start_date = '2026-10-25',
    p => p.block.weeks[0].sessions[0].exercises[0].sets = 0,
    p => p.block.weeks[0].sessions[0].exercises[0].sets = 1.5,
    p => p.block.weeks[0].sessions[0].exercises[0].id = 'ex-1-0',
    p => p.block.weeks[0].sessions[0].id = 'session-1',
    p => p.block.weeks[0].block_name = '', p => p.block.end_date = '2026-10-01',
    p => p.block.end_date = '2028-11-08', p => p.block.weeks[0] = null]
  for (const change of changes) { const p = snapshot(); change(p); assert.equal(model(p).status, 'error') }
})

test('retries count once; conflicting copies and pending copies suppress certainty', () => {
  const p = snapshot(); p.exerciseLogs.push({ ...p.exerciseLogs[0], id: 'retry' })
  assert.equal(model(p).completed, 3); assert.equal(model(p).weeks[0].tonnage, 1380)
  for (const change of [{ weight: 1000 }, { _optimistic: true }, { skipped: true }]) {
    const q = snapshot(); q.exerciseLogs.push({ ...q.exerciseLogs[0], ...change, id: 'retry' })
    const m = model(q); assert.equal(m.completed, 2); assert.equal(m.weeks[0].tonnage, null)
    assert.ok(m.lifts.every(r => r.delta === null)); assert.equal(m.uncertain, true)
  }
})

test('skipped sets do not complete a session, inflate volume or strength', () => {
  const p = snapshot(); p.exerciseLogs[0].skipped = true
  const m = model(p)
  assert.equal(m.completed, 2); assert.equal(m.weeks[0].tonnage, 1080)
  assert.equal(m.lifts[0].delta, null); assert.equal(m.uncertain, false)
  assert.match(m.focus, /lettere at gennemføre/)
})

test('invalid measurements produce unknown volume rather than plausible zero', () => {
  for (const change of [{ weight: '' }, { weight: -1 }, { weight: Infinity },
    { reps_completed: 0 }, { reps_completed: 1.5 }, { reps_completed: Number.MAX_SAFE_INTEGER + 1 },
    { weight: 1e308, reps_completed: 8 }, { skipped: 'false' }]) {
    const p = snapshot(); Object.assign(p.exerciseLogs[0], change)
    const m = model(p); assert.equal(m.completed, 2); assert.equal(m.weeks[0].tonnage, null)
  }
  const p = snapshot(); p.exerciseLogs[0].weight = '100,5'
  assert.equal(model(p).weeks[0].tonnage, 1381.5)
})

test('foreign exercise/invalid positions/invalid dates/future rows are not block evidence', () => {
  for (const change of [{ exercise_id: 'outside' }, { set_number: 0 }, { set_number: 2 },
    { set_number: 1.5 }, { logged_at: '2026-02-30' }, { logged_at: '2026-10-18' },
    { logged_at: '2026-10-26' }, { logged_at: '2026-10-19T12:00:00' }]) {
    const p = snapshot(); Object.assign(p.exerciseLogs[0], change)
    assert.equal(model(p).completed, 2)
  }
  const p = snapshot(); p.exerciseLogs[8].logged_at = '2026-11-04T12:00:01Z'
  assert.equal(model(p).lifts[0].delta, null)
  p.now = '2026-11-04'
  assert.equal(model(p).lifts[0].delta, 11)
})

test('eligibility excludes variants, light names, deload and high reps only from strength', () => {
  for (const name of ['Front squat', 'Squat backoff', 'Squat teknik single']) {
    const p = snapshot(); p.block.weeks[0].sessions[0].exercises[0].name = name
    assert.equal(model(p).lifts[0].delta, null); assert.equal(model(p).weeks[0].tonnage, 1380)
  }
  for (const block_name of ['Deload', 'Aflastning', 'Taper']) {
    const p = snapshot(); p.block.weeks[0].block_name = block_name
    assert.ok(model(p).lifts.every(r => r.delta === null)); assert.equal(model(p).completed, 3)
  }
  for (const reps_completed of [6, 12]) {
    const p = snapshot(); p.exerciseLogs[0].reps_completed = reps_completed
    assert.equal(model(p).lifts[0].delta, null)
  }
})

test('comparison reports decreases and zero; no reuse of an old peak as now', () => {
  const p = snapshot(); p.exerciseLogs[8].weight = 90; p.exerciseLogs[9].weight = 110
  assert.equal(model(p).lifts[0].delta, -11); assert.equal(model(p).lifts[1].delta, 0)
  p.exerciseLogs = p.exerciseLogs.filter(r => !r.exercise_id.startsWith('ex-2-'))
  assert.ok(model(p).lifts.every(r => r.current === null && r.delta === null))
  p.now = '2026-10-20'
  assert.ok(model(p).lifts.every(r => r.delta === null && /én blokuge/.test(r.message)))
})

test('after block end caps dates; before end excludes future weeks', () => {
  assert.equal(model(snapshot({ now: '2026-12-01' })).through, '2026-11-08')
  const m = model(snapshot({ now: '2026-10-25' }))
  assert.equal(m.weeks.length, 1); assert.equal(m.planned, 1); assert.equal(m.completed, 1)
  const p = snapshot(); p.block.end_date = '2026-11-03'
  assert.equal(model(p).weeks.at(-1).end, '2026-11-03')
})
