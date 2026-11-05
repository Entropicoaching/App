// Actual copied host/components/calculation; synthetic element and hook fixture.
// These checks do not claim real React or DOM reconciliation.
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { mount, nodes, text } from './portal.fixture.mjs'
import { adjustmentFixture, hostProps, ago } from './adjustment.fixture.mjs'
const root = new URL('../../../', import.meta.url).href
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'react' && context.parentURL?.startsWith(root))
    return { url: new URL('./portal.fixture.mjs', import.meta.url).href, shortCircuit: true }
  return next(specifier, context)
} })
const { default: Host, kostMaalNutritionRead } = await import('../../kostMaalKobling.mjs')
const { PortalKostJustering } = await import('./PortalPlan.mjs')
hooks.deregister()
const button = (tree, label) => nodes(tree).find(n => n.type === 'button' && text(n) === label)

function noStorage(run) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw Error('Unexpected storage') } })
  try { run() } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor)
    else delete globalThis.localStorage
  }
}

test('actual coach tab presents a weekly proposal before the folded meal editor, with reasons and no writes', () => noStorage(() => {
  const f = adjustmentFixture(), props = hostProps(f), before = structuredClone(props)
  props.saveEdit = props.startEdit = () => { throw Error('Unexpected target write') }
  const screen = mount(Host, props), tree = screen.render(), out = text(tree)
  assert.match(out, /Kostmål[\s\S]*Ugens kostjustering[\s\S]*Kostplan/)
  for (const expected of [/−140 kcal/, /Vægttrend/, /27 bekræftede kostdage/, /energi 3\/5, sult 3\/5/, /ingen plan/]) assert.match(out, expected)
  assert.equal(nodes(tree).filter(n => n.type === 'details' && n.props.open).length, 0)
  assert.equal(button(tree, 'Acceptér forslag').props.disabled, false)
  const { saveEdit, startEdit, ...data } = props
  assert.deepEqual(data, before)
}))

test('actual accept/reject handlers consume one choice, rerender a local candidate and leave targets untouched', () => noStorage(() => {
  for (const [label, expected] of [['Acceptér forslag', 'Accepteret i kladden'], ['Afvis forslag', 'Afvist i kladden']]) {
    const f = adjustmentFixture(), props = hostProps(f), before = structuredClone(props), screen = mount(Host, props)
    const first = screen.render(), staleOther = button(first, label === 'Acceptér forslag' ? 'Afvis forslag' : 'Acceptér forslag')
    const action = button(first, label)
    action.props.onClick(); action.props.onClick(); staleOther.props.onClick()
    const after = screen.render()
    assert.match(text(after), new RegExp(expected))
    assert.match(text(after), /kun denne åbne visning/)
    assert.equal(button(after, 'Acceptér forslag'), undefined); assert.equal(button(after, 'Afvis forslag'), undefined)
    assert.deepEqual(props, before)
  }
}))

test('changing evidence or identity clears a local choice, and stale evidence fails at the actual click', () => noStorage(() => {
  const f = adjustmentFixture(), screen = mount(Host, hostProps(f))
  button(screen.render(), 'Acceptér forslag').props.onClick()
  assert.match(text(screen.render()), /Accepteret i kladden/)
  f.receipt.adjustmentBasis.plan.version++
  assert.ok(button(screen.render(), 'Acceptér forslag'))
  const action = button(screen.render(), 'Acceptér forslag')
  f.receipt.complete = false; action.props.onClick()
  assert.doesNotMatch(text(screen.render()), /Ugens kostjustering|Accepteret i kladden/)
  f.receipt.complete = true
  const tree = screen.render({ session: { user: { id: 'foreign-coach' } } })
  assert.doesNotMatch(text(tree), /Ugens kostjustering/)
  assert.doesNotMatch(text(screen.render({ session: { user: { id: f.coachId } }, today: ago(1) })), /Ugens kostjustering/)
}))

test('real production seven-day host receipt has no fabricated active basis and shows no adjustment or placeholder', () => noStorage(() => {
  const f = adjustmentFixture(), props = hostProps(f)
  delete props.nutritionRead
  props.readContext = { coachId: f.coachId, day: f.date, athleteIds: [f.athleteId] }
  props.coachNutrition = { coachId: f.coachId, day: f.date, athleteIds: [f.athleteId], from: ago(6), through: f.date,
    state: 'ready', complete: true, rows: f.receipt.mealLogs.filter(r => r.date >= ago(6)), targets: [] }
  for (const status of [{ loading: true }, { loadError: true }]) {
    assert.doesNotMatch(text(mount(Host, { ...hostProps(f), ...status }).render()), /Ugens kostjustering/)
  }
  const receipt = kostMaalNutritionRead(props)
  assert.equal(receipt.planHistory, 'unavailable'); assert.equal(receipt.adjustmentBasis, undefined)
  const tree = mount(Host, props).render()
  assert.doesNotMatch(text(tree), /Ugens kostjustering|Ugevurderingen|Acceptér forslag|Efterlevelse:/)
  assert.match(text(tree), /Kostmål/)
  assert.equal(PortalKostJustering({ enabled: true, coachId: f.coachId,
    athlete: props.athlete, date: f.date, nutritionRead: receipt }), null)
}))

test('unknown readiness stays explicit; OFF reads no poisoned input', () => {
  const f = adjustmentFixture(); delete f.receipt.adjustmentBasis.readiness
  assert.match(text(mount(Host, hostProps(f)).render()), /Dagsform: ikke registreret/)
  for (const Component of [Host, PortalKostJustering]) for (const enabled of [false, undefined, null, 1, 'true']) {
    assert.equal(Component({ enabled, get nutritionRead() { throw Error('OFF') }, get athlete() { throw Error('OFF') } }), null)
  }
})
