import test from 'node:test'
import assert from 'node:assert/strict'
import { load, nodes, text, normalize } from './coachMenuHarness.mjs'
import { rel1030Feature } from '../rel1030.mjs'
const Sidebar = (await load('Sidebar.jsx')).default
const Mobile = (await load('MobilNav.jsx')).default
const BaseSidebar = (await load('SidebarBase.txt')).default
const BaseMobile = (await load('MobilNavBase.txt')).default
const { coachRydEnabled, DEFAULT_COACH_RYD } = await load('coachRyd.mjs')
const { CoachMenuMore } = await load('coachMenuMore.mjs')
const noop = () => {}
function fixture(extra = {}) {
  return { athletes: [], hiddenAthleteIds: new Set(), athleteWeekSummary: {}, unreadCounts: {},
    todayData: { logs: [] }, view: 'inbox', isMobile: true, sidebarOpen: true,
    setView: noop, setSelectedAthlete: noop, setSidebarOpen: noop, setMenuSheetOpen: noop,
    setSheetPreviewPick: noop, ...extra }
}
const buttons = tree => nodes(tree).filter(n => n.type === 'button')

test('rebase counter 1: both explicit URL flags retain strict target semantics', () => {
  assert.equal(DEFAULT_COACH_RYD, false)
  for (const [query, expected] of [['', false], ['?rel1030=1', true], ['?coachRyd=1', true],
    ['?rel1030=0&coachRyd=0', false], ['?rel1030=true', false],
    ['?rel1030=1&rel1030=0', false], ['?coachRyd=1&coachRyd=0', false],
    ['?rel1030=1&coachRyd=0', true], ['?rel1030=0&coachRyd=1', true]]) {
    assert.equal(coachRydEnabled(query), expected, query)
  }
})
test('rebase counter 2: rel1030 enables the existing named navigation with menu closed', () => {
  assert.equal(rel1030Feature('coachRyd', '?rel1030=1'), true)
  for (const Component of [Sidebar, Mobile]) {
    const tree = Component(fixture({ coachRyd: coachRydEnabled('?rel1030=1'), menuSheetOpen: false }))
    assert.match(text(tree), /Arbejdsindbakke/)
    assert.doesNotMatch(text(tree), /Coach Briefing/)
  }
})
test('rebase counter 3: disabled target trees remain identical with selected athlete and picker', () => {
  for (const [Component, Base] of [[Sidebar, BaseSidebar], [Mobile, BaseMobile]]) {
    for (const state of [{}, { isMobile: false }, { menuSheetOpen: true },
      { view: 'profile', selectedAthlete: { id: 'synthetic-only' } },
      { previewPickerOpen: true, sheetPreviewPick: true, menuSheetOpen: true }]) {
      const props = fixture(state)
      assert.deepEqual(normalize(Component({ ...props, coachRyd: false })), normalize(Base(props)))
    }
  }
})
test('rebase counter 4: inbox destination preserves all handler arguments for both flags', () => {
  for (const Component of [Sidebar, Mobile]) for (const query of ['?coachRyd=1', '?rel1030=1']) {
    const calls = [], props = fixture({ coachRyd: coachRydEnabled(query),
      setView: x => calls.push(['view', x]), setSelectedAthlete: x => calls.push(['athlete', x]),
      setSidebarOpen: x => calls.push(['sidebar', x]), setMenuSheetOpen: x => calls.push(['sheet', x]) })
    buttons(Component(props)).find(n => text(n).trim() === 'Arbejdsindbakke').props.onClick()
    assert.deepEqual(calls, [['view', 'inbox'], ['athlete', null], ['sidebar', false],
      ...(Component === Mobile ? [['sheet', false]] : [])])
  }
})
test('rebase counter 5: ordinary preview does not persist another athlete as own profile', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  const calls = []
  try {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true,
      value: { setItem: () => assert.fail('Ordinary preview must not write storage') } })
    const tree = Sidebar(fixture({ coachRyd: true, previewPickerOpen: true, pickingMine: false,
      athletes: [{ id: 'synthetic-other', name: 'Other' }],
      onPreviewAthlete: id => calls.push(id), setPreviewPickerOpen: noop }))
    buttons(tree).find(n => text(n) === 'Other').props.onClick()
    assert.deepEqual(calls, ['synthetic-other'])
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous)
    else delete globalThis.localStorage
  }
})
test('rebase counter 6: no surrounding disclosure safely ignores Escape and back', () => {
  const tree = CoachMenuMore({ enabled: true, children: [] })
  const currentTarget = { closest: () => null }
  tree.props.onKeyDown({ key: 'Escape', currentTarget, preventDefault: noop })
  buttons(tree)[0].props.onClick({ currentTarget })
})
test('rebase counter 7: existing picker remains outside closed More under release opt-in', () => {
  const tree = Sidebar(fixture({ coachRyd: coachRydEnabled('?rel1030=1'), previewPickerOpen: true,
    athletes: [{ id: 'synthetic-only', name: 'Visible Picker' }], onPreviewAthlete: noop }))
  const fold = nodes(tree).find(n => n.type === 'details')
  const picker = buttons(tree).find(n => text(n) === 'Visible Picker')
  assert.ok(picker)
  assert.ok(!nodes(fold).includes(picker))
  assert.equal(buttons(tree).filter(n => text(n) === 'Visible Picker').length, 1)
})
