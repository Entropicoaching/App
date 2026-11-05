import test from 'node:test'
import assert from 'node:assert/strict'
import { weeklyReportModel as model } from './weeklyReportModel.mjs'
import WeeklyReport from './WeeklyReport.mjs'
import { renderTree } from '../testDom.mjs'

const now = new Date('2026-11-04T12:00:00Z')
const log = (extra = {}) => ({ exercise_id: 'squat', set_number: 1,
  logged_at: '2026-11-03T10:00:00Z', weight: 100, reps_completed: 3, ...extra })
const meal = (date, extra = {}) => ({ date, meal: 'Måltid', kcal: 500, ...extra })
const weigh = (date, weight, extra = {}) => ({ athlete_id: 'synthetic-athlete', logged_at: date, weight, ...extra })
const props = (extra = {}) => ({ entropi2: true, now, athlete: { id: 'synthetic-athlete' },
  currentWeek: { start_date: '2026-11-02', block_name: 'Styrke', sessions: [
    { exercises: [{ id: 'squat', name: 'Squat', sets: 1 }] },
    { exercises: [{ id: 'bench', name: 'Bænkpres', sets: 1 }] }] },
  exerciseLogs: [log()], fremgangLogs: [],
  historicalMealLogs: [meal('2026-11-02'), meal('2026-11-03')],
  weightLogs: [weigh('2026-11-02', 80), weigh('2026-11-04', 80.3)], ...extra })
const snapshot = extra => model(props(extra), now)
const frozen = object => { if (object && typeof object === 'object') { Object.values(object).forEach(frozen); Object.freeze(object) } return object }

test('actual model imports: planned sessions, top e1RM, distinct meal days and first/last weight', () => {
  const m = snapshot()
  assert.equal(m.period, '02.11.2026 til 08.11.2026')
  assert.equal(m.sessions, 'Pas gennemført: 1 af 2 planlagt.')
  assert.ok(Math.abs(m.lifts[0].value - 110) < 1e-9)
  assert.deepEqual(m.lifts.slice(1).map(r => r.value), [null, null, null])
  assert.equal(m.mealDays, 2)
  assert.ok(Math.abs(m.weight.delta - 0.3) < 1e-9)
  assert.match(m.weight.message, /02.11.2026.*04.11.2026.*ikke en vægttrend/)
})

test('missing, empty, loading and error snapshots remain distinct', () => {
  const missing = model({}, now)
  assert.equal(missing.mealDays, null); assert.equal(missing.weight.days, null)
  assert.match(missing.sessions, /mangler/); assert.equal(missing.lifts[0].value, null)
  const empty = snapshot({ exerciseLogs: [], historicalMealLogs: [], weightLogs: [] })
  assert.equal(empty.mealDays, 0); assert.equal(empty.weight.days, 0)
  assert.equal(empty.sessions, 'Pas gennemført: 0 af 2 planlagt.')
  for (const flags of [{ mealLoading: true, weightLoading: true, fremgangLoading: true, exerciseLogsLoading: true },
    { mealError: 'synthetic', weightError: 'synthetic', fremgangError: 'synthetic', exerciseLogsError: 'synthetic' }]) {
    const m = snapshot(flags)
    assert.equal(m.mealDays, null); assert.equal(m.weight.delta, null)
    assert.equal(m.lifts[0].value, null); assert.match(m.sessions, /mangler/)
  }
})

test('strict OFF never reads data or clock', () => {
  for (const entropi2 of [undefined, false, null, 0, 1, 'true']) {
    assert.equal(WeeklyReport({ entropi2,
      get now() { throw Error('clock read') }, get exerciseLogs() { throw Error('data read') } }), null)
  }
})

test('invalid/missing date gives honest state, no implicit clock', () => {
  for (const date of [undefined, null, new Date('bad'), '2026-02-30T12:00:00Z', '2026-11-04', 'bad']) {
    assert.equal(model(props(), date).ready, false)
  }
  assert.match(renderTree(WeeklyReport(props({ now: undefined }))).textContent, /dato mangler/)
})

test('local undo owns historical current exercise; retries, skips and pending never inflate best', () => {
  const history = { ...log(), exercises: { name: 'Squat', sessions: { weeks: { block_name: 'Styrke' } } } }
  assert.equal(snapshot({ exerciseLogs: [], fremgangLogs: [history] }).lifts[0].value, null)
  assert.equal(snapshot({ exerciseLogs: [log(), log()] }).sessions, 'Pas gennemført: 1 af 2 planlagt.')
  for (const rows of [[log(), log({ weight: 200 })], [log(), log({ _optimistic: true })], [log({ _optimistic: true })]]) {
    const m = snapshot({ exerciseLogs: rows })
    assert.equal(m.sessions, 'Pas gennemført: 0 af 2 planlagt.'); assert.equal(m.lifts[0].value, null)
  }
  const unavailable = snapshot({ exerciseLogsLoading: true, fremgangLogs: [history] })
  assert.equal(unavailable.lifts[0].value, null)
  const skipped = snapshot({ exerciseLogs: [log({ skipped: true })] })
  assert.equal(skipped.sessions, 'Pas gennemført: 1 af 2 planlagt.'); assert.equal(skipped.lifts[0].value, null)
})

test('existing main-lift eligibility rejects variants, light sets, deload and invalid values', () => {
  for (const name of ['Front squat', 'Squat backoff', 'Squat teknik single']) {
    const p = props(); p.currentWeek.sessions[0].exercises[0].name = name
    assert.equal(model(p, now).lifts[0].value, null)
  }
  for (const block_name of ['Deload', 'Taper', 'Aflastning', '', null]) {
    const p = props(); p.currentWeek.block_name = block_name
    assert.equal(model(p, now).lifts[0].value, null)
  }
  for (const change of [{ weight: NaN }, { weight: Infinity }, { weight: 0 }, { reps_completed: 1.5 },
    { reps_completed: 20 }, { logged_at: '2026-11-04T15:00:00Z' }, { logged_at: '2026-02-30' }])
    assert.equal(snapshot({ exerciseLogs: [log(change)] }).lifts[0].value, null)
})

test('top estimates for all four canonical main lifts come from existing formula', () => {
  const names = ['Squat', 'Bænkpres', 'Dødløft', 'Sumo dødløft']
  const fremgangLogs = names.map((name, i) => ({ ...log({ exercise_id: `old-${i}`, weight: 100 + i * 10 }),
    exercises: { name, sessions: { weeks: { block_name: 'Styrke' } } } }))
  const m = snapshot({ fremgangLogs, exerciseLogs: [] })
  assert.deepEqual(m.lifts.map(r => Math.round(r.value)), [110, 121, 132, 143])
})

test('nutrition counts valid distinct calendar dates, excludes receipts, pending, future and malformed rows', () => {
  const historicalMealLogs = [meal('2026-11-02'), meal('2026-11-02'), meal('2026-11-04', { kcal: '0' }),
    meal('2026-11-01'), meal('2026-11-05'), meal('2026-02-30'), null,
    meal('2026-11-03', { meal: ' [appData2-day-v1]receipt' }),
    meal('2026-11-03', { _optimistic: true }), meal('2026-11-03', { kcal: 'bad' })]
  assert.equal(snapshot({ historicalMealLogs }).mealDays, 2)
})

test('weight filters ownership, invalid/future/pending rows; duplicate and conflicting days are deterministic', () => {
  const weightLogs = [...props().weightLogs, weigh('2026-11-02', '80,0'), weigh('2026-11-03', 81),
    weigh('2026-11-03', 82), weigh('2026-11-04', 99, { athlete_id: 'synthetic-other' }),
    weigh('2026-11-05', 99), weigh('2026-11-01', 99), weigh('2026-02-30', 99),
    weigh('2026-11-03', 99, { _optimistic: true }), weigh('2026-11-04T15:00:00Z', 99),
    weigh('2026-11-03', Infinity), weigh('2026-11-03', 0), null]
  const m = snapshot({ weightLogs }).weight
  assert.equal(m.days, 2); assert.ok(Math.abs(m.delta - 0.3) < 1e-9)
  assert.deepEqual(snapshot({ weightLogs: weightLogs.reverse() }).weight, m)
  assert.equal(snapshot({ athlete: undefined }).weight.delta, null)
  assert.equal(snapshot({ weightLogs: [weigh('2026-11-02', 80)] }).weight.delta, null)
  for (const value of [80, 80.01, 79.99])
    assert.equal(snapshot({ weightLogs: [weigh('2026-11-02', 80), weigh('2026-11-04', value)] }).weight.delta, 0)
})

test('program and fallback calendar periods align every metric; Danish midnight and DST', () => {
  const p = props(); p.currentWeek.start_date = '2026-10-30'
  p.historicalMealLogs = [meal('2026-10-29'), meal('2026-10-30'), meal('2026-11-04'), meal('2026-11-05')]
  const m = model(p, now)
  assert.equal(m.start, '2026-10-30'); assert.equal(m.end, '2026-11-05'); assert.equal(m.mealDays, 2)
  for (const [clock, start, today] of [['2026-11-01T23:30:00Z', '2026-11-02', '2026-11-02'],
    ['2026-10-25T00:30:00Z', '2026-10-19', '2026-10-25'],
    ['2026-01-01T12:00:00Z', '2025-12-29', '2026-01-01']]) {
    const result = model({}, clock); assert.equal(result.start, start); assert.equal(result.today, today)
  }
})

test('frozen data is unchanged and synthetic view contains accessible compact fluid structure', () => {
  const p = frozen(props()), before = structuredClone(p), tree = WeeklyReport(p), dom = renderTree(tree)
  assert.deepEqual(p, before)
  assert.equal(tree.props.style.width, '100%'); assert.equal(tree.props.style.maxWidth, 480)
  assert.equal(tree.props.style.boxSizing, 'border-box'); assert.equal(tree.props.style.overflowWrap, 'anywhere')
  assert.equal(tree.props['aria-label'], 'Din ugerapport')
  assert.equal(dom.querySelectorAll('h2').length, 1); assert.equal(dom.querySelectorAll('li').length, 1)
  assert.equal(dom.querySelectorAll('details').length, 1); assert.equal(dom.querySelectorAll('button').length, 0)
  assert.match(dom.textContent, /110 kg e1RM/); assert.match(dom.textContent, /Kostdage logget: 2 af 7/)
  assert.match(dom.textContent, /Vægtændring: \+0,3 kg/)
  assert.doesNotMatch(dom.textContent, /NaN|Infinity|undefined/)
})
