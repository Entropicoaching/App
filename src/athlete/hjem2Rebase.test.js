import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './hjem2Loader.mjs'
import { nodes, text } from './hjem2Dom.mjs'
const hooks = install()
const { nextTrainingHome } = await import('./nextTrainingHome.mjs')
const homes = [(await import('./HjemTab.jsx')).default, (await import('./EnkelHjemTab.jsx')).default]
const session = (id, weekday, order = 0) => ({ id, weekday, session_order: order, title: id, exercises: [{ id, name: 'Squat', sets: 2 }] })
const current = { id: 'current', week_number: 4, start_date: '2026-10-19', sessions: [] }
const future = { id: 'future', week_number: 5, start_date: '2026-10-26', sessions: [session('late', 0, 9), session('early', 0, 1)] }
const data = extra => ({ enabled: true, allWeeks: [current, future], currentWeek: current, exerciseLogs: [], now: new Date('2026-10-25T12:00Z'), ...extra })
const props = extra => ({ ...data(), naesteTraening: true, tab: 'hjem', onHoliday: false, mereOpen: false, role: 'athlete', athlete: { id: 'synthetic' }, days: Array(7).fill('dag'), months: Array(12).fill('maaned'), readinessHistory: [], messages: [], sharedVideoAnalyses: [], prs: [], weeklyTonnage: [], liftProgress: [], weightLogs: [], exerciseHistory: {}, logInputs: {}, ...extra })

test('own counterexample: session order breaks ties independently of input order', () => {
  assert.equal(nextTrainingHome(data()).title, 'early')
  assert.equal(nextTrainingHome(data({ allWeeks: [future, current] })).title, 'early')
})
test('own counterexample: completed first session yields the next unfinished session', () => {
  assert.equal(nextTrainingHome(data({ exerciseLogs: [1, 2].map(set_number => ({ exercise_id: 'early', set_number })) })).title, 'late')
})
test('own counterexample: Copenhagen midnight changes Sunday preview to Monday training', () => {
  assert.equal(nextTrainingHome(data({ now: new Date('2026-10-25T22:59:59Z') })).date, '2026-10-26')
  assert.equal(nextTrainingHome(data({ now: new Date('2026-10-25T23:00:00Z') })), null)
})
for (const [index, Home] of homes.entries()) {
  test(`own DOM ${index}: one heading, first card and navigation only`, () => {
    const calls = []
    const dom = Home(props({ setTab: value => calls.push(value), openSession: () => assert.fail('unexpected training action') }))
    assert.equal(nodes(dom, n => n.type === 'h1').length, 1)
    assert.equal(nodes(dom, n => n.type != null)[0].props['aria-label'], 'Næste træning')
    assert.deepEqual(calls, [])
    const button = nodes(dom, n => n.type === 'button' && text(n) === 'Se Program')[0]
    button.props.onClick()
    assert.deepEqual(calls, ['program'])
  })
  test(`own DOM ${index}: no program is explicit and OFF matches omitted flag`, () => {
    const noPlan = { allWeeks: [], currentWeek: null }
    assert.match(text(Home(props(noPlan))), /Intet program endnu/)
    assert.equal(nodes(Home(props(noPlan)), n => n.type === 'h1').length, 1)
    assert.equal(JSON.stringify(Home(props({ ...noPlan, naesteTraening: false }))), JSON.stringify(Home(props({ ...noPlan, naesteTraening: undefined }))))
  })
}
test.after(() => hooks.deregister())
