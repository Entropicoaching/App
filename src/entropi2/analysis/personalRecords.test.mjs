import test from 'node:test'
import assert from 'node:assert/strict'
import { personalRecords } from './personalRecords.mjs'
import { analysisModel } from './analysisModel.mjs'
import Analysis from './testRender.mjs'

const now = new Date('2026-11-03T12:00:00Z')
const row = (day, weight = 100, reps = 3, name = 'Squat', extra = {}) => ({
  exercise_id: `${name}-${day}`, logged_at: day, weight, reps_completed: reps,
  exercises: { name, sessions: { weeks: { block_name: 'Styrke' } } }, ...extra,
})
const props = fremgangLogs => ({ entropi2: true, now, fremgangLogs })
const model = rows => personalRecords(props(rows), now)

test('records: heaviest and best e1RM can be different sets with dates', () => {
  const m = model([row('2026-10-01', 120, 1), row('2026-10-02', 110, 8)])
  assert.equal(m.lifts.length, 1)
  assert.deepEqual(m.lifts[0].heaviest, { weight: 120, reps: 1, date: '2026-10-01', value: 124.00000000000001 })
  assert.equal(m.lifts[0].bestEstimate.weight, 110)
  assert.equal(m.lifts[0].bestEstimate.date, '2026-10-02')
  assert.ok(Math.abs(m.lifts[0].bestEstimate.value - 139.33333333333331) < 1e-10)
})

test('records: equal weight prefers more reps, then first Danish date, regardless of input order', () => {
  const rows = [row('2026-10-03', 100, 5), row('2026-10-02', 100, 5), row('2026-10-01', 100, 3)]
  assert.equal(model(rows).lifts[0].heaviest.date, '2026-10-02')
  assert.deepEqual(model(rows), model([...rows].reverse()))
  assert.equal(model(rows).lifts[0].bestEstimate.date, '2026-10-02')
})

test('records: every available date is eligible while existing answers keep the 84-day gate', () => {
  const p = props([row('2025-01-01', 200), row('2026-11-01', 100)])
  const m = analysisModel(p, now)
  assert.equal(m.personalRecords.lifts[0].heaviest.date, '2025-01-01')
  assert.equal(m.answers[0].value, undefined)
  assert.equal(m.fourWeekHistory.lifts[0].points.at(-1).value, null)
})

test('records: exact main lifts and aliases stay separate; variants and light sets excluded', () => {
  const names = ['Squat', 'Bench top set', 'Deadlift', 'Sumo deadlift', 'Front squat', 'Squat backoff', 'Squat teknik single']
  const m = model(names.map((n, i) => row('2026-10-01', 100 + i, 3, n)))
  assert.deepEqual(m.lifts.map(r => r.lift), ['Squat', 'Bænkpres', 'Dødløft', 'Sumo dødløft'])
  assert.equal(m.lifts[0].heaviest.weight, 100)
})

test('records: invalid rows and RPE without weight cannot create records', () => {
  const bad = [null, {}, row('2026-10-01', null, 3, 'Squat', { rpe: 10 }),
    ...[NaN, Infinity, Number.MAX_VALUE, -1, 0, '', {}, true].map(w => row('2026-10-01', w)),
    ...[NaN, Infinity, -1, 0, 1.5, 9, null, ''].map(r => row('2026-10-01', 100, r)),
    ...['2026-02-30', '2026-11-04', '2026-11-03T13:00:00Z', '2026-10-01T10:00:00', '2026-10-01T24:00:00Z', null].map(d => row(d)),
    row('2026-10-01', 100, 3, 'Squat', { skipped: true }),
    row('2026-10-01', 100, 3, 'Squat', { _optimistic: true })]
  for (const r of bad) assert.deepEqual(model([r]).lifts, [], JSON.stringify(r))
  for (const block_name of ['', '  ', 'Deload', 'Aflastning', 'Taper']) {
    const r = row('2026-10-01'); r.exercises.sessions.weeks.block_name = block_name
    assert.deepEqual(model([r]).lifts, [])
  }
})

test('records: duplicates do not change maxima and conflicts are excluded', () => {
  const a = row('2026-10-01'), b = row('2026-10-02', 110)
  assert.deepEqual(model([a, b, b]), model([a, b]))
  assert.equal(model([a, b, { ...b, weight: 900 }]).lifts[0].heaviest.weight, 100)
})

test('records: local edits and undo replace saved current-exercise rows', () => {
  const p = { ...props([row('2026-10-01', 100), row('2026-11-02', 200, 3, 'Squat', { exercise_id: 'sq' })]),
    currentWeek: { start_date: '2026-11-02', block_name: 'Styrke', sessions: [{ exercises: [{ id: 'sq', name: 'Squat' }] }] }, exerciseLogs: [] }
  assert.equal(personalRecords(p, now).lifts[0].heaviest.weight, 100)
  p.exerciseLogs = [{ exercise_id: 'sq', set_number: 1, logged_at: '2026-11-03', weight: '102,5', reps_completed: 3 }]
  assert.equal(personalRecords(p, now).lifts[0].heaviest.weight, 102.5)
  p.exerciseLogs[0]._optimistic = true
  assert.equal(personalRecords(p, now).lifts[0].heaviest.weight, 100)
})

test('records: loading, absent history, empty and invalid clock have no maxima', () => {
  for (const p of [props(undefined), props([]), { ...props([row('2026-10-01')]), fremgangLoading: true }])
    assert.deepEqual(personalRecords(p, now).lifts, [])
  assert.deepEqual(personalRecords(props([row('2026-10-01')]), new Date('invalid')).lifts, [])
  assert.match(personalRecords({ ...props([]), fremgangLoading: true }, now).message, /Henter/)
})

test('records: Danish dates, decimal numbers, frozen inputs and no mutation', () => {
  const p = props([row('2026-10-01T22:30:00Z', '100,5', 3)])
  const freeze = x => { if (x && typeof x === 'object') { Object.values(x).forEach(freeze); Object.freeze(x) } }
  const before = JSON.stringify(p); freeze(p)
  assert.equal(personalRecords(p, now).lifts[0].heaviest.date, '2026-10-02')
  assert.equal(personalRecords(p, now).lifts[0].heaviest.weight, 100.5)
  assert.equal(JSON.stringify(p), before)
})

test('records rendering: short list has both records, source sets and dates', () => {
  const dom = Analysis(props([row('2026-10-01', 120, 1), row('2026-10-02', 110, 8)]))
  const section = dom.querySelectorAll('[data-analysis-records]')[0]
  assert.ok(section)
  assert.equal(section.querySelectorAll('li').length, 1)
  assert.match(section.textContent, /Dine rekorder/)
  assert.match(section.textContent, /120 kg × 1.*01.10.2026/)
  assert.match(section.textContent, /139,3 kg e1RM.*110 kg × 8.*02.10.2026/)
  assert.match(section.textContent, /indlæste historik/)
  assert.equal(dom.querySelectorAll('[data-analysis-value]').length, 0)
})

test('records rendering: empty/missing/loading cards are hidden and strict OFF remains safe', () => {
  for (const p of [props([]), props(undefined), { ...props([]), fremgangLoading: true }]) {
    const section = Analysis(p).querySelectorAll('[data-analysis-records]')[0]
    assert.equal(section, undefined)
  }
  for (const entropi2 of [false, undefined, 'true', 1])
    assert.equal(Analysis({ entropi2, get fremgangLogs() { throw Error('OFF read') }, get exerciseLogs() { throw Error('OFF read') } }), null)
})
