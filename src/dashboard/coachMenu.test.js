import test from 'node:test'
import assert from 'node:assert/strict'
import { load, nodes, text, normalize, signouts } from './coachMenuHarness.mjs'

const Sidebar = (await load('Sidebar.jsx')).default
const Mobile = (await load('MobilNav.jsx')).default
const BaseSidebar = (await load('SidebarBase.txt')).default
const BaseMobile = (await load('MobilNavBase.txt')).default
const { CoachMenuMore } = await load('coachMenuMore.mjs')
const { DEFAULT_COACH_RYD, coachRydEnabled } = await load('coachRyd.mjs')

function fixture(extra = {}) {
  const calls = []
  const props = {
    athletes: [{ id: 'synthetic-a', name: 'Test Atlet' }], hiddenAthleteIds: new Set(),
    athleteWeekSummary: {}, unreadCounts: {}, todayData: { logs: [] },
    isMobile: true, menuSheetOpen: true, sidebarOpen: true, sidebarMoreOpen: false,
    sheetPreviewPick: false, previewPickerOpen: false, view: 'list', coachPriorityCount: 2,
  }
  for (const key of ['setView', 'setSelectedAthlete', 'setSidebarOpen', 'setMenuSheetOpen',
    'setSheetPreviewPick', 'setShowAddModal', 'setPickingMine', 'setPreviewPickerOpen',
    'setSidebarMoreOpen', 'setMyAthleteId', 'goToMyProfile', 'openProfile',
    'openVideoCoachV3', 'onPreviewAthlete', 'exportBackup', 'exportTraeningsdata']) {
    props[key] = (...args) => calls.push([key, ...args])
  }
  return { props: { ...props, ...extra }, calls }
}
const buttons = tree => nodes(tree).filter(n => n.type === 'button')
function button(tree, label) {
  const match = buttons(tree).find(n => text(n).trim().replace(/\s+/g, ' ').replace(/ [→↓]$/, '') === label)
  assert.ok(match, 'Missing button: ' + label)
  return match
}
const more = tree => nodes(tree).find(n => n.type === 'details' && text(n.children[0]) === 'Mere')

test('default OFF keeps both pinned trees across picker, busy, desktop and menu states', () => {
  assert.equal(DEFAULT_COACH_RYD, false)
  for (const search of ['', '?coachRyd=0', '?coachRyd=true', '?coachRyd=1&coachRyd=0']) assert.equal(coachRydEnabled(search), false)
  assert.equal(coachRydEnabled('?coachRyd=1'), true)
  for (const extra of [{}, { sidebarMoreOpen: true }, { isMobile: false },
    { previewPickerOpen: true, sheetPreviewPick: true },
    { exportingBackup: true, exportingTraening: true, sidebarMoreOpen: true },
    { menuSheetOpen: false }, { selectedAthlete: { id: 'synthetic-a' }, view: 'profile' }]) {
    const { props } = fixture(extra)
    for (const [Candidate, Base] of [[Sidebar, BaseSidebar], [Mobile, BaseMobile]]) {
      assert.deepEqual(normalize(Candidate(props)), normalize(Base(props)))
      assert.deepEqual(normalize(Candidate({ ...props, coachRyd: false })), normalize(Base(props)))
    }
  }
})

test('daily destinations stay outside Mere; rare destinations stay inside it', () => {
  for (const Component of [Sidebar, Mobile]) {
    const { props } = fixture({ coachRyd: true })
    const tree = Component(props), fold = more(tree)
    assert.ok(fold)
    const nested = new Set(nodes(fold))
    const daily = buttons(tree).filter(n => !nested.has(n)).map(n => text(n).trim().replace(/\s+/g, ' ').replace(/ \d+$/, ''))
    for (const label of ['Forside', 'Arbejdsindbakke', 'Atleter', 'Kalender', 'Bibliotek']) assert.ok(daily.includes(label), label)
    for (const label of ['Min træning', 'VideoCoach', 'Se som atlet']) {
      assert.ok(!daily.includes(label), label + ' leaked')
      button(fold, label)
    }
    assert.ok(text(fold).includes('Træningsdata'))
    assert.ok(text(fold).includes('Sikkerhedskopi'))
    button(fold, 'Log ud')
    button(fold, 'Tilbage til menuen')
  }
})

test('direct export and desktop VideoCoach handler identities are preserved', () => {
  for (const Component of [Sidebar, Mobile]) {
    const { props } = fixture({ coachRyd: true })
    const tree = Component(props)
    for (const [label, handler] of [['Træningsdata', props.exportTraeningsdata], ['Sikkerhedskopi', props.exportBackup]]) {
      const found = buttons(tree).find(n => text(n).includes(label))
      assert.equal(found.props.onClick, handler)
    }
    if (Component === Sidebar) assert.equal(button(tree, 'VideoCoach').props.onClick, props.openVideoCoachV3)
  }
})

test('legacy and candidate destinations call the same handlers with the same arguments', () => {
  for (const [Component, Base] of [[Sidebar, BaseSidebar], [Mobile, BaseMobile]]) {
    for (const label of ['Forside', 'Kalender', 'Bibliotek', 'Min træning', 'VideoCoach', 'Se som atlet', 'Log ud']) {
      const a = fixture({ coachRyd: true, sidebarMoreOpen: true })
      const b = fixture({ coachRyd: false, sidebarMoreOpen: true })
      const find = tree => nodes(tree).find(n => typeof n.props?.onClick === 'function' &&
        text(n).trim().replace(/\s+→$/, '') === label)
      const first = find(Component(a.props)), second = find(Base(b.props))
      assert.ok(first && second, label)
      const before = signouts.length
      first.props.onClick(); second.props.onClick()
      assert.deepEqual(a.calls, b.calls, label)
      if (label === 'Log ud') assert.equal(signouts.length - before, 2)
    }
  }
})

test('athlete destinations, preview selection and cancel remain keyboard buttons', () => {
  for (const Component of [Sidebar, Mobile]) {
    const { props, calls } = fixture({ coachRyd: true, previewPickerOpen: true, sheetPreviewPick: true })
    const tree = Component(props)
    button(tree, 'Test Atlet').props.onClick()
    assert.ok(calls.some(([key, id]) => key === 'onPreviewAthlete' && id === 'synthetic-a'))
    const cancel = buttons(tree).find(n => /Annuller|Tilbage/.test(text(n)) && text(n) !== 'Tilbage til menuen')
    assert.ok(cancel)
    cancel.props.onClick()
    assert.ok(calls.some(([key, value]) => /setPreviewPickerOpen|setSheetPreviewPick/.test(key) && value === false))
  }
  const { props, calls } = fixture({ coachRyd: true })
  button(Sidebar(props), 'Te Test Intet program').props.onClick()
  assert.equal(calls[0][0], 'openProfile')
  assert.equal(calls[0][1], props.athletes[0])
})

test('Mere uses native disclosure; Escape and back close it and restore summary focus', () => {
  const fold = CoachMenuMore({ enabled: true, children: [] })
  assert.equal(fold.type, 'details')
  assert.equal(fold.children[0].type, 'summary')
  let focused = 0, prevented = 0
  const element = { open: true, closest: () => element, querySelector: () => ({ focus: () => focused++ }) }
  fold.props.onKeyDown({ key: 'Enter', currentTarget: element })
  assert.equal(element.open, true)
  fold.props.onKeyDown({ key: 'Escape', currentTarget: element, preventDefault: () => prevented++ })
  assert.equal(element.open, false)
  assert.equal(prevented, 1)
  button(fold, 'Tilbage til menuen').props.onClick({ currentTarget: element })
  assert.equal(focused, 2)
})
