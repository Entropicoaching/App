// Separate adversarial checks, run in a fresh Node process against final files.
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { install } from './mobilityTestLoader.mjs'
import { mount, text, button, nodes, createElement } from './mobilityDom.mjs'
import { focusPlan, renderMobilityShortcut } from './mobilityFocus.mjs'
install()
const { default: Tab } = await import('./MobiliseringTab.jsx')
const { default: Focus } = await import('./MobilitetFokus.jsx')
const library = Tab({ mobilitetFokus: true, mobilityMode: 'fokus' }).props.library

test('countercheck: unknown lift/need and missing library never invent exercises', () => {
  for (const [lift, need] of [['constructor', 'Mere dybde'], ['Squat', '__proto__'], ['Squat', 'Hofteposition']]) assert.deepEqual(focusPlan(lift, need, library), { exercises: [], notes: [] })
  assert.deepEqual(focusPlan('Squat', 'Mere dybde', {}), { exercises: [], notes: [] })
  const tree = mount(Focus, { library: {}, onExit() {} }).render()
  assert.equal(button(tree, 'Start min rutine').props.disabled, true)
})

test('countercheck: coach priority, duplicates, null steps and foreign lift isolation', () => {
  const templates = Object.freeze([
    Object.freeze({ exercise_category: 'Squat', steps: Object.freeze(['sq-mob-3', '90/90 hofterotation', null, 7, '', '<script>not executed</script>']) }),
    Object.freeze({ exercise_category: 'Dødløft', steps: ['Katte-kamel'] }),
    Object.freeze({ exercise_category: 'Squat', steps: null }),
  ])
  const plan = focusPlan('Squat', 'Mere dybde', library, templates)
  assert.equal(plan.exercises[0].id, 'sq-mob-3')
  assert.equal(plan.exercises.length, 3)
  assert.ok(plan.exercises.every(ex => ex.id.startsWith('sq-')))
  assert.deepEqual(plan.notes, ['<script>not executed</script>'])
  const tree = mount(Focus, { library, warmupTemplates: templates, onExit() {} }).render()
  assert.equal(nodes(tree, n => n.type === 'script').length, 0)
  assert.ok(text(tree).includes('<script>not executed</script>'))
  assert.deepEqual(focusPlan('Squat', 'Mere dybde', library, null).notes, [])
})

test('countercheck: choice changes remove stale lift, coach and progress', () => {
  const app = mount(Focus, { library, warmupTemplates: [{ exercise_category: 'Squat', steps: ['Hofteløft'] }], onExit() {} })
  let tree = app.render()
  button(tree, 'Start min rutine').props.onClick(); tree = app.render()
  button(tree, 'Næste øvelse').props.onClick(); tree = app.render()
  button(tree, 'Ret mit fokus').props.onClick(); tree = app.render()
  button(tree, 'Bænkpres').props.onClick(); tree = app.render()
  assert.equal(text(tree).includes('Hofteløft'), false)
  assert.equal(text(tree).includes('Valgt af din coach'), false)
  button(tree, 'Start min rutine').props.onClick(); tree = app.render()
  assert.ok(text(tree).includes('1 af 3'))
  assert.ok(text(tree).includes('Bryststræk mod væg'))
})

test('countercheck: old hub, warmup door and all-home shortcut stay reachable', () => {
  let mode = 'fokus'
  const app = mount(Tab, { mobilitetFokus: true, mobilityMode: mode, setMobilityMode: v => { mode = v } })
  let tree = app.render()
  button(tree, 'Tilbage til mobilitet').props.onClick()
  assert.equal(mode, null)
  tree = app.render({ mobilitetFokus: true, mobilityMode: mode, setMobilityMode: v => { mode = v } })
  nodes(tree, n => n.type === 'button' && text(n).includes('Varm op'))[0].props.onClick()
  assert.equal(mode, 'opvarmning')
  assert.ok(renderMobilityShortcut(createElement, { enabled: true, tab: 'hjem', enkelOn: true, route: 'alle' }))
})

test('countercheck: exact integration passes opt-in to both athlete entry points', () => {
  const read = name => readFileSync(new URL(existsSync(new URL('./' + name, import.meta.url)) ? './' + name : '../' + name, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
  const app = read('App.jsx')
  const view = read('AthleteView.jsx')
  assert.match(app, /mobilitetFokus = false/)
  assert.equal(app.split('mobilitetFokus: mobilitetFokus === true').length - 1, 2)
  assert.match(view, /mobilitetFokus = false/)
  assert.match(view, /renderMobilityShortcut\(createElement, \{ enabled: mobilitetFokus, tab, enkelOn, route, setMobilityMode, setTab \}\)/)
  assert.match(view, /mobilitetFokus: mobilitetFokus === true, currentWeek, mobilityIntake/)
})
