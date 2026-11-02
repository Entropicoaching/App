import test from 'node:test'
import assert from 'node:assert/strict'
import Analysis from './testRender.mjs'
import { analysisModel, QUESTIONS } from './analysisModel.mjs'
import { adaptPublicContract, uniqueLogs } from './publicContract.mjs'
import { estimatedOneRepMax } from '../../exerciseProgress.js'
import { hasEnoughData } from '../../dataEnough.mjs'
import { Element } from './testDom.mjs'

const now = new Date('2026-11-01T12:00:00Z')
const dates = ['2026-10-04', '2026-10-11', '2026-10-18', '2026-10-25']
const log = (day, weight = 100, name = 'Squat', reps = 3, extra = {}) => ({
  exercise_id: `ex-${day}`, logged_at: day + 'T10:00:00Z', weight, reps_completed: reps,
  exercises: { name, sessions: { weeks: { block_name: 'Styrke' } } }, ...extra,
})
const logs = () => dates.map((d, i) => log(d, 100 + i * 5))
const props = extra => ({ entropi2: true, now, fremgangLogs: logs(), ...extra })
const model = extra => analysisModel(props(extra), now)
const values = extra => model(extra).answers.slice(0, 2).map(a => a.value)
const noValues = rows => assert.deepEqual(values({ fremgangLogs: rows }), [undefined, undefined])

test('real imports use the existing formula and four-day D18 gate', () => {
  assert.equal(estimatedOneRepMax(100, 3), 110.00000000000001)
  assert.equal(hasEnoughData('D18', { rows: [] }), false)
  assert.deepEqual(values(), ['127 kg e1RM', '+17 kg e1RM'])
})
test('synthetic DOM renders exactly three questions and one value per answer', () => {
  const dom = Analysis(props())
  assert.ok(dom instanceof Element)
  assert.deepEqual(dom.querySelectorAll('h2').map(e => e.textContent), QUESTIONS)
  assert.equal(dom.querySelectorAll('[data-analysis-value]').length, 2)
  assert.equal(dom.querySelectorAll('svg').length, 0)
  assert.equal(dom.querySelectorAll('button').length, 0)
})
test('OFF is strict and does not read data or callbacks', () => {
  for (const entropi2 of [undefined, false, 1, 'true', '1', null]) {
    assert.equal(Analysis({ entropi2, get fremgangLogs() { throw Error('OFF read') } }), null)
  }
})
test('DOM button dispatch calls the unchanged existing callback with destination', () => {
  const calls = [], setTab = (...args) => { calls.push(args); return 'routed' }
  assert.equal(adaptPublicContract(props({ setTab }), now).setTab, setTab)
  const dom = Analysis(props({ setTab }))
  const buttons = dom.querySelectorAll('button')
  assert.equal(buttons.length, 3)
  for (const button of buttons) {
    assert.equal(button.getAttribute('type'), 'button')
    assert.equal(button.dispatchEvent({ type: 'click' }), 'routed')
  }
  assert.deepEqual(calls, [['hjem'], ['hjem'], ['program']])
})
test('callback errors propagate without writes or fabricated success', () => {
  const dom = Analysis(props({ setTab() { throw Error('navigation failed') } }))
  assert.throws(() => dom.querySelectorAll('button')[0].dispatchEvent({ type: 'click' }), /navigation failed/)
})
test('empty, missing and loading states give instructions without metrics', () => {
  for (const rows of [[], null, undefined, {}, [null]]) noValues(rows)
  assert.deepEqual(values({ fremgangLoading: true }), [undefined, undefined])
  assert.match(Analysis(props({ fremgangLogs: [] })).textContent, /Log vægt og gentagelser/)
  assert.match(Analysis(props({ fremgangLoading: true })).textContent, /Henter løftehistorik/)
})
test('three days or four days over less than 21 days are insufficient', () => {
  noValues(logs().slice(1))
  noValues(['2026-10-20', '2026-10-22', '2026-10-25', '2026-10-30'].map(d => log(d)))
})
test('same-day duplication cannot establish four independent days', () => {
  noValues(Array.from({ length: 20 }, (_, i) => log('2026-10-25', 100 + i)))
  assert.deepEqual(values({ fremgangLogs: [...logs(), ...logs()] }), values())
  assert.equal(uniqueLogs([...logs(), ...logs()]).length, 4)
})
test('conflicting duplicate positions, ids and exercise timestamps are discarded', () => {
  for (const identity of [{}, { id: 'same' }, { set_number: 1 }]) {
    const rows = logs().map(r => ({ ...r, ...identity }))
    const bad = { ...rows.at(-1), weight: 900 }
    noValues([...rows, bad])
  }
})
test('variant and repetition zones never pool', () => {
  noValues(logs().map((r, i) => i === 3 ? log(dates[i], 200, 'Front squat') : r))
  noValues(logs().map((r, i) => ({ ...r, reps_completed: i === 3 ? 6 : 3 })))
  assert.equal(values({ fremgangLogs: logs().map(r => ({ ...r, exercises: { ...r.exercises, name: 'Front squat' } })) })[0], '127 kg e1RM')
})
test('existing canonical aliases and top suffixes compare; light sets do not', () => {
  assert.equal(values({ fremgangLogs: logs().map((r, i) => ({ ...r,
    exercises: { ...r.exercises, name: i % 2 ? 'Bench top set' : 'Bænkpres' } })) })[0], '127 kg e1RM')
  for (const name of ['Squat backoff', 'Squat volumen', 'Squat teknik single', 'Squat sekundær'])
    noValues(logs().map(r => ({ ...r, exercises: { ...r.exercises, name } })))
})
test('deload, aflastning, taper and unknown block cannot establish strength', () => {
  for (const block_name of ['Deload', 'Aflastning', 'Taper', null, undefined]) {
    noValues(logs().map(r => ({ ...r, exercises: { name: 'Squat', sessions: { weeks: { block_name } } } })))
  }
})
test('nonfinite, fractional, excessive, negative and empty numbers do not enter metrics', () => {
  for (const weight of [NaN, Infinity, -1, '', null, {}, '1e999']) noValues(logs().map(r => ({ ...r, weight })))
  for (const reps_completed of [NaN, Infinity, 0, -1, 3.5, 9, '', null])
    noValues(logs().map(r => ({ ...r, reps_completed })))
  assert.equal(values({ fremgangLogs: logs().map(r => ({ ...r, weight: '100,5' })) })[0], '111 kg e1RM')
})
test('missing, normalized invalid, timezone-free and future dates are excluded', () => {
  for (const logged_at of [null, undefined, '', '2026-02-30', '2026-10-32T10:00:00Z',
    '2026-11-02T10:00:00Z', '2026-11-01T13:00:00Z', '2026-10-25T10:00:00', 'October 25, 2026']) {
    noValues(logs().map((r, i) => i === 3 ? { ...r, logged_at } : r))
  }
})
test('freshness boundaries: 14 days accepted, 15 days and old-only rejected', () => {
  const rows = ['2026-09-27', '2026-10-04', '2026-10-11', '2026-10-18'].map(d => log(d))
  assert.ok(values({ fremgangLogs: rows })[0])
  noValues(rows.map(r => ({ ...r, logged_at: r.logged_at.replace('10-18', '10-17') })))
  noValues(['2026-06-01', '2026-06-08', '2026-06-15', '2026-06-22'].map(d => log(d)))
})
test('declining or flat logs never claim a positive result or cause', () => {
  for (const rows of [logs().map(r => ({ ...r, weight: 100 })), logs().map((r, i) => ({ ...r, weight: 120 - i * 5 }))]) {
    const answer = model({ fremgangLogs: rows }).answers[1]
    assert.equal(answer.value, undefined)
    assert.match(answer.message, /ingen stigning/)
    assert.doesNotMatch(answer.message, /plateau|overtræn|træt/)
  }
})
test('input order does not alter results; frozen public rows are not mutated', () => {
  const rows = logs(); rows.forEach(Object.freeze); Object.freeze(rows)
  assert.deepEqual(values({ fremgangLogs: rows }), values({ fremgangLogs: [...rows].reverse() }))
})
const currentWeek = { start_date: '2026-10-26', block_name: 'Styrke <img src=x>',
  sessions: [{ exercises: [{ id: 'current', name: 'Squat' }] }] }
test('current dated program is labelled as plan; stale and missing plans give instructions', () => {
  const dom = Analysis(props({ currentWeek }))
  assert.equal(dom.querySelectorAll('[data-analysis-value]').length, 3)
  assert.match(dom.textContent, /Styrke <img src=x>/)
  assert.equal(dom.querySelectorAll('img').length, 0)
  assert.equal(model({ currentWeek: { ...currentWeek, start_date: '2026-10-19' } }).answers[2].value, undefined)
  assert.equal(model({ currentWeek: { ...currentWeek, start_date: '2026-11-02' } }).answers[2].value, undefined)
})
test('local edits and undo own current week without reviving saved historical set', () => {
  const saved = { ...logs()[3], exercise_id: 'current' }
  const history = [...logs().slice(0, 3), saved]
  const base = { currentWeek, fremgangLogs: history }
  noValues([])
  assert.equal(model({ ...base, exerciseLogs: [] }).answers[0].value, undefined)
  assert.equal(model({ ...base, exerciseLogs: [{ ...saved, logged_at: '2026-10-28T10:00:00Z', set_number: 1, weight: 120 }] }).answers[0].value, '132 kg e1RM')
  assert.equal(model({ ...base, exerciseLogs: [{ ...saved, skipped: true }] }).answers[0].value, undefined)
})
test('local deload remains excluded and focus explains the actual lighter block', () => {
  const week = { ...currentWeek, block_name: 'Deload' }
  const m = model({ currentWeek: week, fremgangLogs: logs().slice(0, 3), exerciseLogs: [{
    exercise_id: 'current', set_number: 1, logged_at: '2026-10-28', weight: 200, reps_completed: 3 }] })
  assert.equal(m.answers[0].value, undefined)
  assert.match(m.answers[2].message, /lettere uge/)
})
