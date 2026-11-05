import test from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'
import { setup, source, deferred } from './day.fixture.mjs'

register('./syntheticLoader.mjs', import.meta.url)
const { default: KostplanAtlet, KostplanAtletView } = await import('./KostplanAtlet.mjs')
const nodes = node => !node || typeof node !== 'object' ? []
  : [node, ...[node.props.children].flat(Infinity).flatMap(nodes)]
const text = node => node == null || typeof node === 'boolean' ? ''
  : typeof node !== 'object' ? String(node) : [node.props.children].flat(Infinity).map(text).join(' ')
const matching = (tree, tag, label) => nodes(tree).find(n => n.type === tag && text(n).trim() === label)
const view = (model, extra = {}) => KostplanAtletView({ enabled: true, snapshot: model.snapshot(),
  onEaten: model.markEaten, onEdit: model.toggleEdit, onGrams: model.setGrams, onRetry: model.load,
  onConfirmNotLogged: model.confirmNotLogged, ...extra })

test('synthetic view: strict OFF never reads controller, snapshot or tracker', () => {
  const poison = new Proxy({}, { get() { throw Error('OFF read') } })
  for (const enabled of [undefined, false, null, 1, 'true']) {
    assert.equal(KostplanAtlet({ enabled, controller: poison, trackerOptions: poison }), null)
    assert.equal(KostplanAtletView({ enabled, snapshot: poison, tracker: poison }), null)
  }
})

test('synthetic view: grams, full macros, status and collapsed editor; no duplicate tracker content', async () => {
  const { model } = setup(); await model.load()
  const tree = view(model, { tracker: { type: 'tracker', props: { children: 'Legacy tracker' } } }), s = text(tree)
  for (const expected of ['200 g', '100 g', '50 g', '420 kcal', '37 g protein', '58 g kulhydrat',
    '3 g fedt', '0 af 2 måltider spist', '2.200 kcal']) assert.ok(s.includes(expected), expected)
  assert.ok(!s.includes('Legacy tracker'))
  assert.equal(nodes(tree).filter(n => n.type === 'details').length, 3)
  assert.ok(nodes(tree).filter(n => n.type === 'details' && n.props.onToggle).every(n => n.props.open === false))
  assert.ok(nodes(tree).filter(n => ['button', 'summary', 'input'].includes(n.type)).every(n => n.props.style.minHeight >= 44))
})

test('synthetic view: edit event then one-tap save calls the actual model and updates status', async () => {
  const f = setup(); await f.model.load()
  let tree = view(f.model)
  nodes(tree).find(n => n.type === 'details' && n.props.onToggle).props.onToggle({ currentTarget: { open: true } })
  assert.equal(f.model.snapshot().meals[0].editing, true)
  const input = nodes(view(f.model)).find(n => n.type === 'input')
  input.props.onChange({ currentTarget: { value: '125,5' } })
  assert.match(text(view(f.model)), /323 kcal/)
  await matching(view(f.model), 'button', 'Spist med rettede gram').props.onClick()
  assert.equal(f.calls.length, 1); assert.equal(f.calls[0].foods[0].grams, 125.5)
  tree = view(f.model)
  assert.match(text(tree), /1 af 2 måltider spist/)
  assert.equal(matching(tree, 'button', 'Spist med rettede gram'), undefined)
  assert.ok(matching(tree, 'p', 'Spist'))
})

test('synthetic view: pending disables all completion buttons and inputs; confirmed failure remains retryable', async () => {
  const gate = deferred(), f = setup({ saveMeal: () => gate.promise }); await f.model.load()
  const write = matching(view(f.model), 'button', 'Spist som planlagt').props.onClick()
  assert.ok(nodes(view(f.model)).filter(n => n.type === 'button' || n.type === 'input').every(n => n.props.disabled))
  assert.equal(f.model.snapshot().totals.kcal, 0)
  gate.resolve(false); await write
  assert.ok(nodes(view(f.model)).some(n => n.props.role === 'alert'))
  assert.equal(matching(view(f.model), 'button', 'Spist som planlagt').props.disabled, false)
})

test('synthetic view: loading, failure/retry, no-plan and active empty plan are distinct', async () => {
  const f = setup({ loadDay: async () => { throw Error('synthetic') } })
  assert.match(text(view(f.model)), /Henter dagens kost/)
  await f.model.load(); assert.ok(matching(view(f.model), 'button', 'Hent dagen igen'))
  assert.ok(nodes(view(f.model)).some(n => n.props.role === 'alert'))
  const tracker = { type: 'tracker', props: { children: 'Kcal tracker' } }
  const noPlan = setup({ value: { plan: null } }); await noPlan.model.load()
  assert.strictEqual(view(noPlan.model, { tracker }), tracker)
  const value = source(); value.plan.meals = []
  const empty = setup({ value }); await empty.model.load()
  assert.match(text(view(empty.model, { tracker })), /ingen måltider i dagens aktive plan/)
  assert.ok(!text(view(empty.model, { tracker })).includes('Kcal tracker'))
})

test('synthetic view: unknown values, missing goal and missing save adapter are explicit', async () => {
  const value = source(); value.plan.targets = {}; value.plan.meals[0].foods[0].kcal100 = null
  const { model } = setup({ value, saveMeal: undefined }); await model.load()
  const tree = view(model)
  assert.match(text(tree), /mål mangler/); assert.match(text(tree), /Næringsdata mangler/)
  assert.match(text(tree), /Registrering af planmåltider er ikke tilsluttet/)
  assert.equal(matching(tree, 'button', 'Spist som planlagt').props.disabled, true)
  assert.ok(!/NaN|Infinity|undefined/.test(text(tree)))
  assert.match(text(tree), /Tilbage i dag: kcal ukendt · protein ukendt/)
})

test('synthetic view: blocked receipt offers diary inspection and explicit unlock without logging', async () => {
  const value = source(); value.blockedMeals = ['lunch']
  const f = setup({ value, releaseMeal: async () => { value.blockedMeals = []; return true } }); await f.model.load()
  const tree = view(f.model, { tracker: { type: 'tracker', props: { children: 'Eksisterende kostlog' } } })
  assert.match(text(tree), /Kontrollér kostloggen/); assert.match(text(tree), /Eksisterende kostlog/)
  assert.equal(matching(tree, 'button', 'Spist som planlagt').props.disabled, true)
  assert.ok(nodes(tree).filter(n => n.type === 'input').slice(0, 3).every(n => n.props.disabled))
  await matching(tree, 'button', 'Måltidet står ikke i kostloggen – lås op').props.onClick()
  assert.equal(f.model.snapshot().meals[0].canSave, true); assert.equal(f.calls.length, 0)
})
