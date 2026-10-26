import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './kost2Loader.mjs'
import { begin, reset, nodes, text, createElement } from './kost2Dom.mjs'
import { kostSynlig, kostDestination, KOST_PER_ATLET, KOST_VALG } from './kostValg.mjs'
import { athleteViewUrl } from './kost2Paths.mjs'
const hooks = install()
const { default: AthleteView } = await import(athleteViewUrl.href)
const { default: BundNav } = await import('./BundNav.jsx')
const { renderMore } = await import('./enkelPrototype.mjs')
test.after(() => hooks.deregister())
const athlete = { id: 'synthetic-a' }
const choice = { 'synthetic-a': true, 'synthetic-b': false }
function view(props = {}, state = {}) {
  reset(state); begin()
  return AthleteView({ session: { user: { id: 'synthetic-user' } }, ...props })
}
const component = (tree, name) => nodes(tree, n => n.type?.name === name)[0]
function hasKost(tree) {
  const home = component(tree, 'HjemTab') || component(tree, 'LazyEnkelHjemTab')
  return Boolean(home?.props.kostCompact)
}
test('DefaultOFF preserves Kost for explicit false, missing and true choices', () => {
  assert.equal(KOST_PER_ATLET, false)
  assert.deepEqual(KOST_VALG, {})
  for (const choices of [undefined, {}, choice, { 'synthetic-a': false }]) {
    assert.equal(kostSynlig(athlete, undefined, choices), true)
    assert.equal(hasKost(view({ kostValg: choices })), true)
  }
})
test('Enabled requires own true choice for this athlete', () => {
  for (const id of ['synthetic-b', 'synthetic-c', '__proto__', '', undefined]) assert.equal(kostSynlig({ id }, true, choice), false)
  assert.equal(kostSynlig(athlete, true, choice), true)
  for (const value of [false, null, undefined, 1, 'true']) assert.equal(kostSynlig(athlete, true, { 'synthetic-a': value }), false)
  assert.equal(kostSynlig(athlete, true, Object.create(choice)), false)
  assert.equal(kostSynlig(null, true, choice), false)
})
test('Actual athlete render gates home card and stale cost page', () => {
  for (const choices of [{}, { 'synthetic-a': false }, choice]) {
    const visible = choices['synthetic-a'] === true
    const tree = view({ kostPerAtlet: true, kostValg: choices })
    assert.equal(hasKost(tree), visible)
    const cost = view({ kostPerAtlet: true, kostValg: choices }, { requestedTab: 'kost' })
    assert.equal(nodes(cost, n => n.props?.label === 'Kost').length, visible ? 1 : 0)
    assert.equal(component(cost, 'BundNav').props.tab, visible ? 'kost' : 'hjem')
  }
})
test('Actual navigation and more menu hide Kost and keep other destinations', () => {
  for (const visible of [false, true]) {
    const destinations = []
    const nav = BundNav({ athlete, visKost: visible, sharedVideoAnalyses: [], unreadMsgCount: 0, setTab: d => destinations.push(d) })
    const more = renderMore(createElement, { athlete, visKost: visible, go: d => destinations.push(d) })
    for (const tree of [nav, more]) {
      const buttons = nodes(tree, n => n.type === 'button')
      assert.equal(buttons.some(b => text(b) === 'Kost'), visible)
      buttons.find(b => text(b).includes('Program') || text(b) === 'Mit program').props.onClick()
    }
    assert.deepEqual(destinations, ['program', 'program'])
  }
})
test('Imported navigation handler rejects direct Kost request when hidden', () => {
  let tree = view({ kostPerAtlet: true, kostValg: {} })
  component(tree, 'HjemTab').props.setTab('kost')
  begin(); tree = AthleteView({ kostPerAtlet: true, kostValg: {} })
  assert.equal(component(tree, 'BundNav').props.tab, 'hjem')
  assert.equal(nodes(tree, n => n.props?.label === 'Kost').length, 0)
  assert.equal(kostDestination('beskeder', false), 'beskeder')
})
test('Simple preview recovers from stale Kost route and filters More', () => {
  const props = { enkelPrototype: true, kostPerAtlet: true, kostValg: {} }
  assert.equal(hasKost(view(props)), false)
  const tree = view(props, { requestedTab: 'kost', enkelRoute: 'kost' })
  assert.ok(component(tree, 'LazyEnkelHjemTab'))
  const more = view(props, { requestedTab: 'mere', enkelRoute: 'mere' })
  assert.equal(nodes(more, n => n.type === 'button' && text(n) === 'Kost').length, 0)
})
