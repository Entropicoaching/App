import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './mob3Loader.mjs'
import { mount, button, text, nodes } from './mob3Dom.mjs'
install()
const { default: Before, sessionMobilityPlan } = await import('./mobilityBeforeSession.mjs')
const { default: Hub } = await import('./MobiliseringTab.jsx')
const { WARMUP_BASE } = await import('./mobilityCatalog.mjs')
const { focusPlan } = await import('./mobilityFocus.mjs')
const { default: Library } = await import('./MobilitetsBibliotek.jsx')
const make = (name = 'Squat', id = 's1') => {
  const exercise = { id: 'lift-' + id, name, sets: 2, reps: '5' }
  return { enabled: true, athleteId: 'a1', todayStr: '2026-10-27', exerciseLogs: [],
    pas: { status: 'open', session: { id, exercises: [exercise] }, next: { exercise, setNumber: 1 } } }
}

test('counterexample: dismiss and then switch to a different bench session', () => {
  const app = mount(Before, make())
  button(app.render(), 'Spring mobilitet over').props.onClick()
  const tree = app.render(make('Bænkpres', 's2'))
  assert.match(text(tree), /Bryststræk mod væg/)
  assert.doesNotMatch(text(tree), /Ankel-vægstræk/)
  button(tree, 'Færdig med mobilitet').props.onClick()
  assert.equal(app.render(), null)
})
test('counterexample: newly arrived session logs hide a visible routine immediately', () => {
  const p = make(), app = mount(Before, p)
  assert.ok(app.render())
  assert.equal(app.render({ ...p, exerciseLogs: [{ exercise_id: p.pas.next.exercise.id, set_number: 2, skipped: true }] }), null)
})
test('counterexample: first unsupported exercise cannot hide the later main lift', () => {
  const p = make('Sumo deadlift')
  p.pas.session.exercises.unshift({ id: 'r', name: 'Romanian deadlift', sets: 3 })
  assert.deepEqual(sessionMobilityPlan(p.pas, []).map(ex => ex.id), ['ds-mob-1'])
  p.pas.session.exercises.unshift({ id: 'b', name: 'Bench press', sets: 3 })
  assert.deepEqual(sessionMobilityPlan(p.pas, []).map(ex => ex.id), ['bp-mob-2'])
})
test('counterexample: flag off while routine is open removes the entire section', () => {
  const p = make(), app = mount(Before, p)
  assert.ok(app.render())
  assert.equal(app.render({ ...p, enabled: false }), null)
  assert.equal(nodes(app.render({ ...p, enabled: 'true' }), n => n.type === 'button').length, 0)
})
test('counterexample: changing the planned main lift cannot retain an old step number', () => {
  const app = mount(Before, make())
  button(app.render(), 'Næste mobilitetsøvelse').props.onClick()
  assert.match(text(app.render()), /2 af 2/)
  const tree = app.render(make('Bænkpres'))
  assert.match(text(tree), /1 af 1/)
  assert.doesNotMatch(text(tree), /2 af 1/)
})
test('regression: extracted catalog is the actual MOB1 hub catalog and all six focus needs survive', () => {
  assert.equal(Hub({ mobilitetFokus: true, mobilityMode: 'fokus' }).props.library, WARMUP_BASE)
  for (const [lift, needs] of Object.entries({ Squat: ['Mere dybde', 'Plads til knæene'], Bænkpres: ['Skulderposition', 'Bevægelig brystryg'], Dødløft: ['Hofteposition', 'Plads i sumostilling'] })) {
    for (const need of needs) assert.equal(focusPlan(lift, need, WARMUP_BASE).exercises.length, 3)
  }
  const app = mount(Library, { library: WARMUP_BASE, onExit: () => {} })
  let tree = app.render()
  button(tree, 'Dødløft').props.onClick(); tree = app.render()
  assert.match(text(tree), /Hofteposition i sumo/)
  assert.equal(nodes(tree, n => n.type === 'svg').length, 2)
})
test('regression: old mobility hub initialization is unchanged when focus is off', () => {
  const calls = [], p = { currentWeek: { sessions: [] }, mobilityMode: null }
  for (const key of ['setMobilityMode', 'setMobilityIntake', 'setMobilitySlots', 'setMobilityStep', 'setMobilityPhase']) p[key] = value => calls.push([key, value])
  const tree = mount(Hub, p).render()
  const door = nodes(tree, n => n.type === 'button' && text(n).includes('Byg en session'))[0]
  door.props.onClick()
  assert.equal(calls[0][0], 'setMobilityIntake')
  assert.deepEqual(calls.at(-1), ['setMobilityMode', 'mobilitet'])
  assert.equal(calls.find(([key]) => key === 'setMobilitySlots')[1].length, 6)
})
