// Actual portal imports with explicit synthetic hooks and memory storage.
// This does not stand in for the separate required real React gate.
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { mount, nodes, text, memoryStorage } from './portal.fixture.mjs'
import { draftKey } from './portalModel.mjs'
import { FOODS } from '../foedevarer/catalog.mjs'

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
  let tree = screen.render(); {
    // Source4: exact closed entry contract, before either catalogue is chosen.
    const closedEntry = tree
    assert.equal(text(closedEntry).trim(), 'Åbn kostplan med Frida-fødevarer Kostplan')
    const choices = nodes(closedEntry).filter(n => ['button', 'summary'].includes(n.type))
    assert.deepEqual(choices.map(n => [n.type, text(n)]), [
      ['button', 'Åbn kostplan med Frida-fødevarer'], ['summary', 'Kostplan'],
    ])
    assert.equal(choices[0].props.type, 'button')
    assert.equal(choices[0].props.disabled ?? false, false)
    assert.equal(choices[0].props.hidden ?? false, false)
    assert.equal(typeof choices[0].props.onClick, 'function')
    assert.ok(choices.every(n => n.props.style.minHeight >= 44))
    assert.equal(nodes(closedEntry).filter(n => ['form', 'input', 'select', 'textarea'].includes(n.type)).length, 0)
    assert.ok(nodes(closedEntry).filter(n => n.type === 'details').every(n => !n.props.open))
  }; assert.equal(storage.calls.length, 0)
  open(tree); tree = screen.render()
  assert.ok(button(tree, 'Generér forslag')); assert.equal(named(tree, 'fat'), undefined)
  assert.equal(named(tree, 'template-minGrams-0-0').props.value, '')
  change(tree, 'template-food-0-0', 'local:Ris%20kogt'); tree = screen.render()
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
    {
      // Source4: exact closed entry contract, before either catalogue is chosen.
      const closedEntry = screen.render({ ...props, ...changes })
      assert.equal(text(closedEntry).trim(), 'Åbn kostplan med Frida-fødevarer Kostplan')
      const choices = nodes(closedEntry).filter(n => ['button', 'summary'].includes(n.type))
      assert.deepEqual(choices.map(n => [n.type, text(n)]), [
        ['button', 'Åbn kostplan med Frida-fødevarer'], ['summary', 'Kostplan'],
      ])
      assert.equal(choices[0].props.type, 'button')
      assert.equal(choices[0].props.disabled ?? false, false)
      assert.equal(choices[0].props.hidden ?? false, false)
      assert.equal(typeof choices[0].props.onClick, 'function')
      assert.ok(choices.every(n => n.props.style.minHeight >= 44))
      assert.equal(nodes(closedEntry).filter(n => ['form', 'input', 'select', 'textarea'].includes(n.type)).length, 0)
      assert.ok(nodes(closedEntry).filter(n => n.type === 'details').every(n => !n.props.open))
    }
  }
}))

test('strict OFF reads no profile, storage or calculation props', () => {
  for (const enabled of [undefined, false, 'true', 1]) assert.equal(PortalPlan({ enabled,
    get athlete() { throw Error('OFF profile') }, get session() { throw Error('OFF identity') } }), null)
})

test('actual portal generates untouched meals, explains current marked foods and preserves coach overrides', () => withStorage(async storage => {
  const screen = mount(PortalPlan, props)
  open(screen.render()); let tree = screen.render()
  assert.match(text(tree), /5–300 g/)
  change(tree, 'template-food-0-0', 'local:Sukker')
  change(screen.render(), 'template-minGrams-0-0', '25')
  change(screen.render(), 'template-maxGrams-0-0', '25')
  generate(screen.render()); tree = screen.render()
  assert.equal(nodes(tree).filter(n => n.props.role === 'alert').length, 0)
  assert.equal(named(tree, 'food-0-0').props.value, 'local:Sukker')
  assert.equal(named(tree, 'grams-0-0').props.value, 25)
  assert.equal(named(tree, 'food-0-1'), undefined)
  const food = FOODS.find(food => food.id === named(tree, 'food-1-0').props.value)
  assert.ok(text(tree).includes('Protein med essentielle aminosyrer; andre kilder kan dække behovet.'))
  assert.ok(!text(tree).includes(food.prioritetBegrundelse))
  assert.equal(storage.calls.filter(call => call[0] === 'set').length, 0)
  change(tree, 'food-1-0', 'local:Sukker'); tree = screen.render()
  const meal = nodes(tree).find(n => n.type === 'fieldset' && text(n).includes('Frokost'))
  assert.ok(!text(meal).includes(food.prioritetBegrundelse))
  assert.ok(!text(meal).includes('Protein med essentielle aminosyrer; andre kilder kan dække behovet.'))
  await button(tree, 'Gem som kladde').props.onClick(); tree = screen.render()
  assert.deepEqual([...storage.data.keys()], [draftKey(props.session.user.id, props.athlete.id, props.today)])
  assert.match(text(tree), /Lokal kladde gemt/)
  assert.ok(nodes(tree).filter(n => n.type === 'details').every(n => !n.props.open))
}))

test('actual portal empty form shows three distinct meals and keeps them after regenerating', () => withStorage(async storage => {
  const screen = mount(PortalPlan, props)
  open(screen.render()); generate(screen.render())
  const read = tree => [2, 3, 3].map((count, mi) => Array.from({ length: count }, (_, ii) =>
    named(tree, `food-${mi}-${ii}`).props.value))
  const tree = screen.render(), selected = read(tree)
  assert.deepEqual(selected, [
    ['Skyr naturel', 'Havregryn'], ['Kyllingebryst', 'Ris kogt', 'Broccoli'],
    ['Laks fersk', 'Linser kogte', 'Broccoli'],
  ].map(meal => meal.map(name => 'local:' + encodeURIComponent(name))))
  assert.match(text(tree), /roterer efter dagens valg/)
  assert.doesNotMatch(text(tree), /højeste kendte protein|variation er ikke koblet ind/)
  assert.equal(storage.data.size, 0)
  generate(tree)
  assert.deepEqual(read(screen.render()), selected)
  assert.equal(storage.data.size, 0)
}))
