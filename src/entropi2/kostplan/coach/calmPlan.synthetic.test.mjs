// Actual portal imports and handlers; synthetic hooks and memory storage only.
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { mount, nodes, text, memoryStorage } from './portal.fixture.mjs'
import { draftKey } from './portalModel.mjs'
import { FOODS } from '../foedevarer/index.mjs'

const root = new URL('../../../', import.meta.url).href
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'react' && context.parentURL?.startsWith(root))
    return { url: new URL('./portal.fixture.mjs', import.meta.url).href, shortCircuit: true }
  return next(specifier, context)
} })
const { default: PortalPlan } = await import('./PortalPlan.mjs')
hooks.deregister()

const props = { enabled: true, athlete: { id: 'synthetic-a', age: 30, bodyweight: 80, goal: 'maintain', protein_target: 150 },
  today: '2026-11-05', session: { user: { id: 'synthetic-coach' } } }
const summary = node => text(node.props.children.find(child => child?.type === 'summary'))
const fold = (tree, name) => nodes(tree).find(node => node.type === 'details' && summary(node) === name)
const visible = node => !node || typeof node !== 'object' ? text(node)
  : (node.type === 'details' && !node.props.open
    ? node.props.children.filter(child => child?.type === 'summary') : node.props.children).map(visible).join(' ')
// Simulate only the browser's native open state for the host; nested method folds stay closed.
const shown = tree => visible({ ...tree, props: { ...tree.props, children: tree.props.children.map(node =>
  node?.type === 'details' && summary(node) === 'Kostplan' ? { ...node, props: { ...node.props, open: true } } : node) } })
const button = (tree, name) => nodes(tree).find(node => node.type === 'button' && text(node) === name)
const change = (tree, name, value) => nodes(tree).find(node => node.props.name === name).props.onChange({ currentTarget: { value } })
function open(screen) {
  fold(screen.render(), 'Kostplan').props.onToggle({ currentTarget: { open: true } })
  return screen.render()
}
function generate(tree, gram = true) {
  const action = button(tree, gram ? 'Generér forslag' : 'Brug måltider og generér dagsplan')
  nodes(tree).find(node => node.type === 'form' && nodes(node).includes(action)).props.onSubmit({ preventDefault() {} })
}
async function withStorage(run) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage'), storage = memoryStorage()
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
  try { await run(storage) } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor)
    else delete globalThis.localStorage
  }
}

test('new gram plan keeps short actions visible and discloses all assumptions before generation', () => withStorage(async storage => {
  const screen = mount(PortalPlan, props), tree = open(screen), method = fold(tree, 'Om forslaget')
  assert.ok(method); assert.equal(method.props.open, undefined)
  assert.match(shown(tree), /Lokal kladde · ikke delt med atleten/)
  assert.match(shown(tree), /Vælg dagens mål/)
  assert.match(shown(tree), /Vælg fødevarer og portionsgrænser, eller lad måltider stå tomme for forslag/)
  assert.doesNotMatch(shown(tree), /hviledag som standard|5–300 g|Træningstid, allergier|Tolerance er/)
  for (const expected of ['hviledag som standard', '5–300 g', 'trin på 5 g', 'rå/kogt', 'ikke alle fødevarekilder er verificeret',
    '5 %', 'Træningstid, allergier og præferencer er ikke koblet ind', 'roterer efter dagens valg'])
    assert.ok(text(method).includes(expected), expected)
  assert.ok(button(tree, 'Generér forslag')); assert.equal(storage.data.size, 0)
  assert.equal(nodes(tree).some(node => node.props.name === 'grams-0-0'), false)
  screen.unmount()
}))

test('generated and restored plans keep review, draft status, errors and explicit scoped saving visible', () => withStorage(async storage => {
  const screen = mount(PortalPlan, props); generate(open(screen))
  let tree = screen.render()
  assert.match(shown(tree), /Gennemgå fødevarer og portioner før gemning/)
  assert.match(shown(tree), /Dagens plan og mål/)
  assert.doesNotMatch(shown(tree), /Forslaget fordeler gram|En ny generering bevarer|Varerne roterer/)
  assert.equal(nodes(tree).filter(node => node.type === 'details' && summary(node) === 'Om forslaget').length, 1)
  assert.match(text(fold(tree, 'Om forslaget')), /Dagens tolerance/)
  assert.equal(storage.calls.filter(call => call[0] === 'set').length, 0)
  const foods = nodes(tree).filter(node => /^food-\d+-\d+$/.test(node.props.name ?? '')).map(node => node.props.value)
  assert.ok(new Set(foods).size > 3)
  await button(tree, 'Gem som kladde').props.onClick()
  assert.deepEqual([...storage.data.keys()], [draftKey(props.session.user.id, props.athlete.id, props.today)])
  assert.equal(JSON.parse([...storage.data.values()][0]).plan.status, 'draft')
  const restored = mount(PortalPlan, props); tree = open(restored)
  assert.match(shown(tree), /Lokal kladde indlæst/)
  assert.match(shown(tree), /Gennemgå fødevarer og portioner/)
  change(tree, 'grams-0-0', '125'); tree = restored.render()
  storage.setItem = () => { throw Error('synthetic quota') }
  await button(tree, 'Gem som kladde').props.onClick(); tree = restored.render()
  assert.match(shown(tree), /Kladden blev ikke bekræftet gemt/)
  assert.equal(nodes(tree).find(node => node.props.name === 'grams-0-0').props.value, '125')
  assert.doesNotMatch(shown(tree), /Planen er aktiveret/)
  screen.unmount(); restored.unmount()
}))

test('manual plan retains gram entry, preparation guidance and the same save controls', () => withStorage(async storage => {
  const screen = mount(PortalPlan, { ...props, athlete: { id: props.athlete.id, protein_target: 150 } })
  let tree = open(screen)
  assert.match(shown(tree), /Vælg fødevarer og angiv gram i hvert måltid/)
  assert.match(text(fold(tree, 'Om forslaget')), /rå\/kogt|skaleres efter energi/)
  change(tree, 'maintenanceKcal', '2400'); change(tree, 'fat', '70')
  for (let mi = 0; mi < 3; mi++) {
    change(tree, `template-food-${mi}-0`, FOODS[0].id); change(tree, `template-grams-${mi}-0`, '100')
  }
  generate(screen.render(), false); tree = screen.render()
  assert.ok(button(tree, 'Gem som kladde')); assert.equal(button(tree, 'Markér lokal kladde som klar'), undefined)
  assert.match(shown(tree), /Gennemgå fødevarer og portioner før gemning/)
  assert.equal(storage.calls.filter(call => call[0] === 'set').length, 0)
  screen.unmount()
}))
