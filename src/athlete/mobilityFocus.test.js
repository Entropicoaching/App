import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './mobilityTestLoader.mjs'
import { mount, text, nodes, button, createElement } from './mobilityDom.mjs'
import { DEFAULT_MOBILITY_FOCUS, FOCUS_LIFTS, FOCUS_NEEDS, focusPlan, renderMobilityShortcut } from './mobilityFocus.mjs'
install()
const { default: Tab } = await import('./MobiliseringTab.jsx')
const { default: Focus } = await import('./MobilitetFokus.jsx')
const library = Tab({ mobilitetFokus: true, mobilityMode: 'fokus' }).props.library

test('explicit flag, both home modes and actual shortcut handler', () => {
  assert.equal(DEFAULT_MOBILITY_FOCUS, false)
  for (const enabled of [undefined, false, 1, 'true']) assert.equal(renderMobilityShortcut(createElement, { enabled, tab: 'hjem' }), null)
  for (const enkelOn of [false, true]) {
    const calls = []
    const tree = renderMobilityShortcut(createElement, { enabled: true, tab: 'hjem', enkelOn, route: 'traening', setMobilityMode: value => calls.push(value), setTab: value => calls.push(value) })
    button(tree, 'Åbn mobilitet').props.onClick()
    assert.deepEqual(calls, ['fokus', 'mobilisering'])
  }
  for (const route of ['uge', 'mere', 'dagsform']) assert.equal(renderMobilityShortcut(createElement, { enabled: true, tab: 'hjem', enkelOn: true, route }), null)
  assert.equal(renderMobilityShortcut(createElement, { enabled: true, tab: 'program' }), null)
})

test('all needs select existing specific exercises, deterministic and immutable', () => {
  const before = JSON.stringify(library)
  const seen = []
  for (const lift of FOCUS_LIFTS) for (const need of FOCUS_NEEDS[lift]) {
    const plan = focusPlan(lift, need, library)
    assert.equal(plan.exercises.length, 3)
    assert.deepEqual(plan, focusPlan(lift, need, library))
    for (const ex of plan.exercises) assert.ok(Object.values(library).flatMap(slots => slots.flatMap(s => s.options)).some(item => item.id === ex.id && item.desc === ex.desc && item.label === ex.label))
    seen.push(plan.exercises.map(ex => ex.id).join(','))
  }
  assert.equal(new Set(seen).size, 6)
  assert.equal(JSON.stringify(library), before)
  assert.deepEqual(focusPlan('Squat', 'Skulderposition', library), { exercises: [], notes: [] })
})

test('existing coach choices lead the relevant plan, unmatched steps stay advice', () => {
  const templates = [{ exercise_category: 'Squat', steps: ['Hofteløft', 'Hofteløft', 'Coachens eksisterende råd'] }, { exercise_category: 'Bænkpres', steps: ['Bryststræk mod væg'] }]
  const before = JSON.stringify(templates)
  const plan = focusPlan('Squat', 'Mere dybde', library, templates)
  assert.equal(plan.exercises[0].name, 'Hofteløft')
  assert.equal(plan.exercises[0].source, 'Valgt af din coach')
  assert.equal(plan.exercises.length, 4)
  assert.deepEqual(plan.notes, ['Coachens eksisterende råd'])
  assert.equal(JSON.stringify(templates), before)
  assert.equal(plan.exercises.some(ex => ex.name === 'Bryststræk mod væg'), false)
})

test('real focus component handles lift, need, coach, guide, back, finish and restart', () => {
  let exits = 0
  const app = mount(Focus, { library, warmupTemplates: [{ exercise_category: 'Bænkpres', steps: ['Udadrotation med elastik'] }], onExit: () => exits++ })
  let tree = app.render()
  button(tree, 'Bænkpres').props.onClick(); tree = app.render()
  assert.ok(text(tree).includes('Skulderposition'))
  assert.ok(text(tree).includes('Valgt af din coach'))
  assert.equal(button(tree, 'Skulderposition').props['aria-pressed'], true)
  button(tree, 'Start min rutine').props.onClick(); tree = app.render()
  assert.ok(text(tree).includes('Udadrotation med elastik'))
  button(tree, 'Næste øvelse').props.onClick(); tree = app.render()
  button(tree, 'Forrige øvelse').props.onClick(); tree = app.render()
  assert.ok(text(tree).includes('1 af 3'))
  button(tree, 'Ret mit fokus').props.onClick(); tree = app.render()
  button(tree, 'Dødløft').props.onClick(); tree = app.render()
  button(tree, 'Plads i sumostilling').props.onClick(); tree = app.render()
  assert.ok(text(tree).includes('Frøstræk'))
  button(tree, 'Start min rutine').props.onClick(); tree = app.render()
  for (let i = 0; i < 2; i++) { button(tree, 'Næste øvelse').props.onClick(); tree = app.render() }
  button(tree, 'Afslut rutinen').props.onClick(); tree = app.render()
  assert.ok(text(tree).includes('gennemgået din rutine'))
  button(tree, 'Vælg nyt fokus').props.onClick(); tree = app.render()
  assert.equal(button(tree, 'Plads i sumostilling').props['aria-pressed'], true)
  for (const node of nodes(tree, n => n.type === 'button')) { assert.equal(node.props.type, 'button'); assert.ok(node.props.style.minHeight >= 44) }
  button(tree, 'Tilbage til mobilitet').props.onClick(); assert.equal(exits, 1)
})

test('real hub keeps old initialization with flag off, routes focus only with true', () => {
  for (const enabled of [undefined, false, 'true', true]) {
    const calls = []
    const props = { mobilitetFokus: enabled, mobilityMode: null, currentWeek: { sessions: [] }, setMobilityMode: v => calls.push(['mode', v]) }
    for (const key of ['setMobilityIntake', 'setMobilitySlots', 'setMobilityStep', 'setMobilityPhase']) props[key] = v => calls.push([key, v])
    const tree = mount(Tab, props).render()
    const door = nodes(tree, n => n.type === 'button' && text(n).includes('Byg en session'))[0]
    door.props.onClick()
    if (enabled === true) assert.deepEqual(calls, [['mode', 'fokus']])
    else { assert.equal(calls[0][0], 'setMobilityIntake'); assert.deepEqual(calls.at(-1), ['mode', 'mobilitet']); assert.equal(calls[1][1].length, 6) }
  }
})
