// Explicit synthetic hooks and in-memory storage; imports the actual portal.
// This checks actions and scope, and does not claim React/DOM reconciliation.
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { mount, nodes, text, memoryStorage } from './portal.fixture.mjs'
import { draftKey } from './portalModel.mjs'
import { RECIPES } from '../opskrifter/index.mjs'
import { input, coach, athleteId } from '../rapport/reportFixture.mjs'

const root = new URL('../../../', import.meta.url).href
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'react' && context.parentURL?.startsWith(root))
    return { url: new URL('./portal.fixture.mjs', import.meta.url).href, shortCircuit: true }
  return next(specifier, context)
} })
const { default: PortalPlan } = await import('./PortalPlan.mjs')
const { default: CoachKostMaal } = await import('../../kostMaalKobling.mjs')
hooks.deregister()

const props = { enabled: true, athlete: { id: athleteId, bodyweight: 80, protein_target: 150 },
  today: '2026-11-08', session: { user: { id: coach.id } } }
const read = () => ({ ...input(), coachId: coach.id, state: 'ready', complete: true })
const named = (tree, name) => nodes(tree).find(n => n.props.name === name)
const choose = (tree, name, value) => named(tree, name).props.onChange({ currentTarget: { value } })
const button = (tree, title) => nodes(tree).find(n => n.type === 'button' && text(n) === title)
function open(tree) {
  nodes(tree).find(n => n.type === 'details' && text(n).trim() === 'Kostplan').props.onToggle({ currentTarget: { open: true } })
}
async function withStorage(run) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage'), storage = memoryStorage()
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
  try { await run(storage) } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor)
    else delete globalThis.localStorage
  }
}

test('portal quick recipes fill grams, generate, mark protein and replace meals; only explicit save writes the existing namespace', () => withStorage(async storage => {
  const screen = mount(PortalPlan, props)
  open(screen.render()); let tree = screen.render()
  choose(tree, 'maintenanceKcal', '2400'); choose(tree, 'fat', '70')
  for (let i = 0; i < 3; i++) choose(tree, `template-recipe-${i}`, RECIPES[i].id)
  tree = screen.render()
  assert.equal(named(tree, 'template-grams-0-0').props.value, RECIPES[0].ingredients[0].grams)
  assert.equal(named(tree, 'template-food-0-0').props.value, RECIPES[0].ingredients[0].foodId)
  const generate = button(tree, 'Brug måltider og generér dagsplan')
  nodes(tree).find(n => n.type === 'form' && nodes(n).includes(generate)).props.onSubmit({ preventDefault() {} })
  tree = screen.render()
  assert.equal(nodes(tree).filter(n => n.type === 'small').length, 3)
  assert.match(text(tree), /Proteinfordeling/)
  assert.doesNotMatch(text(tree), /Ugens kost|Plan og registreret kost/)
  assert.equal(storage.data.size, 0)
  choose(tree, 'recipe-1', 'tofu-ris'); tree = screen.render()
  assert.equal(named(tree, 'food-1-0').props.value, RECIPES.find(r => r.id === 'tofu-ris').ingredients[0].foodId)
  for (const n of nodes(tree).filter(n => ['input', 'select', 'button', 'summary'].includes(n.type))) assert.ok(n.props.style.minHeight >= 44)
  assert.equal(storage.data.size, 0)
  await button(tree, 'Gem som kladde').props.onClick()
  assert.deepEqual([...storage.data.keys()], [draftKey(coach.id, athleteId, props.today)])
  assert.equal(JSON.parse([...storage.data.values()][0]).plan.status, 'draft')
  const restored = mount(PortalPlan, props); open(restored.render()); tree = restored.render()
  assert.equal(named(tree, 'food-1-0').props.value, RECIPES.find(r => r.id === 'tofu-ris').ingredients[0].foodId)
  assert.equal(nodes(tree).filter(n => n.type === 'small').length, 3)
  assert.doesNotMatch(text(tree), /Ugens kost/)
}))

test('actual portal folds a scoped report below the plan, removes stale reads immediately and resets coach/athlete/date', () => withStorage(async storage => {
  const screen = mount(PortalPlan, { ...props, nutritionRead: read() })
  let tree = screen.render()
  assert.doesNotMatch(text(tree), /Ugens kost/); assert.equal(storage.calls.length, 0)
  open(tree); tree = screen.render()
  assert.match(text(tree), /Ugens kost/)
  assert.ok(text(tree).indexOf('Dagsplan') < text(tree).indexOf('Ugens kost'))
  const folded = nodes(tree).filter(n => n.type === 'details')
  assert.ok(folded.every(n => !n.props.open))
  assert.match(text(tree), /3.500 kcal registreret/)
  assert.doesNotMatch(text(screen.render({ nutritionRead: { ...read(), state: 'loading' } })), /Ugens kost|3.500 kcal/)
  assert.doesNotMatch(text(screen.render({ nutritionRead: { ...read(), mealLogs: [] } })), /Ugens kost/)
  assert.match(text(screen.render({ nutritionRead: { ...read(), weightLogs: undefined } })), /Kostrapporten kunne ikke hentes/)
  for (const change of [{ athlete: { ...props.athlete, id: 'synthetic-b' } },
    { today: '2026-11-09' }, { session: { user: { id: 'synthetic-other-coach' } } }]) {
    tree = screen.render({ ...props, nutritionRead: read(), ...change })
    assert.equal(text(tree).trim(), 'Kostplan')
    open(tree); tree = screen.render()
    assert.doesNotMatch(text(tree), /Ugens kost|3.500 kcal/)
  }
  assert.equal(storage.data.size, 0)
}))

test('coach host forwards the exact report receipt and shows saved plan versus logged nutrition only after opening', () => withStorage(async storage => {
  const nutritionRead = read(), before = structuredClone(nutritionRead)
  const hostProps = { ...props, weightStatus: { athleteId, state: 'ready', rows: [] }, nutritionRead }
  const element = CoachKostMaal(hostProps).props.children.find(child => child.type === PortalPlan)
  assert.equal(element.props.nutritionRead, nutritionRead)
  const screen = mount(CoachKostMaal, hostProps)
  assert.doesNotMatch(text(screen.render()), /Kostrapport|Ugens kost/)
  assert.equal(storage.calls.length, 0)
  open(screen.render()); const tree = screen.render()
  assert.match(text(tree), /Plan og registreret kost/)
  assert.match(text(tree), /3.500 kcal registreret/)
  assert.match(text(tree), /4.000 kcal plan for loggede dage/)
  assert.ok(nodes(tree).filter(n => n.type === 'details').every(n => !n.props.open))
  assert.deepEqual(nutritionRead, before)
  assert.equal(storage.data.size, 0)
}))

test('coach host hides absent, stale or unplanned evidence and strict OFF never reads the receipt', () => withStorage(async storage => {
  for (const Component of [CoachKostMaal, PortalPlan]) {
    for (const enabled of [undefined, false, 'true', 1]) assert.equal(Component({ enabled,
      get nutritionRead() { throw Error('OFF receipt') }, get athlete() { throw Error('OFF athlete') } }), null)
  }
  const screen = mount(CoachKostMaal, { ...props, weightStatus: { athleteId, state: 'ready', rows: [] },
    coachNutrition: { rows: read().mealLogs }, nutritionRead: read() })
  open(screen.render())
  const plan = read().plans[0]
  for (const nutritionRead of [undefined, { ...read(), mealLogs: [] }, { ...read(), plans: [] },
    { ...read(), planHistory: 'unavailable', plans: undefined },
    { ...read(), plans: [{ ...plan, status: 'draft' }] },
    { ...read(), plans: [{ ...plan, athleteId: 'foreign' }] },
    { ...read(), state: 'loading' }, { ...read(), state: 'error' }, { ...read(), complete: false },
    { ...read(), athleteId: 'foreign' }, { ...read(), coachId: 'foreign' }, { ...read(), date: '2026-11-07' }]) {
    const tree = screen.render({ nutritionRead })
    assert.doesNotMatch(text(tree), /Kostrapport|Ugens kost|Plan og registreret kost/)
    assert.ok(named(tree, 'template-recipe-0'))
  }
  assert.match(text(screen.render({ nutritionRead: { ...read(), weightLogs: undefined } })), /Kostrapporten kunne ikke hentes/)
  assert.equal(storage.data.size, 0)
}))
