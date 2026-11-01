import test from 'node:test'
import assert from 'node:assert/strict'
import { install, stateNames } from './homeRo2Loader.mjs'
import { reset, begin, state } from './homeRo2ViewRuntime.mjs'
import { mount, nodes, text, button } from './homeRo2Dom.mjs'
const hooks = install()
const { default: View } = await import('./AthleteView.jsx')
const { default: Home } = await import('./athlete/HjemTab.jsx')
const { default: Enkel } = await import('./athlete/EnkelHjemTab.jsx')
const { default: Nyt, nytStorageKey } = await import('./nytIAppen.mjs')
const { saveHomework, readHomework } = await import('./mobilityHomework.mjs')
const { rel1101Enabled, DEFAULT_REL1101 } = await import('./rel1101.mjs')

function storage() {
  const values = new Map(), writes = []
  return { values, writes, getItem: k => values.get(k) ?? null,
    setItem(k, v) { writes.push([k, v]); values.set(k, v) },
    removeItem() { assert.fail('No deletion permitted') }, clear() { assert.fail('No clear permitted') } }
}
function setup(overrides = {}) {
  const store = storage()
  globalThis.localStorage = store
  globalThis.window = { location: { search: '' } }
  assert.equal(saveHomework('synthetic-athlete', { problemId: 'squat-hip', exerciseIds: ['sq-mob-1'] }, store).error, null)
  store.writes.length = 0
  reset(stateNames, { mereOpen: true, ...overrides })
  return store
}
const props = { role: 'athlete', session: { user: { id: 'synthetic-user' } }, mobilitetHjemme: true }
const renderView = extra => { begin(); return View({ ...props, ...extra }) }
const expand = tree => mount(() => tree, {}).render()
const homework = tree => nodes(tree, n => String(n.props['aria-label'] || '').startsWith('Hjemmeøvelser fra din coach'))

test('strict existing gate: default OFF, explicit boolean/unique URL ON', () => {
  assert.equal(DEFAULT_REL1101, false)
  for (const value of [undefined, false, 'true', 1]) assert.equal(rel1101Enabled(value), false)
  for (const query of ['?rel1101=0', '?rel1101=true', '?rel1101=1&rel1101=1', '?rel1030=1']) assert.equal(rel1101Enabled(false, query), false)
  assert.equal(rel1101Enabled(true), true)
  assert.equal(rel1101Enabled(false, '?rel1101=1'), true)
})

for (const enkelPrototype of [false, true]) for (const hjemoevKompakt of [false, true]) {
  test(`actual View + ${enkelPrototype ? 'Enkel' : 'Home'} DOM: compact=${hjemoevKompakt}, ON/OFF and saved assignment`, () => {
    const store = setup()
    const before = [...store.values]
    const options = { enkelPrototype, hjemoevKompakt }
    const off = expand(renderView(options))
    assert.ok(homework(off).length > 0, 'OFF retains actual homework component/entry')
    const on = expand(renderView({ ...options, rel1101: true }))
    assert.equal(homework(on).length, 0)
    assert.doesNotMatch(text(on), /Hjemmeøvelser fra din coach|Genindlæs hjemmeøvelser/)
    // Home itself and the alternate lazy Home are executed, not replaced with snapshots.
    const raw = renderView({ ...options, rel1101: true })
    const homeNode = nodes(raw, n => Object.hasOwn(n.props, 'homeworkEntry'))[0]
    assert.equal(homeNode.props.homeworkEntry, null)
    const actual = mount(enkelPrototype ? Enkel : Home, homeNode.props).render()
    assert.match(text(actual), /Intet pas i dag/)
    assert.equal(nodes(actual, n => n.type === 'h1').length, 1)
    if (!enkelPrototype) assert.match(text(actual), /Parathed/)
    assert.deepEqual([...store.values], before)
    assert.deepEqual(store.writes, [])
    assert.deepEqual(readHomework('synthetic-athlete', store).value.exerciseIds, ['sq-mob-1'])
    assert.ok(homework(expand(renderView(options))).length > 0, 'turning OFF reopens unchanged homework')
  })
}

test('actual View: URL activation, closed Mere, holiday and all Enkel training routes', () => {
  const store = setup()
  globalThis.window.location.search = '?rel1101=1'
  for (const enkelPrototype of [false, true]) for (const enkelRoute of ['traening', 'alle']) {
    for (const mereOpen of [false, true]) {
      reset(stateNames, { mereOpen, enkelRoute })
      assert.equal(homework(expand(renderView({ enkelPrototype, hjemoevKompakt: true }))).length, 0)
    }
  }
  reset(stateNames, { onHoliday: true })
  assert.equal(homework(expand(renderView({}))).length, 0)
  assert.deepEqual(store.writes, [])
})

test('actual handlers retain separate mobility entry and assignment with gate ON', () => {
  const store = setup({ requestedTab: 'mobilisering' })
  let raw = renderView({ rel1101: true, hjemoevKompakt: true })
  const mobility = nodes(raw, n => n.props.label === 'Mobilitet')[0]
  assert.ok(mobility.props.componentProps.homeworkEntry)
  mobility.props.componentProps.homeworkEntry.props.onClick()
  assert.equal(state().requestedTab, 'mobilisering')
  assert.equal(state().mobilityMode, 'hjemmeoevelser')
  let dom = expand(renderView({ rel1101: true, hjemoevKompakt: true }))
  assert.ok(homework(dom).length > 0)
  button(dom, '← Til Mobilitet').onClick()
  assert.equal(state().mobilityMode, null)
  assert.deepEqual(store.writes, [])
})

const newsProps = { role: 'athlete', profileId: 'synthetic-user', rel1101: true }
test('actual news line DOM: one line, dismiss, rerender, remount, profile and role isolation', () => {
  const store = storage()
  const p = { ...newsProps, storage: store }
  const instance = mount(Nyt, p)
  let tree = instance.render()
  assert.equal(nodes(tree, n => n.type === 'section').length, 1)
  assert.equal(nodes(tree, n => n.type === 'ul' || n.type === 'h2' || n.type === 'p').length, 0)
  const label = nodes(tree, n => n.type === 'span')[0]
  assert.equal(label.props.style.whiteSpace, 'nowrap')
  assert.equal(label.props.style.minWidth, 0)
  assert.equal(label.props.style.textOverflow, 'ellipsis')
  const close = nodes(tree, n => n.props['aria-label'] === 'Luk Nyt i appen')[0]
  assert.equal(close.props.type, 'button')
  assert.ok(close.props.style.minHeight >= 44)
  close.props.onClick()
  assert.equal(instance.render(), null)
  assert.equal(mount(Nyt, p).render(), null)
  assert.equal(store.getItem(nytStorageKey('athlete', 'synthetic-user')), 'closed')
  tree = instance.render({ ...p, profileId: 'other-profile' })
  assert.match(text(tree), /Nyt i appen/)
  assert.equal(instance.render(p), null)
  assert.equal(mount(Nyt, { ...p, role: 'coach' }).render(), null, 'rel1101 does not enable coach news')
})

test('news storage failures: read/write/getter failures and absent storage never crash', () => {
  const broken = { getItem() { throw Error('read denied') }, setItem() { throw Error('write denied') } }
  for (const store of [broken, null, {}]) {
    const p = { ...newsProps, storage: store }
    const instance = mount(Nyt, p)
    button(instance.render(), 'Luk').onClick()
    assert.equal(instance.render(), null, 'closes for this mount when persistence fails')
    assert.match(text(mount(Nyt, p).render()), /Nyt i appen/, 'new mount can show again without persistence')
  }
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw Error('getter denied') } })
  try {
    const instance = mount(Nyt, newsProps)
    button(instance.render(), 'Luk').onClick()
    assert.equal(instance.render(), null)
  } finally { Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: null }) }
})

test('news OFF and invalid identity are inert; rel1030 legacy card and version key remain', () => {
  const store = { getItem() { assert.fail('OFF/invalid identity read') } }
  for (const p of [{}, { rel1101: 'true' }, { search: '?rel1101=1&rel1101=1' },
    { rel1101: true, profileId: '' }, { rel1101: true, role: null }]) {
    assert.equal(mount(Nyt, { role: 'athlete', profileId: 'x', storage: store, ...p }).render(), null)
  }
  assert.equal(nytStorageKey('athlete', 'x'), 'entropi:nyt:["rel1030-2026-10-30","athlete","x"]')
  const legacy = mount(Nyt, { role: 'athlete', profileId: 'x', search: '?rel1030=1', storage: null }).render()
  assert.equal(nodes(legacy, n => n.type === 'ul').length, 1)
  const coach = mount(Nyt, { role: 'coach', profileId: 'x', search: '?rel1030=1&rel1101=1', storage: null }).render()
  assert.equal(nodes(coach, n => n.type === 'ul').length, 1)
})

test.after(() => hooks.deregister())
