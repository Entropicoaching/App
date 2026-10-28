import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './mobilityTestLoader.mjs'
import { mount, text, nodes, button, createElement } from './mobilityDom.mjs'
import { mobilityLibrary, MARC_TEXT, exercisePicture } from './mobilityLibrary.mjs'
install()
const { default: Tab } = await import('./MobiliseringTab.jsx')
const { default: Focus } = await import('./MobilitetFokus.jsx')
const { default: Library } = await import('./MobilitetsBibliotek.jsx')
const library = Tab({ mobilitetFokus: true, mobilityMode: 'fokus' }).props.library

test('five existing exercises grouped by main lift, immutable input and Marc placeholders', () => {
  const before = JSON.stringify(library)
  const expected = {
    Squat: [['Dybde', 'sq-mob-2'], ['Hofteposition', 'sq-mob-3']],
    Bænkpres: [['Skulderposition', 'bp-mob-2']],
    Dødløft: [['Hofteposition', 'dk-mob-3'], ['Hofteposition i sumo', 'ds-mob-1']],
  }
  for (const [lift, entries] of Object.entries(expected)) {
    const groups = mobilityLibrary(lift, library)
    assert.deepEqual(groups.map(g => [g.title, g.exercises[0].id]), entries)
    for (const ex of groups.flatMap(g => g.exercises)) {
      const original = Object.values(library).flatMap(slots => slots.flatMap(s => s.options)).find(e => e.id === ex.id)
      assert.equal(ex.name, original.name)
      assert.equal(ex.label, original.label)
      assert.equal(ex.explanation, MARC_TEXT)
      assert.equal(Object.hasOwn(ex, 'desc'), false)
    }
  }
  assert.equal(JSON.stringify(library), before)
})

test('actual library lift handlers replace cards and expose local accessible pictures', () => {
  let exits = 0
  const app = mount(Library, { library, onExit: () => exits++ })
  let tree = app.render()
  for (const lift of ['Squat', 'Bænkpres', 'Dødløft', 'Squat']) {
    button(tree, lift).props.onClick(); tree = app.render()
    const exercises = mobilityLibrary(lift, library).flatMap(g => g.exercises)
    const cards = nodes(tree, n => n.type === 'article')
    assert.equal(cards.length, exercises.length)
    assert.equal(button(tree, lift).props['aria-pressed'], true)
    assert.equal(nodes(tree, n => n.type === 'button' && n.props['aria-pressed'] === true).length, 1)
    for (let i = 0; i < cards.length; i++) {
      assert.ok(text(cards[i]).includes(exercises[i].name))
      assert.ok(text(cards[i]).includes(MARC_TEXT))
      const pictures = nodes(cards[i], n => n.type === 'svg')
      assert.equal(pictures.length, 1)
      assert.equal(pictures[0].props.role, 'img')
      assert.ok(pictures[0].props['aria-label'].includes(exercises[i].name))
      assert.ok(nodes(pictures[0], n => n.type === 'path' && n.props.d).length >= 2)
    }
    for (const node of nodes(tree, n => n.type === 'button')) {
      assert.equal(node.props.type, 'button')
      assert.ok(node.props.style.minHeight >= 48)
    }
    assert.equal(nodes(tree, n => ['img', 'image', 'script', 'iframe'].includes(n.type) || n.props.src || n.props.href || n.props.dangerouslySetInnerHTML).length, 0)
  }
  button(tree, 'Tilbage til mit fokus').props.onClick()
  assert.equal(exits, 1)
})

test('APP-MOB1 routine state and coach choices survive library roundtrip', () => {
  const app = mount(Focus, { library, warmupTemplates: [{ exercise_category: 'Bænkpres', steps: ['Udadrotation med elastik'] }] })
  let tree = app.render()
  button(tree, 'Bænkpres').props.onClick(); tree = app.render()
  button(tree, 'Start min rutine').props.onClick(); tree = app.render()
  button(tree, 'Næste øvelse').props.onClick(); tree = app.render()
  const previous = text(tree)
  button(tree, 'Se øvelsesbibliotek').props.onClick(); tree = app.render()
  assert.ok(text(tree).includes('Øvelsesbibliotek'))
  button(tree, 'Dødløft').props.onClick(); tree = app.render()
  button(tree, 'Tilbage til mit fokus').props.onClick(); tree = app.render()
  assert.equal(text(tree), previous)
})

test('default off and nonboolean flags preserve the old focus route and hub', () => {
  for (const enabled of [undefined, false, 0, 1, 'true', null]) {
    const app = mount(Tab, { mobilitetFokus: enabled, mobilityMode: 'fokus' })
    const tree = app.render()
    assert.equal(nodes(tree, n => n.type === 'button' && text(n) === 'Se øvelsesbibliotek').length, 0)
    assert.equal(nodes(tree, n => n.props['aria-label'] === 'Øvelsesbibliotek til hovedløft').length, 0)
  }
  const app = mount(Tab, { mobilitetFokus: true, mobilityMode: 'fokus' })
  let tree = app.render()
  button(tree, 'Se øvelsesbibliotek').props.onClick(); tree = app.render()
  assert.equal(nodes(tree, n => n.props['aria-label'] === 'Øvelsesbibliotek til hovedløft').length, 1)
})

test('missing catalog entries never invent exercises and empty view stays navigable', () => {
  for (const lift of ['Squat', 'Bænkpres', 'Dødløft']) {
    for (const input of [undefined, null, {}, { Squat: null }, { Squat: [{ options: null }] }]) assert.deepEqual(mobilityLibrary(lift, input), [])
  }
  const app = mount(Library, { library: {}, onExit() {} })
  const tree = app.render()
  assert.ok(text(tree).includes('Ingen øvelser'))
  assert.equal(nodes(tree, n => n.type === 'svg').length, 0)
  button(tree, 'Tilbage til mit fokus')
  assert.equal(exercisePicture(createElement, { id: 'unknown' }), null)
})
