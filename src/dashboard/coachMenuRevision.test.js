import test from 'node:test'
import assert from 'node:assert/strict'
import { load, nodes, text } from './coachMenuHarness.mjs'
const Sidebar = (await load('Sidebar.jsx')).default
const { lavNavigation } = await load('navigation.js')

function fixture(myAthleteId) {
  const calls = [], stored = []
  const props = { coachRyd: true, athletes: [{ id: 'synthetic-own', name: 'Egen Testprofil' }],
    hiddenAthleteIds: new Set(), athleteWeekSummary: {}, unreadCounts: {}, todayData: { logs: [] },
    isMobile: false, sidebarOpen: true, previewPickerOpen: false, pickingMine: false,
    view: 'list', myAthleteId, onPreviewAthlete: id => calls.push(id) }
  for (const name of ['PickingMine', 'PreviewPickerOpen', 'SidebarOpen', 'MyAthleteId']) {
    const key = name[0].toLowerCase() + name.slice(1)
    props['set' + name] = value => { props[key] = value }
  }
  props.goToMyProfile = lavNavigation(props).goToMyProfile
  return { props, calls, stored }
}
function visible(tree, label, hidden = false) {
  if (!tree || typeof tree !== 'object') return []
  const closed = hidden || (tree.type === 'details' && tree.props.open !== true)
  const here = !hidden && tree.type === 'button' && text(tree) === label ? [tree] : []
  return [...here, ...(tree.children || []).flatMap(child => visible(child, label, closed))]
}

test('K-fund 1: external Min traening opens a visible own-profile picker from closed Mere', () => {
  const { props, calls, stored } = fixture()
  assert.equal(nodes(Sidebar(props)).find(n => n.type === 'details').props.open, undefined)
  // The topbar and M shortcut call this same navigation handler directly.
  props.goToMyProfile()
  assert.equal(props.pickingMine, true)
  assert.equal(props.previewPickerOpen, true)
  const tree = Sidebar(props)
  const pickers = visible(tree, 'Egen Testprofil')
  assert.equal(pickers.length, 1, 'Own-profile picker must be visible with Mere closed')
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  try {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true,
      value: { setItem: (...args) => stored.push(args) } })
    pickers[0].props.onClick()
    assert.deepEqual(stored, [['entropi_my_athlete_id', 'synthetic-own']])
    assert.deepEqual(calls, ['synthetic-own'])
    assert.equal(props.previewPickerOpen, false)
    assert.equal(props.pickingMine, false)
    assert.equal(props.myAthleteId, 'synthetic-own')
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor)
    else delete globalThis.localStorage
  }
})

test('counter: stale saved profile opens picker; cancel and reopening remain visible', () => {
  const { props, calls } = fixture('missing-synthetic-profile')
  for (let attempt = 0; attempt < 2; attempt++) {
    props.goToMyProfile()
    const tree = Sidebar(props)
    assert.equal(visible(tree, 'Egen Testprofil').length, 1)
    const cancel = visible(tree, 'Annuller')
    assert.equal(cancel.length, 1)
    cancel[0].props.onClick()
    assert.equal(props.previewPickerOpen, false)
    assert.equal(props.pickingMine, false)
    assert.equal(visible(Sidebar(props), 'Egen Testprofil').length, 0)
  }
  assert.deepEqual(calls, [])
})

test('counter: existing own profile previews directly without opening picker', () => {
  const { props, calls } = fixture('synthetic-own')
  props.goToMyProfile()
  assert.deepEqual(calls, ['synthetic-own'])
  assert.equal(props.previewPickerOpen, false)
})

test('counter: closed loader rejects unknown and traversal imports', async () => {
  for (const name of ['unknown.mjs', '../navigation.js', 'nested/Sidebar.jsx']) {
    await assert.rejects(load(name), /Forbidden dependency/)
  }
})

test('counter: Se som atlet also exposes the picker outside the closed disclosure', () => {
  const { props } = fixture()
  const tree = Sidebar(props)
  nodes(tree).find(n => n.type === 'button' && text(n) === 'Se som atlet').props.onClick()
  assert.equal(props.pickingMine, false)
  assert.equal(visible(Sidebar(props), 'Egen Testprofil').length, 1)
})
