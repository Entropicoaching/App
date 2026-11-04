// Supplementary hook/element simulation. This is NOT ReactDOM or a browser test.
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { createHost, descendants, memoryStorage, textContent } from '../../checkin/syntheticReact.mjs'
import { planLift } from '../meetModel.mjs'
import { draftKey, loadDraft } from './athleteMeetDraft.mjs'
import { planFingerprint, readPlans } from './athleteMeetModel.mjs'

const component = new URL('./AthleteMeetDay.mjs', import.meta.url).href
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'react' && context.parentURL === component)
    return { url: new URL('../../checkin/syntheticReact.mjs', import.meta.url).href, shortCircuit: true }
  return next(specifier, context)
} })
const { default: AthleteMeetDay } = await import('./AthleteMeetDay.mjs')
const fixture = () => ({ enabled: true, athleteId: 'synthetic-athlete', meetId: 'synthetic-meet', planRevision: 'v1',
  plans: { squat: planLift({ e1RM: 200, openerTime: '10:00' }), bench: planLift({ e1RM: 100 }), deadlift: planLift({ e1RM: 250 }) }, storage: memoryStorage() })
const setup = extra => createHost(AthleteMeetDay, { ...fixture(), ...extra })
const nodes = host => descendants(host.tree)
const radio = (host, index, value) => nodes(host).filter(node => node.type === 'fieldset')[index].children
  .flatMap(descendants).find(node => node.type === 'input' && node.props.value === value)
const choose = (host, index, value) => { radio(host, index, value).props.onChange(); host.render() }
const select = (host, lift) => { nodes(host).find(node => node.type === 'select').props.onChange({ target: { value: lift } }); host.render() }
const button = (host, label) => nodes(host).find(node => node.type === 'button' && textContent(node) === label)
const click = (host, label) => { button(host, label).props.onClick(); host.render() }
const total = host => textContent(nodes(host).find(node => node.props['aria-label'] === 'Total'))

test('synthetic: OFF, read failure, empty and invalid scope never access storage or hidden data', () => {
  for (const enabled of [undefined, false, null, 1, 'true']) {
    assert.equal(AthleteMeetDay({ enabled, get plans() { assert.fail('OFF plans') }, get storage() { assert.fail('OFF storage') } }), null)
  }
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { assert.fail('unwanted global storage') } })
  try {
    assert.match(textContent(setup({ plans: null, storage: undefined }).tree), /Ingen plan/)
    assert.match(textContent(setup({ athleteId: '', storage: undefined }).tree), /Vælg en atlet/)
    assert.match(textContent(setup({ error: true, storage: undefined }).tree), /kunne ikke indlæses/)
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original)
    else delete globalThis.localStorage
  }
})

test('synthetic: interactions autosave, reload and correct a result; lift selection itself writes nothing', () => {
  const host = setup()
  assert.ok(host.props.storage.calls.every(([op]) => op === 'get'))
  choose(host, 0, 'good')
  assert.equal(radio(host, 0, 'good').props.checked, true)
  assert.match(total(host), /Foreløbig sum: 180 kg/)
  const before = host.props.storage.calls.length
  select(host, 'bench')
  assert.equal(host.props.storage.calls.length, before)
  assert.match(textContent(host.tree), /90 kg/)
  assert.match(textContent(host.tree), /Åbnertid mangler/)
  choose(host, 1, 'good'); select(host, 'deadlift'); choose(host, 2, 'good')
  assert.match(total(host), /Foreløbig total: 525 kg/)
  const again = setup(host.props)
  assert.equal(radio(again, 0, 'good').props.checked, true)
  select(again, 'deadlift'); assert.equal(radio(again, 2, 'good').props.checked, true)
  choose(again, 2, 'miss')
  assert.match(total(again), /Foreløbig sum: 275 kg/)
  select(again, 'squat'); choose(again, 0, 'pending')
  assert.match(total(again), /Foreløbig sum: 95 kg/)
  assert.match(textContent(again.tree), /Kladde gemt på denne enhed/)
  assert.ok(again.props.storage.calls.every(([, key]) => key === draftKey(again.props.athleteId, again.props.meetId, again.props.planRevision)))
})

test('synthetic: all misses never produce a zero total; missing or broken lifts have no result controls', () => {
  const host = setup()
  for (const lift of ['squat', 'bench', 'deadlift']) {
    select(host, lift)
    for (let i = 0; i < 3; i++) choose(host, i, 'miss')
  }
  assert.match(total(host), /Ingen total/); assert.doesNotMatch(total(host), /0 kg/)
  const partial = setup({ plans: { squat: fixture().plans.squat, bench: { status: 'error' } } })
  select(partial, 'bench')
  assert.match(textContent(partial.tree), /kunne ikke vises/)
  assert.equal(nodes(partial).filter(node => node.type === 'input').length, 0)
  select(partial, 'deadlift')
  assert.match(textContent(partial.tree), /Ingen plan for Dødløft/)
  assert.ok(partial.props.storage.calls.every(([op]) => op === 'get'))
})

test('synthetic: failed saves keep current results, retry saves; failed clear keeps data and successful clear isolates scope', () => {
  const host = setup(), storage = host.props.storage, set = storage.setItem, remove = storage.removeItem
  storage.setItem = () => { throw Error('synthetic quota') }
  choose(host, 0, 'good')
  assert.equal(radio(host, 0, 'good').props.checked, true)
  assert.match(textContent(host.tree), /kun her/)
  storage.setItem = set; click(host, 'Gem kladde')
  assert.match(textContent(host.tree), /Kladde gemt/)
  const key = draftKey(host.props.athleteId, host.props.meetId, host.props.planRevision)
  assert.equal(loadDraft(key, planFingerprint(readPlans(host.props.plans)), storage).results.squat[0], 'good')
  storage.removeItem = () => { throw Error('synthetic remove') }; click(host, 'Slet kladde')
  assert.match(textContent(host.tree), /kunne ikke slettes/)
  assert.equal(radio(host, 0, 'good').props.checked, true)
  storage.removeItem = remove; click(host, 'Slet kladde')
  assert.equal(radio(host, 0, 'pending').props.checked, true)
  assert.equal(storage.data.has(key), false)
  assert.equal(storage.data.get('unrelated-key'), 'preserved')
})

test('synthetic: athlete, meet, revision, changed weights and storage adapter never carry old outcomes forward', () => {
  for (const change of [props => ({ ...props, athleteId: 'synthetic-other' }), props => ({ ...props, meetId: 'synthetic-other' }),
    props => ({ ...props, planRevision: 'v2' }), props => ({ ...props, storage: memoryStorage() }),
    props => { const plans = structuredClone(props.plans); plans.squat.attempts[0] = 177.5; return { ...props, plans } }]) {
    const host = setup(); choose(host, 0, 'good')
    const writes = host.props.storage.calls.filter(([op]) => op === 'set').length
    host.render(change(host.props))
    assert.equal(radio(host, 0, 'pending').props.checked, true)
    assert.match(total(host), /Ingen godkendte/)
    assert.ok(host.props.storage.calls.filter(([op]) => op === 'set').length <= writes)
  }
  const host = setup({ storage: null }); choose(host, 0, 'good')
  host.render({ ...host.props, enabled: false }); assert.equal(host.tree, null)
  host.render({ ...host.props, enabled: true })
  assert.equal(radio(host, 0, 'pending').props.checked, true)
})

test('synthetic: mobile controls have large labels, named radio groups, unique ids and folded optional content', () => {
  const host = setup(), all = nodes(host)
  const ids = all.filter(node => node.props.id).map(node => node.props.id)
  assert.equal(ids.length, new Set(ids).size)
  for (const node of all.filter(node => node.type === 'input')) {
    const label = all.find(item => item.type === 'label' && item.props.htmlFor === node.props.id)
    assert.ok(label); assert.ok(label.props.style.minHeight >= 48)
    assert.ok(node.props.name)
  }
  for (const node of all.filter(node => ['select', 'button', 'summary'].includes(node.type))) assert.ok(node.props.style.minHeight >= 48)
  assert.equal(all.filter(node => node.type === 'details').length, 2)
  assert.ok(all.filter(node => node.type === 'details').every(node => node.props.open === undefined))
  assert.match(textContent(host.tree), /sendes ikke til din coach/)
  assert.match(textContent(host.tree), /delt enhed/)
  const after = structuredClone(host.props.plans)
  choose(host, 0, 'good')
  assert.deepEqual(host.props.plans, after)
})
