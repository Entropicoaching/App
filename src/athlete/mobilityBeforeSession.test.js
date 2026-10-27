import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { install, moduleURL } from './mob3Loader.mjs'
import { mount, text, nodes, button } from './mob3Dom.mjs'
install()
const { default: Before, sessionMobilityPlan, DEFAULT_MOBILITY_BEFORE_SESSION } = await import('./mobilityBeforeSession.mjs')
const { findDagensPas } = await import(moduleURL('nextSet.js').href)
const { WARMUP_BASE } = await import('./mobilityCatalog.mjs')
const { mobilityLibrary } = await import('./mobilityLibrary.mjs')

const ex = (name, id = 'e1', sets = 3) => ({ id, name, sets, reps: '5', recommended_weight: 60 })
function fixture(exercises = [ex('Squat')], logs = []) {
  const session = { id: 's1', title: 'Dag 1', exercises }
  const week = { id: 'w1', week_number: 1, sessions: [session] }
  return { session, week, logs, pas: findDagensPas([week], week, logs) }
}
const props = f => ({ enabled: true, pas: f.pas, exerciseLogs: f.logs, athleteId: 'a1', todayStr: '2026-10-27' })
test('strict explicit flag and empty or unsupported sessions do not render', () => {
  assert.equal(DEFAULT_MOBILITY_BEFORE_SESSION, false)
  for (const enabled of [undefined, false, 0, 1, 'true', null]) {
    assert.equal(mount(Before, { ...props(fixture()), enabled }).render(), null)
  }
  for (const exercises of [[], [ex('Rows')], [ex('Front squat')], [ex('DB bench press')], [ex('Romanian deadlift')], [ex('OHP')], [ex('Squat', 'e1', 0)]]) {
    assert.equal(mount(Before, props(fixture(exercises))).render(), null)
  }
  for (const pas of [null, { status: 'empty' }, { status: 'done' }, { status: 'open', session: {} }]) assert.deepEqual(sessionMobilityPlan(pas), [])
  assert.equal(mount(Before, { ...props(fixture()), athleteId: null }).render(), null)
})
test('the first supported main lift selects only existing MOB2 exercises and labels', () => {
  const cases = [
    ['Squat - topsæt', ['sq-mob-2', 'sq-mob-3']],
    ['Baenkpres (comp)', ['bp-mob-2']], ['Bench press', ['bp-mob-2']],
    ['Doedloeft back-off', ['dk-mob-3']], ['Sumo dødløft', ['ds-mob-1']],
    ['Deadlift sumo', ['ds-mob-1']],
  ]
  for (const [name, ids] of cases) {
    const f = fixture([ex('Rows', 'rows'), ex(name), ex('Squat', 'later')])
    const before = JSON.stringify(f)
    const plan = sessionMobilityPlan(f.pas, [])
    assert.deepEqual(plan.map(item => item.id), ids)
    const groups = mobilityLibrary(plan[0].lift, WARMUP_BASE).flatMap(g => g.exercises)
    for (const exercise of plan) assert.ok(groups.some(e => e.id === exercise.id && e.name === exercise.name && e.label === exercise.label))
    assert.equal(JSON.stringify(f), before)
    assert.deepEqual(plan, sessionMobilityPlan(f.pas, []))
  }
})
test('completed, skipped and pending session log rows suppress the pre-first-set routine', () => {
  for (const extra of [{}, { skipped: true }, { pending: true }]) {
    const f = fixture([ex('Squat')], [{ exercise_id: 'e1', set_number: 1, ...extra }])
    assert.deepEqual(sessionMobilityPlan(f.pas, f.logs), [])
  }
  const f = fixture([ex('Rows', 'rows'), ex('Squat')], [{ exercise_id: 'rows', set_number: 1 }])
  assert.deepEqual(sessionMobilityPlan(f.pas, f.logs), [])
  assert.equal(sessionMobilityPlan(f.pas, [{ exercise_id: 'other-session', set_number: 1 }]).length, 2)
  assert.deepEqual(sessionMobilityPlan(f.pas, null), [])
})
test('actual skip and finish handlers close once; keyed scope follows athlete, session and date', () => {
  const p = props(fixture()), app = mount(Before, p)
  let tree = app.render()
  assert.match(text(tree), /1 af 2/)
  assert.equal(nodes(tree, n => n.type === 'svg' && n.props.role === 'img').length, 1)
  for (const n of nodes(tree, n => n.type === 'button')) { assert.equal(n.props.type, 'button'); assert.ok(n.props.style.minHeight >= 44) }
  button(tree, 'Spring mobilitet over').props.onClick()
  assert.equal(app.render(), null)
  assert.equal(app.render({ ...p, pas: { ...p.pas } }), null)
  for (const next of [{ ...p, athleteId: 'a2' }, { ...p, todayStr: '2026-10-28' },
    { ...p, pas: { ...p.pas, session: { ...p.pas.session, id: 's2' } } }]) {
    tree = app.render(next)
    assert.match(text(tree), /1 af 2/)
    button(tree, 'Næste mobilitetsøvelse').props.onClick()
    tree = app.render(); assert.match(text(tree), /2 af 2/)
    button(tree, 'Færdig med mobilitet').props.onClick()
    assert.equal(app.render(), null)
  }
})

for (const homeName of ['HjemTab.jsx', 'EnkelHjemTab.jsx']) {
  const { default: Home } = await import('./' + homeName)
  function homeProps(enabled, logs = []) {
    const f = fixture([ex('Squat')], logs)
    const writes = []
    return { allWeeks: [f.week], currentWeek: f.week, athlete: { id: 'a1' }, exerciseLogs: logs,
      mobilitetFoerPas: enabled, tab: 'hjem', now: new Date('2026-10-27T12:00:00Z'),
      days: ['søndag', 'mandag', 'tirsdag'], months: Array(12).fill('oktober'),
      readinessHistory: [], readinessLog: null, role: 'athlete', messages: [], sharedVideoAnalyses: [],
      logInputs: { e1_1: { weight: '60', reps: '5' } }, exerciseHistory: {},
      suggestNextWeight: () => null, setLogInputs: () => {}, pendingSyncKeys: [],
      logDagensPasSet: (...args) => writes.push(['log', ...args]), skipSet: (...args) => writes.push(['skip', ...args]), writes }
  }
  test(homeName + ': actual home and training card handlers stay available before and after skip', () => {
    const p = homeProps(true), app = mount(Home, p)
    let tree = app.render()
    assert.match(text(tree), /Kort mobilitet/)
    button(tree, 'Spring mobilitet over').props.onClick()
    assert.deepEqual(p.writes, [])
    tree = app.render()
    assert.doesNotMatch(text(tree), /Kort mobilitet/)
    button(tree, 'Godkendt').props.onClick()
    assert.equal(p.writes.length, 1)
    assert.equal(p.writes[0][0], 'log')
    assert.equal(p.writes[0][1].id, 'e1')
    assert.equal(p.writes[0][2], 1)
    const independent = mount(Home, homeProps(true)).render()
    button(independent, 'Godkendt').props.onClick() // Training is available even while routine is visible.
    const skipped = homeProps(true)
    button(mount(Home, skipped).render(), 'Spring over').props.onClick()
    assert.deepEqual(skipped.writes, [['skip', 'e1', 1, null]])
    const off = homeProps(false)
    const offTree = mount(Home, off).render()
    assert.doesNotMatch(text(offTree), /Kort mobilitet/)
    button(offTree, 'Godkendt').props.onClick()
    assert.deepEqual(p.writes, off.writes)
    assert.equal(text(offTree), text(mount(Home, homeProps(undefined)).render()))
    const started = mount(Home, homeProps(true, [{ exercise_id: 'e1', set_number: 1, skipped: true }])).render()
    assert.doesNotMatch(text(started), /Kort mobilitet/)
  })
}

test('catalog preserves the pinned table and both top-level flag routes remain explicit', () => {
  const catalog = readFileSync(moduleURL('mobilityCatalog.mjs'), 'utf8').replace(/\r\n/g, '\n')
  assert.equal(createHash('sha256').update(catalog).digest('hex'), 'e13f626a5220737ec18975c77be231fb0785720e0514e45c8652ec004b025b29')
  const app = readFileSync(moduleURL('App.jsx'), 'utf8')
  assert.match(app, /mobilitetFoerPas = false/)
  assert.equal(app.match(/mobilitetFoerPas: mobilitetFoerPas === true,/g).length, 2)
  assert.match(readFileSync(moduleURL('AthleteView.jsx'), 'utf8'), /mobilitetFoerPas=\{mobilitetFoerPas === true\}/)
})
