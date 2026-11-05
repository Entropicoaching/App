import test from 'node:test'
import assert from 'node:assert/strict'
import Analysis from './Analysis.mjs'
import WeeklyReport from './ugerapport/WeeklyReport.mjs'
import DevelopmentView from './DevelopmentView.mjs'
import { renderTree } from './testDom.mjs'
import { analysisMineData } from './analysisMineData.mjs'
import { mineDataModel } from '../athlete/minedata/mineDataModel.mjs'

const now = new Date('2026-11-04T12:00:00Z')
const ready = rows => ({ state: 'ready', rows })
const row = extra => ({ athlete_id: 'synthetic-a', date: '2026-11-03', ...extra })
const log = extra => ({ exercise_id: 'old', logged_at: '2026-11-03T10:00:00Z',
  weight: 100, reps_completed: 3, exercises: { name: 'Squat' }, ...extra })
const props = extra => ({ entropi2: true, now, athlete: { id: 'synthetic-a' },
  fremgangLogs: [], historicalMealLogs: [], weightLogs: [], ...extra })
const nodes = n => !n || typeof n !== 'object' ? [] : [n, ...[n.props?.children].flat(Infinity).flatMap(nodes)]
const marked = (tree, key) => nodes(tree).find(n => n.props?.[key])
const model = p => mineDataModel(analysisMineData(p, now))

test('composition: development is first, weekly report and secondary analysis start closed', () => {
  const tree = Analysis(props({ fremgangLogs: [log()], historicalMealLogs: [{ date: '2026-11-03', kcal: 500 }] })), children = tree.props.children
  assert.equal(children[0].type, 'h1')
  assert.equal(children[1].type, DevelopmentView)
  const secondary = marked(tree, 'data-analysis-secondary')
  assert.equal(secondary.type, 'details')
  assert.equal(secondary.props.open, undefined)
  assert.equal(secondary.props.children[1].type, WeeklyReport)
  for (const key of ['data-analysis-mine-data', 'data-analysis-more']) {
    const detail = marked(tree, key)
    assert.equal(detail.type, 'details'); assert.equal(detail.props.open, undefined)
    assert.equal(detail.props.children[0].type, 'summary')
    assert.ok(detail.props.children[0].props.style.minHeight >= 44)
  }
  const mineData = marked(tree, 'data-analysis-mine-data')
  assert.ok(nodes(secondary).includes(mineData))
  // This fold combines current-program-week sessions and four-week snapshots.
  // The summary must not imply four weeks of session coverage.
  assert.equal(mineData.props.children[0].props.children, 'Mine data')
  const dom = renderTree(tree)
  assert.equal(dom.querySelectorAll('[data-entropi2-ugerapport]').length, 1)
  assert.equal(dom.querySelectorAll('[data-analysis-week]').length, 0)
  assert.equal(dom.querySelectorAll('[data-analysis-history]').length, 1)
  assert.equal(dom.querySelectorAll('figure').length, 1)
  assert.equal(nodes(marked(tree, 'data-analysis-mine-data')).filter(n => n.type === 'figure').length, 0)
  assert.equal(nodes(marked(tree, 'data-analysis-more')).filter(n => n.props?.['data-analysis-history']).length, 0)
})

test('actual connected leaf imports display normalized four-week data', () => {
  const mineData = { sessions: ready([row({ id: 's', status: 'completed' })]),
    records: ready([row({ id: 'r', exerciseId: 'squat', exercise: 'Squat', weightKg: 100, reps: 3 })]),
    nutritionDays: ready([row({ goalMet: true })]), weights: ready([row({ kg: 80 })]) }
  const dom = renderTree(Analysis(props({ mineData })))
  assert.match(dom.textContent, /08.10.2026 til 04.11.2026/)
  assert.match(dom.textContent, /1 registrerede, gennemførte pas/)
  assert.doesNotMatch(dom.textContent, /Rekorder i perioden/)
  assert.match(dom.textContent, /1 af 1 kostdage/)
  assert.match(dom.textContent, /1 dage med registreret kropsvægt/)
})

test('legacy bridge uses real logs; absent 28-day session coverage and meal goals stay unknown', () => {
  const p = props({ fremgangLogs: [log()], historicalMealLogs: [{ date: '2026-11-03', kcal: 500, meal: 'Mad' }],
    weightLogs: [{ athlete_id: 'synthetic-a', logged_at: '2026-11-03', weight: '80,5' }] })
  const m = model(p)
  assert.equal(m.records.lifts[0].weightKg, 100)
  assert.equal(m.sessions.state, 'unavailable')
  assert.equal(m.nutrition.loggedDays, 1); assert.equal(m.nutrition.assessedDays, 0)
  assert.equal(m.weight.weeks[3].kg, 80.5)
  const text = renderTree(Analysis(p)).textContent
  assert.match(text, /Loggede kostdage1 registrerede dage af 28/)
  assert.doesNotMatch(text, /Ingen kostdage med et kendt mål|ukendt målstatus/)
})

test('empty, missing, loading and error render without fabricated observations', () => {
  assert.equal(model(props()).records.state, 'ready')
  assert.equal(model(props()).records.lifts.length, 0)
  const missing = props({ fremgangLogs: undefined, weightLogs: undefined, historicalMealLogs: undefined })
  assert.equal(model(missing).records.state, 'unavailable')
  for (const state of ['loading', 'error']) {
    const mineData = Object.fromEntries(['sessions', 'records', 'nutritionDays', 'weights']
      .map(key => [key, { state, rows: [row({ kg: 80 })] }]))
    const dom = renderTree(Analysis(props({ mineData, fremgangLoading: state === 'loading', fremgangError: state === 'error' })))
    assert.match(dom.textContent, state === 'loading' ? /Henter din udvikling/ : /kunne ikke hentes/)
    assert.equal(model(props({ mineData })).weight.recordedDays, 0)
  }
  assert.equal(model(props({ weightError: true })).weight.state, 'error')
  assert.equal(model(props({ mealLoading: true })).nutrition.state, 'loading')
  assert.equal(model(props({ fremgangError: true })).records.state, 'error')
})

test('local edits and empty undo override history, pending conflicts and foreign rows supply no records', () => {
  const currentWeek = { start_date: '2026-11-02', sessions: [{ exercises: [{ id: 'old', name: 'Squat' }] }] }
  assert.equal(model(props({ currentWeek, fremgangLogs: [log()], exerciseLogs: [] })).records.lifts.length, 0)
  const saved = log({ set_number: 1 })
  assert.equal(model(props({ currentWeek, fremgangLogs: [saved], exerciseLogs: [saved, { ...saved, _optimistic: true }] })).records.lifts.length, 0)
  assert.equal(model(props({ fremgangLogs: [log({ athlete_id: 'foreign' }), log({ logged_at: '2026-11-05' })] })).records.lifts.length, 0)
  assert.equal(model(props({ fremgangLogs: [saved, { ...saved, weight: 999 }] })).records.lifts.length, 0)
  assert.equal(model(props({ currentWeek, fremgangLogs: [], exerciseLogs: [log({ weight: '102,5' })] })).records.lifts[0].weightKg, 102.5)
})

test('host identity/date override supplied snapshot; foreign and out-of-window data are excluded', () => {
  const mineData = { athleteId: 'foreign', today: '2027-01-01', sessions: ready([
    row({ id: 'foreign', athlete_id: 'foreign', status: 'completed' }),
    row({ id: 'old', date: '2026-10-07', status: 'completed' }),
    row({ id: 'pending', pending: true, status: 'completed' })]) }
  const m = model(props({ mineData }))
  assert.equal(m.end, '2026-11-04'); assert.equal(m.sessions.completed, 0)
})

test('strict OFF reads no input; frozen connected snapshots are unchanged', () => {
  for (const entropi2 of [undefined, false, 1, 'true']) assert.equal(Analysis({ entropi2,
    get mineData() { throw Error('OFF data') }, get now() { throw Error('OFF clock') } }), null)
  const p = props({ fremgangLogs: [log()] }), before = JSON.stringify(p)
  const freeze = x => { if (x && typeof x === 'object') { Object.values(x).forEach(freeze); Object.freeze(x) } }
  freeze(p); Analysis(p); assert.equal(JSON.stringify(p), before)
})
