// Own counterexamples against the exact final modules, run in a fresh process.
import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './mobilityTestLoader.mjs'
import { mount, nodes, text, button, createElement } from './mobilityDom.mjs'
import { mobilityLibrary, exercisePicture } from './mobilityLibrary.mjs'
install()
const { default: Tab } = await import('./MobiliseringTab.jsx')
const { default: Library } = await import('./MobilitetsBibliotek.jsx')
const library = Tab({ mobilitetFokus: true, mobilityMode: 'fokus' }).props.library

test('counterexample: prototype names and cross-lift input cannot create cards', () => {
  for (const lift of ['constructor', '__proto__', 'toString', '', null]) assert.deepEqual(mobilityLibrary(lift, library), [])
  assert.deepEqual(mobilityLibrary('Squat', { Bænkpres: library.Bænkpres }), [])
  assert.deepEqual(mobilityLibrary('Squat', { Squat: [{ options: [{ id: 'new-exercise', name: 'Unpinned' }] }] }), [])
})

test('counterexample: hostile catalog names stay literal text and accessible SVG labels', () => {
  const name = '<script>alert(1)</script>'
  const fake = { Squat: [{ options: [{ id: 'sq-mob-2', name, label: '<img src=x>' }] }] }
  const tree = mount(Library, { library: fake }).render()
  assert.ok(text(tree).includes(name))
  assert.equal(nodes(tree, n => ['script', 'img'].includes(n.type)).length, 0)
  assert.equal(nodes(tree, n => n.type === 'svg')[0].props['aria-label'], `Skematisk billede: ${name}`)
})

test('counterexample: frozen input, duplicate ids and absent variants stay bounded', () => {
  const entry = Object.freeze({ id: 'sq-mob-2', name: 'Existing', label: '10 reps' })
  const fake = Object.freeze({ Squat: Object.freeze([Object.freeze({ options: Object.freeze([entry, entry, null]) })]) })
  assert.equal(mobilityLibrary('Squat', fake)[0].exercises.length, 1)
  const deadlift = mobilityLibrary('Dødløft', { 'Dødløft — Konventionel': library['Dødløft — Konventionel'] })
  assert.equal(deadlift.length, 1)
  assert.equal(deadlift[0].title, 'Hofteposition')
})

test('counterexample: each exercise has its own local pose and no external resource', () => {
  const signatures = []
  for (const lift of ['Squat', 'Bænkpres', 'Dødløft']) for (const ex of mobilityLibrary(lift, library).flatMap(g => g.exercises)) {
    const picture = exercisePicture(createElement, ex)
    signatures.push(nodes(picture, n => n.type === 'path').map(n => n.props.d).join('|'))
    for (const n of nodes(picture, () => true)) assert.ok(!n.props.href && !n.props.src && !n.props.xlinkHref)
  }
  assert.equal(signatures.length, 5)
  assert.equal(new Set(signatures).size, 5)
})

test('counterexample: navigation works when network and storage are unavailable', () => {
  const previous = Object.getOwnPropertyDescriptors(globalThis)
  const blocked = () => { throw new Error('Forbidden side effect') }
  try {
    globalThis.fetch = blocked
    for (const key of ['localStorage', 'sessionStorage']) Object.defineProperty(globalThis, key, { configurable: true, get: blocked })
    const app = mount(Library, { library, onExit() {} })
    let tree = app.render()
    for (const lift of ['Bænkpres', 'Dødløft', 'Squat']) { button(tree, lift).props.onClick(); tree = app.render() }
    button(tree, 'Tilbage til mit fokus').props.onClick()
  } finally {
    for (const key of ['fetch', 'localStorage', 'sessionStorage']) {
      if (previous[key]) Object.defineProperty(globalThis, key, previous[key])
      else delete globalThis[key]
    }
  }
})
