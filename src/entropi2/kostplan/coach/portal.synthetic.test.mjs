import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { mount, nodes, text, memoryStorage } from './portal.fixture.mjs'
import { FOODS } from '../foedevarer/index.mjs'
const root = new URL('../../../', import.meta.url).href
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'react' && context.parentURL?.startsWith(root))
    return { url: new URL('./portal.fixture.mjs', import.meta.url).href, shortCircuit: true }
  return next(specifier, context)
} })
const { default: CoachKostMaal } = await import('../../kostMaalKobling.mjs')
const { default: PortalPlan } = await import('./PortalPlan.mjs')
hooks.deregister()
const props = { enabled: true, athlete: { id: 'synthetic-a', kcal_target: 2400, protein_target: 150 },
  today: '2026-11-04', session: { user: { id: 'synthetic-coach' } },
  weightStatus: { athleteId: 'synthetic-a', state: 'ready', rows: [] } }
function one(tree, type, name) {
  const matches = nodes(tree).filter(n => n.type === type && (n.props.name === name || text(n) === name))
  assert.equal(matches.length, 1, `${type}: ${name}`); return matches[0]
}
const change = (tree, name, value) => nodes(tree).find(n => n.props.name === name).props.onChange({ currentTarget: { value } })
const open = tree => nodes(tree).find(n => n.type === 'details' && text(n).trim() === 'Kostplan').props.onToggle({ currentTarget: { open: true } })

// All storage is an in-memory synthetic fixture, never the device store.
test('actual coach tab: local drafts never mount weekly adjustment; both buttons save locally', async () => {
  const storage = memoryStorage(), descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
  try {
    const screen = mount(CoachKostMaal, props)
    let tree = screen.render()
    assert.match(text(tree), /Kostmål/); assert.match(text(tree), /Kostplan/)
    assert.equal(storage.calls.length, 0)
    assert.equal(nodes(tree).filter(n => n.type === 'details' && n.props.open).length, 0)
    open(tree); tree = screen.render()
    assert.doesNotMatch(text(tree), /ingen aktiv kostplan at vurdere|Ugens kostjustering|Acceptér forslag|Afvis forslag/)
    change(tree, 'maintenanceKcal', '2400'); change(tree, 'fat', '70')
    for (let mi = 0; mi < 3; mi++) {
      change(tree, `template-food-${mi}-0`, FOODS[0].id)
      change(tree, `template-grams-${mi}-0`, '100')
    }
    tree = screen.render()
    const generate = one(tree, 'button', 'Brug måltider og generér dagsplan')
    nodes(tree).find(n => n.type === 'form' && nodes(n).includes(generate)).props.onSubmit({ preventDefault() {} })
    tree = screen.render(); assert.match(text(tree), /Dagens plan og mål/)
    assert.doesNotMatch(text(tree), /ingen aktiv kostplan at vurdere|Ugens kostjustering|Aktivér for atleten/)
    assert.equal(storage.calls.filter(c => c[0] === 'set').length, 0)
    change(tree, 'grams-0-0', '123,5'); tree = screen.render()
    await one(tree, 'button', 'Gem som kladde').props.onClick()
    tree = screen.render(); assert.match(text(tree), /Lokal kladde gemt./)
    assert.doesNotMatch(text(tree), /ingen aktiv kostplan at vurdere|Ugens kostjustering/)
    assert.doesNotMatch(text(tree), /Aktivér for atleten|Acceptér forslag|Afvis forslag/)
    await one(tree, 'button', 'Markér lokal kladde som klar').props.onClick()
    tree = screen.render(); assert.match(text(tree), /Lokal kladde gemt./)
    assert.equal(JSON.parse([...storage.data.values()][0]).plan.status, 'draft')
    assert.doesNotMatch(text(tree), /Planen er aktiveret|Ingen tidligere planer eller respons/)
    assert.equal(storage.calls.filter(c => c[0] === 'set').length, 2)
    const restoredScreen = mount(CoachKostMaal, props)
    open(restoredScreen.render()); const restored = restoredScreen.render()
    assert.equal(one(restored, 'input', 'grams-0-0').props.value, 123.5)
    assert.doesNotMatch(text(restored), /ingen aktiv kostplan at vurdere|Ugens kostjustering/)
    for (const changeProps of [{ session: { user: { id: 'synthetic-coach-b' } } },
      { today: '2026-11-05' }, { athlete: { id: 'synthetic-b' }, weightStatus: { athleteId: 'synthetic-b', state: 'ready', rows: [] } }]) {
      const next = restoredScreen.render({ ...props, ...changeProps })
      assert.doesNotMatch(text(next), /Dagens plan og mål|Gemt som kladde/)
      assert.ok(nodes(next).some(n => n.type === 'details' && text(n).trim() === 'Kostplan'))
      open(next)
      assert.doesNotMatch(text(restoredScreen.render()), /ingen aktiv kostplan at vurdere|Ugens kostjustering/)
    }
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor)
    else delete globalThis.localStorage
  }
})

test('a rejected local write keeps weekly adjustment hidden and preserves unsaved meals', async () => {
  const storage = memoryStorage(), descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  storage.setItem = () => { throw Error('synthetic quota') }
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
  try {
    const screen = mount(CoachKostMaal, props)
    open(screen.render()); let tree = screen.render()
    change(tree, 'maintenanceKcal', '2400'); change(tree, 'fat', '70')
    for (let mi = 0; mi < 3; mi++) {
      change(tree, `template-food-${mi}-0`, FOODS[0].id)
      change(tree, `template-grams-${mi}-0`, '100')
    }
    tree = screen.render()
    const generate = one(tree, 'button', 'Brug måltider og generér dagsplan')
    nodes(tree).find(n => n.type === 'form' && nodes(n).includes(generate)).props.onSubmit({ preventDefault() {} })
    tree = screen.render()
    await one(tree, 'button', 'Markér lokal kladde som klar').props.onClick()
    tree = screen.render()
    assert.match(text(tree), /Kladden blev ikke bekræftet gemt/)
    assert.match(text(tree), /Dagsplan til gennemgang/)
    assert.doesNotMatch(text(tree), /ingen aktiv kostplan at vurdere|Ugens kostjustering|Gemt som kladde;/)
    assert.equal(storage.data.size, 0)
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor)
    else delete globalThis.localStorage
  }
})

test('strict OFF and absent identity never access plan props, storage or callbacks', () => {
  for (const enabled of [false, undefined, 1, 'true']) {
    const poisoned = { enabled, get athlete() { throw Error('OFF data') }, get session() { throw Error('OFF session') } }
    assert.equal(PortalPlan(poisoned), null); assert.equal(CoachKostMaal(poisoned), null)
  }
  assert.equal(PortalPlan({ enabled: true, athlete: props.athlete, today: props.today }), null)
})
