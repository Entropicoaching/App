import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './hjem2Loader.mjs'
import { createElement, nodes, text } from './hjem2Dom.mjs'
const hooks = install()
const { nextTrainingHome, renderNextTrainingHome, DEFAULT_NEXT_TRAINING_HOME } = await import('./nextTrainingHome.mjs')
const HjemTab = (await import('./HjemTab.jsx')).default
const EnkelHjemTab = (await import('./EnkelHjemTab.jsx')).default

const exercise = (id = 'squat', sets = 3, name = 'Squat') => ({ id, sets, name, reps: 5 })
const session = (id, weekday, exercises = [exercise(id)]) => ({ id, weekday, title: `Pas ${id}`, exercises })
const week = (id, number, start, sessions) => ({ id, week_number: number, start_date: start, sessions })
const current = week('w1', 1, '2026-10-19', [session('fredag', 4)])
const following = week('w2', 2, '2026-10-26', [session('mandag', 0)])
const input = (overrides = {}) => ({ enabled: true, allWeeks: [current, following], currentWeek: current, exerciseLogs: [], now: new Date('2026-10-25T12:00:00Z'), ...overrides })
const model = overrides => nextTrainingHome(input(overrides))

test('default OFF and nonboolean values return before touching program data', () => {
  assert.equal(DEFAULT_NEXT_TRAINING_HOME, false)
  for (const enabled of [undefined, false, 'true', 1, null]) {
    assert.equal(nextTrainingHome({ enabled, allWeeks: new Proxy([], { get() { throw Error('Read while OFF') } }) }), null)
  }
})

test('Sunday, week end and autumn DST select the actual next Monday across weeks', () => {
  for (const instant of ['2026-10-25T00:30:00Z', '2026-10-25T01:30:00Z', '2026-10-25T22:59:59Z']) {
    const result = model({ now: new Date(instant) })
    assert.equal(result.date, '2026-10-26')
    assert.equal(result.day, 'Mandag')
    assert.equal(result.title, 'Pas mandag')
    assert.deepEqual(result.exercises, [{ name: 'Squat', sets: 3 }])
  }
  assert.equal(model({ now: new Date('2026-10-25T23:00:00Z') }), null, 'Monday in Copenhagen already has training')
})

test('spring DST and month end use calendar days, with no 24 hour drift', () => {
  const spring = week('a', 1, '2026-03-23', [])
  const next = week('b', 2, '2026-03-30', [session('spring', 0)])
  for (const now of ['2026-03-29T00:30:00Z', '2026-03-29T01:30:00Z', '2026-03-29T21:59:59Z']) {
    assert.equal(model({ allWeeks: [spring, next], currentWeek: spring, now: new Date(now) }).date, '2026-03-30')
  }
  const dec = week('dec', 1, '2026-12-28', [])
  const jan = week('jan', 2, '2027-01-04', [session('new-year', 0)])
  assert.equal(model({ allWeeks: [dec, jan], currentWeek: dec, now: new Date('2027-01-03T12:00Z') }).date, '2027-01-04')
})

test('rest day uses upcoming weekday rather than the first unfinished session', () => {
  const w = week('w', 1, '2026-10-19', [session('old', 0), session('next', 4), session('later', 6)])
  assert.equal(model({ allWeeks: [w], currentWeek: w, now: new Date('2026-10-22T12:00Z') }).title, 'Pas next')
})

test('date order wins over array order; finished or skipped sessions and empty sessions are excluded', () => {
  const later = week('w3', 3, '2026-11-02', [session('later', 0)])
  const next = week('w2', 2, '2026-10-26', [session('empty', 0, []), session('done', 0), session('pick', 2)])
  const logs = [1, 2, 3].map(set_number => ({ exercise_id: 'done', set_number, skipped: true }))
  assert.equal(model({ allWeeks: [later, next, current], exerciseLogs: logs }).date, '2026-10-28')
})

test('dated anchor fills gaps, undated plan follows current week, no artificial week repetition', () => {
  const undated = { ...following, start_date: null }
  assert.equal(model({ allWeeks: [current, undated] }).date, '2026-10-26')
  assert.equal(model({ allWeeks: [{ ...current, start_date: null }, undated], currentWeek: { ...current, start_date: null } }).date, '2026-10-26')
  assert.equal(model({ allWeeks: [current] }).kind, 'no-next')
})

test('no program, missing selection, bad dates and zero set plans are explicit and safe', () => {
  assert.equal(model({ allWeeks: [], currentWeek: null }).kind, 'no-program')
  assert.equal(model({ currentWeek: null }), null)
  assert.equal(model({ now: new Date('invalid') }), null)
  const bad = { ...following, start_date: '2026-02-30' }
  assert.equal(model({ allWeeks: [current, bad] }).kind, 'no-next')
  const empty = { ...following, sessions: [session('zero', 0, [exercise('zero', 0)])] }
  assert.equal(model({ allWeeks: [current, empty] }).kind, 'no-next')
})

test('training today and current flexible unfinished sessions preserve existing training UI', () => {
  for (const weekday of [6, null]) {
    const w = { ...current, sessions: [session('today', weekday)] }
    assert.equal(model({ allWeeks: [w, following], currentWeek: w }), null)
  }
  const doneToday = { ...current, sessions: [session('today', 6)] }
  assert.equal(model({ allWeeks: [doneToday], currentWeek: doneToday, exerciseLogs: [1, 2, 3].map(set_number => ({ exercise_id: 'today', set_number })) }), null)
})

test('future flexible training shows week and explicit unknown day', () => {
  const flex = { ...following, sessions: [session('flex', null)] }
  const result = model({ allWeeks: [current, flex] })
  assert.equal(result.date, null)
  const dom = renderNextTrainingHome(createElement, result, () => {})
  assert.match(text(dom), /Dag ikke fastlagt · Uge 2/)
})

test('adjacent top and backoff rows show total sets and preserve exercise order without mutation', () => {
  const next = { ...following, sessions: [session('rows', 0, [exercise('top', 1, 'Squat (top)'), exercise('back', 3, 'Squat (backoff)'), exercise('bench', 4, 'Bench press')])] }
  const args = input({ allWeeks: [current, next] })
  const before = JSON.stringify(args)
  assert.deepEqual(nextTrainingHome(args).exercises, [{ name: 'Squat', sets: 4 }, { name: 'Bænkpres', sets: 4 }])
  assert.equal(JSON.stringify(args), before)
})

const props = (overrides = {}) => ({
  allWeeks: [current, following], currentWeek: current, exerciseLogs: [], now: new Date('2026-10-25T12:00Z'),
  tab: 'hjem', onHoliday: false, mereOpen: false, role: 'athlete', athlete: { id: 'synthetic' },
  days: ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag'], months: Array(12).fill('måned'),
  readinessHistory: [], messages: [], sharedVideoAnalyses: [], prs: [], weeklyTonnage: [], liftProgress: [],
  weightLogs: [], exerciseHistory: {}, logInputs: {}, unreadMsgCount: 0,
  setTab: () => {}, openSession: () => {}, ...overrides,
})

for (const Component of [HjemTab, EnkelHjemTab]) {
  const label = Component === HjemTab ? 'Hjem' : 'EnkelHjem'
  test(`${label}: actual component puts next training first and Program handler only navigates`, () => {
    const calls = []
    const dom = Component(props({ naesteTraening: true, setTab: tab => calls.push(tab), openSession: () => assert.fail('must not open another week with stale selection'), logDagensPasSet: () => assert.fail('must not log'), sendUgeLinje: () => assert.fail('must not send') }))
    assert.equal(nodes(dom, n => n.type != null)[0].props['aria-label'], 'Næste træning')
    assert.match(text(dom), /Mandag · 26\.10\.2026Pas mandagSquat · 3 sæt/)
    assert.equal(nodes(dom, n => n.type === 'DagensPasCard').length, 0)
    assert.deepEqual(calls, [])
    nodes(dom, n => n.type === 'button' && text(n) === 'Se Program')[0].props.onClick()
    assert.deepEqual(calls, ['program'])
  })
  test(`${label}: omitted, false and truthy nonboolean flag produce identical legacy trees`, () => {
    const shape = value => JSON.stringify(Component(props(value)))
    const original = shape({})
    for (const naesteTraening of [false, 'true', 1, null]) assert.equal(shape({ naesteTraening }), original)
    assert.equal(nodes(Component(props()), n => n.type === 'DagensPasCard').length, 1)
    assert.equal(nodes(Component(props()), n => 'data-next-training-home' in n.props).length, 0)
  })
  test(`${label}: no program and exhausted plan do not fabricate a date or session`, () => {
    for (const extra of [{ allWeeks: [], currentWeek: null }, { allWeeks: [current] }]) {
      const dom = Component(props({ naesteTraening: true, ...extra }))
      assert.match(text(dom), extra.currentWeek === null ? /Intet program endnu/ : /Intet kommende pas planlagt/)
      assert.doesNotMatch(text(dom), /undefined|NaN/)
    }
  })
  test(`${label}: holiday, other tab and training today retain their original behavior`, () => {
    const todayWeek = { ...current, sessions: [session('today', 6)] }
    for (const extra of [{ onHoliday: true }, { tab: 'program' }, { allWeeks: [todayWeek], currentWeek: todayWeek }]) {
      assert.equal(JSON.stringify(Component(props({ naesteTraening: true, ...extra }))), JSON.stringify(Component(props(extra))))
    }
  })
}

test('EnkelHjem: week and readiness subroutes do not show a training preview', () => {
  for (const enkelDel of ['uge', 'dagsform']) {
    const dom = EnkelHjemTab(props({ naesteTraening: true, enkelDel, readinessInput: { soreZones: [] }, readinessCardRef: null }))
    assert.equal(nodes(dom, n => 'data-next-training-home' in n.props).length, 0)
  }
})

test.after(() => hooks.deregister())
