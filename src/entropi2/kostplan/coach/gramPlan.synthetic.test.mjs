// Actual portal imports with explicit synthetic hooks and memory storage.
// This does not stand in for the separate required real React gate.
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { mount, nodes, text, memoryStorage } from './portal.fixture.mjs'
import { draftKey } from './portalModel.mjs'

const root = new URL('../../../', import.meta.url).href
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'react' && context.parentURL?.startsWith(root))
    return { url: new URL('./portal.fixture.mjs', import.meta.url).href, shortCircuit: true }
  return next(specifier, context)
} })
const { default: PortalPlan } = await import('./PortalPlan.mjs')
hooks.deregister()
const props = { enabled: true, athlete: { id: 'synthetic-a', age: 30, bodyweight: 80, goal: 'maintain' },
  today: '2026-11-05', session: { user: { id: 'synthetic-coach' } } }
const named = (tree, name) => nodes(tree).find(n => n.props.name === name)
const change = (tree, name, value) => named(tree, name).props.onChange({ currentTarget: { value } })
const button = (tree, title) => nodes(tree).find(n => n.type === 'button' && text(n) === title)
const open = tree => nodes(tree).find(n => n.type === 'details').props.onToggle({ currentTarget: { open: true } })
const generate = tree => nodes(tree).find(n => n.type === 'form' && nodes(n).includes(button(tree, 'Generér forslag')))
  .props.onSubmit({ preventDefault() {} })
function fill(tree) {
  for (const [mi, name] of ['Ris kogt', 'Kyllingebryst', 'Olivenolie'].entries()) {
    change(tree, `template-food-${mi}-0`, 'local:' + encodeURIComponent(name))
    change(tree, `template-minGrams-${mi}-0`, '5'); change(tree, `template-maxGrams-${mi}-0`, '5')
  }
}
async function withStorage(run) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage'), storage = memoryStorage()
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
  try { await run(storage) } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor)
    else delete globalThis.localStorage
  }
}

test('actual portal selects explicit bounds, generates, shows deviation, edits and saves only a local draft', () => withStorage(async storage => {
  const screen = mount(PortalPlan, props)
  let tree = screen.render(); assert.equal(text(tree).trim(), 'Kostplan'); assert.equal(storage.calls.length, 0)
  open(tree); tree = screen.render()
  assert.ok(button(tree, 'Generér forslag')); assert.equal(named(tree, 'fat'), undefined)
  assert.equal(named(tree, 'template-minGrams-0-0').props.value, '')
  generate(tree); tree = screen.render()
  assert.equal(nodes(tree).filter(n => n.props.role === 'alert').length, 1)
  assert.match(text(tree), /kunne ikke genereres/); assert.equal(storage.data.size, 0)
  fill(tree); tree = screen.render(); generate(tree); tree = screen.render()
  assert.match(text(tree), /kan ikke nås|Afvigelse/)
  assert.match(text(tree), /Foreløbigt vægtbaseret estimat/)
  assert.equal(named(tree, 'grams-0-0').props.value, 5)
  assert.equal(nodes(tree).filter(n => n.type === 'table').length, 1)
  assert.equal(nodes(tree).filter(n => n.type === 'tr').length, 5)
  assert.equal(storage.data.size, 0)
  change(tree, 'grams-0-0', '123,5'); tree = screen.render()
  assert.match(text(tree), /rettede portioner/); assert.doesNotMatch(text(tree), /Målet kan ikke nås/)
  await button(tree, 'Gem som kladde').props.onClick(); tree = screen.render()
  assert.match(text(tree), /Lokal kladde gemt/)
  assert.deepEqual([...storage.data.keys()], [draftKey(props.session.user.id, props.athlete.id, props.today)])
  assert.equal(JSON.parse([...storage.data.values()][0]).plan.meals[0].items[0].grams, 123.5)
  assert.doesNotMatch(text(tree), /Aktivér for atleten|Planen er aktiveret/)
  for (const node of nodes(tree).filter(n => ['input', 'select', 'button', 'summary'].includes(n.type)))
    assert.ok(node.props.style.minHeight >= 44)
  assert.ok(nodes(tree).filter(n => n.type === 'details').every(n => !n.props.open))
  change(tree, 'maxGrams-0-0', '50'); tree = screen.render()
  assert.equal(button(tree, 'Gem som kladde').props.disabled, true)
  generate(tree); tree = screen.render()
  assert.ok(named(tree, 'grams-0-0').props.value <= 50)
  assert.equal(storage.calls.filter(call => call[0] === 'set').length, 1)
}))

test('same-scope profile changes immediately reset calculated UI; missing data never enables the connection', () => withStorage(async storage => {
  const screen = mount(PortalPlan, props); open(screen.render()); let tree = screen.render()
  fill(tree); generate(screen.render()); tree = screen.render()
  assert.ok(named(tree, 'grams-0-0'))
  for (const patch of [{ age: null }, { age: 17 }, { bodyweight: null }, { goal: null }]) {
    tree = screen.render({ athlete: { ...props.athlete, ...patch } })
    assert.equal(button(tree, 'Generér forslag'), undefined)
    assert.equal(named(tree, 'grams-0-0'), undefined)
    assert.doesNotMatch(text(tree), /Afvigelse|Foreløbigt vægtbaseret/)
  }
  tree = screen.render({ athlete: { ...props.athlete, bodyweight: 90 } })
  assert.ok(button(tree, 'Generér forslag')); assert.equal(named(tree, 'grams-0-0'), undefined)
  assert.equal(storage.data.size, 0)
  for (const changes of [{ today: '2026-11-06' }, { athlete: { ...props.athlete, id: 'synthetic-b' } },
    { session: { user: { id: 'synthetic-coach-b' } } }]) {
    assert.equal(text(screen.render({ ...props, ...changes })).trim(), 'Kostplan')
  }
}))

test('strict OFF reads no profile, storage or calculation props', () => {
  for (const enabled of [undefined, false, 'true', 1]) assert.equal(PortalPlan({ enabled,
    get athlete() { throw Error('OFF profile') }, get session() { throw Error('OFF identity') } }), null)
})
