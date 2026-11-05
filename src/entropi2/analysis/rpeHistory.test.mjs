import test from 'node:test'
import assert from 'node:assert/strict'
import { rpeHistory } from './rpeHistory.mjs'
import { analysisModel } from './analysisModel.mjs'
import Analysis from './testRender.mjs'

const now = new Date('2026-11-04T12:00:00Z')
const log = (id, rpe_actual = 8, name = 'Squat', logged_at = '2026-11-03T10:00:00Z') => ({
  id, exercise_id: id, logged_at, rpe_actual, rpe_source: 'athlete',
  exercises: { name },
})
const model = (logs, extra = {}) => rpeHistory({ fremgangLogs: logs, ...extra }, now)
const point = (logs, extra) => model(logs, extra).series[0].points.at(-1)

test('RPE: six Monday weeks include current partial week, gaps are null', () => {
  const h = model([])
  assert.equal(h.series.length, 5)
  for (const row of h.series) {
    assert.equal(row.points.length, 6)
    assert.equal(row.points[0].start, '2026-09-28')
    assert.equal(row.points[5].end, '2026-11-08')
    assert.ok(row.points.every(p => p.value === null && p.count === 0))
  }
  assert.equal(rpeHistory({}, new Date('invalid')).series.length, 0)
})

test('RPE: arithmetic set mean and coverage exclude missing, invalid and unconfirmed answers', () => {
  const logs = [log('a', 7), log('b', 8.5), log('c', 0), log('missing', null),
    log('invalid', 11), log('string', '8'), { ...log('unknown'), rpe_source: undefined },
    { ...log('planned'), rpe_actual: undefined, rpe_planned: 9 }]
  const p = point(logs)
  assert.equal(p.value, 15.5 / 3)
  assert.equal(p.count, 3)
  assert.equal(p.excluded, 5)
  assert.equal(p.text, 'RPE 5,2')
  assert.match(p.coverage, /3 svar af 8 registrerede sæt/)
  assert.equal(point([log('zero', 0)]).text, 'RPE 0')
  for (const bad of [NaN, Infinity, -1, '', {}, true]) assert.equal(point([log('bad', bad)]).value, null)
})

test('RPE: four canonical lifts stay separate; aggregate weights sets rather than lift means', () => {
  const logs = [log('a', 6, 'Back squat'), log('b', 8, 'Squat backoff'),
    log('c', 10, 'Bench top set'), log('d', 7, 'Deadlift'), log('e', 9, 'Sumo deadlift'),
    log('variant', 1, 'Front squat')]
  const rows = model(logs).series
  assert.deepEqual(rows.map(r => r.points.at(-1).value), [8, 7, 10, 7, 9])
  assert.equal(rows[0].points.at(-1).count, 5)
  assert.deepEqual(model(logs), model([...logs].reverse()))
})

test('RPE: descriptive values do not require weight, reps, heavy sets or known blocks', () => {
  const logs = [log('a', 7, 'Squat backoff'), { ...log('b', 9), weight: 20, reps_completed: 15,
    exercises: { name: 'Squat', sessions: { weeks: { block_name: 'Deload' } } } }]
  assert.equal(point(logs).value, 8)
  assert.equal(analysisModel({ fremgangLogs: logs }, now).rpeHistory.series[0].points.at(-1).value, 8)
})

test('RPE: exact duplicates count once and conflicting ratings/provenance never choose a winner', () => {
  const a = log('a')
  assert.equal(point([a, { ...a }]).count, 1)
  for (const change of [{ rpe_actual: 6 }, { rpe_source: 'default' }, { _optimistic: true }, { skipped: true }]) {
    assert.equal(point([a, { ...a, ...change }]).count, 0)
  }
  const noId = { ...a, id: undefined, set_number: 1 }
  assert.equal(point([noId, { ...noId, rpe_actual: 6 }]).count, 0)
  assert.equal(point([{ ...noId, id: 'first' }, { ...noId, id: 'retry' }]).count, 1)
  assert.equal(point([{ ...noId, id: 'first' }, { ...noId, id: 'retry', rpe_actual: 6 }]).count, 0)
  assert.equal(point([a, { ...a, exercise_id: 'different', logged_at: '2026-11-02' }]).count, 0)
  const noPosition = { ...noId, set_number: undefined }
  assert.equal(point([noPosition, { ...noPosition, rpe_actual: 6 }]).count, 0)
})

test('RPE: future, invalid, pending, skipped and outside-window rows are excluded', () => {
  const dates = ['2026-09-27', '2026-11-05', '2026-11-04T13:00:00Z', '2026-02-30',
    '2026-11-03T24:00:00Z', '2026-11-03T10:00:00', 'yesterday']
  for (const date of dates) assert.equal(point([log('bad', 8, 'Squat', date)]).count, 0)
  for (const change of [{ skipped: true }, { _optimistic: true }])
    assert.equal(point([{ ...log('bad'), ...change }]).count, 0)
  assert.equal(model([log('edge', 8, 'Squat', '2026-09-28')]).series[0].points[0].value, 8)
})

test('RPE: Danish Monday boundaries in summer/winter and year rollover', () => {
  for (const [instant, before, after, monday] of [
    ['2026-11-01T23:30:00Z', '2026-11-01T22:59:59Z', '2026-11-01T23:00:00Z', '2026-11-02'],
    ['2026-07-05T22:30:00Z', '2026-07-05T21:59:59Z', '2026-07-05T22:00:00Z', '2026-07-06'],
    ['2026-01-04T23:30:00Z', '2026-01-04T22:59:59Z', '2026-01-04T23:00:00Z', '2026-01-05'],
  ]) {
    const h = rpeHistory({ fremgangLogs: [log('before', 7, 'Squat', before), log('after', 9, 'Squat', after)] }, new Date(instant))
    assert.equal(h.series[0].points[5].start, monday)
    assert.equal(h.series[0].points[4].value, 7)
    assert.equal(h.series[0].points[5].value, 9)
  }
})

const currentWeek = { start_date: '2026-11-02', sessions: [{ exercises: [{ id: 'local', name: 'Squat' }] }] }
test('RPE: local edits/undo own saved exercise IDs and pending rows cannot revive history', () => {
  const saved = { ...log('saved', 10), exercise_id: 'local' }
  const base = { currentWeek, exerciseLogs: [] }
  assert.equal(point([saved], base).value, null)
  const local = { ...log('local', 6), set_number: 1, exercises: undefined }
  assert.equal(point([saved], { ...base, exerciseLogs: [local] }).value, 6)
  assert.equal(point([saved], { ...base, exerciseLogs: [{ ...local, _optimistic: true }] }).value, null)
  assert.equal(point([saved], { ...base, exerciseLogs: [{ ...local, logged_at: '2026-10-30' }] }).value, null)
})

test('RPE: note provenance uses original timestamp, loading and missing fields stay honest', () => {
  const row = { ...log('a'), rpe_source: undefined, weight: 100, reps_completed: 3 }
  row.note = '\n[appData2-rpe-v1:' + JSON.stringify([8, 100, 3, row.logged_at]) + ']'
  assert.equal(point([row]).value, 8)
  assert.equal(point([{ ...row, rpe_actual: 9 }]).value, null)
  assert.equal(point([{ ...row, rpe_actual: undefined, note: undefined }]).excluded, 1)
  for (const h of [model([row], { fremgangLoading: true }), rpeHistory({}, now)]) {
    assert.match(h.message, /ikke klar/)
    assert.ok(h.series.every(s => s.points.every(p => p.value === null && /ikke klar/.test(p.text))))
  }
})

test('RPE DOM: only rated weeks and lifts, accessible disclosure and program shortcut', () => {
  const calls = []
  const dom = Analysis({ entropi2: true, now, fremgangLogs: [log('a', 8.5)], setTab: tab => calls.push(tab) })
  const view = dom.querySelectorAll('[data-analysis-rpe]')[0]
  assert.equal(view.querySelectorAll('details').length, 2)
  assert.equal(view.querySelectorAll('ol').length, 2)
  assert.equal(view.querySelectorAll('li').length, 2)
  assert.match(view.textContent, /RPE 8,5/)
  assert.match(view.textContent, /1 svar af 1 registreret sæt/)
  assert.doesNotMatch(view.textContent, /Ingen RPE-data|0 svar/)
  assert.match(view.textContent, /dokumenterede egne RPE-svar/)
  assert.equal(view.querySelectorAll('[data-analysis-destination]').length, 0)
  dom.querySelectorAll('[data-analysis-destination]').forEach(b => b.dispatchEvent({ type: 'click' }))
  assert.deepEqual(calls, ['program'])
  const titles = dom.querySelectorAll('h2').map(n => n.textContent)
  assert.ok(!titles.includes('Intensitet pr. uge'))
  assert.ok(titles.includes('RPE de seneste 6 uger'))
})

test('RPE: strict OFF reads no props and frozen input stays unchanged', () => {
  for (const entropi2 of [false, undefined, 1, 'true']) assert.equal(Analysis({ entropi2,
    get exerciseLogs() { throw Error('OFF read') }, get fremgangLogs() { throw Error('OFF read') } }), null)
  const props = { fremgangLogs: [log('a')], currentWeek, exerciseLogs: [] }
  const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) } }
  const before = JSON.stringify(props); freeze(props)
  rpeHistory(props, now)
  assert.equal(JSON.stringify(props), before)
})
