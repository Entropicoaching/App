import test from 'node:test'
import assert from 'node:assert/strict'
import { addCalendarDays } from '../../calendarDate.js'
import { developmentModel } from './developmentModel.mjs'
import DevelopmentView from './DevelopmentView.mjs'
import { renderTree } from './testDom.mjs'

const now = '2026-11-04T12:00:00Z'
const row = (name, i = 25, extra = {}) => ({
  athlete_id: 'synthetic-a', exercise_id: `synthetic-${name}-${i}`,
  logged_at: addCalendarDays('2026-05-13', i * 7), weight: 100 + i, reps_completed: 3,
  exercises: { name, sessions: { weeks: { block_name: 'Styrke' } } }, ...extra,
})
const input = (fremgangLogs, extra = {}) => ({ entropi2: true, now,
  athlete: { id: 'synthetic-a', competition_date: '2026-11-18' }, fremgangLogs, ...extra })
const view = props => renderTree(DevelopmentView(props))
const model = props => developmentModel(props, now)

for (const [trained, absent] of [['Dødløft', 'Sumo dødløft'], ['Sumo dødløft', 'Dødløft']]) {
  test(`only trained ${trained} appears in the chart, evidence and forecast`, () => {
    const props = input(Array.from({ length: 26 }, (_, i) => row(trained, i)))
    const result = model(props), dom = view(props)
    assert.deepEqual(result.lifts.map(lift => lift.lift), [trained])
    assert.deepEqual(result.forecast.lifts.map(lift => lift.lift), [trained])
    assert.equal(result.forecast.lifts[0].status, 'ready')
    assert.deepEqual(dom.querySelectorAll('h3').filter(h => [trained, absent].includes(h.textContent))
      .map(h => h.textContent), [trained])
    assert.equal(dom.querySelectorAll('[data-history-value]').length, 26)
    assert.equal(dom.querySelectorAll('[data-history-bar]').length, 26)
    assert.match(dom.textContent, /steget 27,5 kg/)
  })
}

test('mixed lift styles remain distinct and independent of input order', () => {
  const logs = [row('sumo deadlift', 24), row('conventional deadlift', 25)]
  const result = model(input(logs))
  assert.deepEqual(result.lifts.map(l => l.lift), ['Dødløft', 'Sumo dødløft'])
  assert.deepEqual(result, model(input(logs.toReversed())))
  assert.equal(result.lifts[0].points.at(-1).value, 137.5)
  assert.equal(result.lifts[1].points.at(-2).value, 136.4)
})

test('light or deload training makes a lift visible without fabricating a strength trend', () => {
  for (const record of [row('Dødløft', 25, { reps_completed: 12 }),
    row('Dødløft', 25, { exercises: { name: 'Dødløft', sessions: { weeks: { block_name: 'Deload' } } } })]) {
    const props = input([record]), result = model(props), dom = view(props)
    assert.deepEqual(result.lifts.map(l => l.lift), ['Dødløft'])
    assert.equal(result.lifts[0].observed, 0)
    assert.equal(result.lifts[0].delta, null)
    assert.equal(dom.querySelectorAll('[data-history-bar]').length, 0)
    assert.match(dom.textContent, /for lidt data/)
    assert.doesNotMatch(dom.textContent, /Sumo dødløft/)
  }
})

test('unconfirmed, invalid, foreign, old, future and variant rows never add unused lifts', () => {
  const valid = row('Squat')
  const rejected = [
    row('Sumo dødløft', 25, { athlete_id: 'synthetic-other' }),
    row('Sumo dødløft', 25, { pending: true }),
    row('Sumo dødløft', 25, { _optimistic: true }),
    row('Sumo dødløft', 25, { skipped: true }),
    row('Sumo dødløft', 25, { weight: 0 }),
    row('Sumo dødløft', 25, { reps_completed: 1.5 }),
    row('Sumo dødløft', 25, { logged_at: '2026-05-10' }),
    row('Sumo dødløft', 25, { logged_at: '2026-11-05' }),
    row('Sumo dødløft', 25, { logged_at: '2026-02-30' }),
    row('Pause squat'),
  ]
  for (const record of rejected) {
    assert.deepEqual(model(input([valid, record])).lifts.map(l => l.lift), ['Squat'])
  }
  const saved = row('Sumo dødløft', 25, { id: 'synthetic-conflict', set_number: 1 })
  assert.deepEqual(model(input([valid, saved, { ...saved, weight: 999 }])).lifts.map(l => l.lift), ['Squat'])
})

test('undo of the only recorded lift removes its chart and forecast row', () => {
  const saved = row('Dødløft', 25, { exercise_id: 'synthetic-local' })
  const props = input([saved], { currentWeek: { start_date: '2026-11-02', block_name: 'Styrke',
    sessions: [{ exercises: [{ id: 'synthetic-local', name: 'Dødløft' }] }] }, exerciseLogs: [] })
  assert.deepEqual(model(props).lifts, [])
  assert.deepEqual(model(props).forecast.lifts, [])
  assert.match(view(props).textContent, /Ingen registrerede hovedløft/)
})

test('explicit load failures are alerts, suppress stale data and never say not ready', () => {
  for (const error of ['fremgangError', 'exerciseLogsError']) {
    const props = input([row('Squat')], { [error]: 'synthetic failure', fremgangLoading: true })
    const result = model(props), dom = view(props)
    assert.equal(result.state, 'error')
    assert.equal(result.forecast, null)
    assert.equal(dom.querySelectorAll('[role]')[0].getAttribute('role'), 'alert')
    assert.match(dom.textContent, /Din udvikling kunne ikke hentes/)
    assert.doesNotMatch(dom.textContent, /ikke klar|synthetic failure|kg e1RM/)
  }
})

test('missing history without an error flag describes the missing data without claiming a cause', () => {
  const props = input(null, { fremgangLoading: false })
  assert.equal(model(props).state, 'unavailable')
  const dom = view(props)
  assert.match(dom.textContent, /kunne ikke vises: løftehistorikken mangler/)
  assert.doesNotMatch(dom.textContent, /ikke klar|netværksfejl|kunne ikke hentes/)
  assert.match(view(input(null, { fremgangLoading: true })).textContent, /Henter din udvikling/)
})
