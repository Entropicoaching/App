import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { load, nodes, text, normalize } from './coachMenuHarness.mjs'
import { jsx } from './coachRydJsx.mjs'

const Sidebar = (await load('Sidebar.jsx')).default
const Mobile = (await load('MobilNav.jsx')).default
const { CoachMenuMore } = await load('coachMenuMore.mjs')
const noop = () => {}
function props(extra = {}) {
  return { coachRyd: true, athletes: [{ id: 'fixture-only', name: 'Syntetisk Atlet' }],
    hiddenAthleteIds: new Set(), athleteWeekSummary: {}, unreadCounts: {}, todayData: { logs: [] },
    isMobile: true, menuSheetOpen: true, setSidebarOpen: noop, setMenuSheetOpen: noop,
    setSelectedAthlete: noop, setView: noop, setSheetPreviewPick: noop,
    setPickingMine: noop, setPreviewPickerOpen: noop, onPreviewAthlete: noop,
    setMyAthleteId: noop, ...extra }
}

test('counter: every busy export stays disabled with the identical handler', () => {
  for (const Component of [Sidebar, Mobile]) {
    const exportBackup = () => { throw Error('Disabled handler must not be invoked') }
    const exportTraeningsdata = exportBackup
    const tree = Component(props({ exportingBackup: true, exportingTraening: true, exportBackup, exportTraeningsdata }))
    const exports = nodes(tree).filter(n => n.type === 'button' && n.props.onClick === exportBackup)
    assert.equal(exports.length, 2)
    assert.ok(exports.every(n => n.props.disabled === true))
  }
})

test('counter: pick-own-profile stores only the selected synthetic ID and retains order', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  try {
    for (const Component of [Sidebar, Mobile]) {
      const calls = []
      Object.defineProperty(globalThis, 'localStorage', { configurable: true,
        value: { setItem: (...args) => calls.push(['storage', ...args]) } })
      const tree = Component(props({ previewPickerOpen: true, sheetPreviewPick: true, pickingMine: true,
        setMyAthleteId: id => calls.push(['mine', id]), setPickingMine: value => calls.push(['picking', value]),
        onPreviewAthlete: id => calls.push(['preview', id]) }))
      nodes(tree).find(n => n.type === 'button' && text(n) === 'Syntetisk Atlet').props.onClick()
      assert.deepEqual(calls, [['storage', 'entropi_my_athlete_id', 'fixture-only'],
        ['mine', 'fixture-only'], ['picking', false], ['preview', 'fixture-only']])
    }
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous)
    else delete globalThis.localStorage
  }
})

test('counter: athlete list respects hidden IDs and mobile Atleter opens the existing sidebar', () => {
  const calls = []
  const tree = Sidebar(props({ hiddenAthleteIds: new Set(['fixture-only']) }))
  assert.ok(!nodes(tree).some(n => n.type === 'button' && text(n).includes('Intet program')))
  const mobile = Mobile(props({ setSidebarOpen: value => calls.push(['sidebar', value]),
    setMenuSheetOpen: value => calls.push(['sheet', value]) }))
  nodes(mobile).find(n => n.type === 'button' && text(n) === 'Atleter').props.onClick()
  assert.deepEqual(calls, [['sidebar', true], ['sheet', false]])
})

test('counter: false or non-boolean disclosure flag preserves children and handler identity', () => {
  const onClick = noop, child = { type: 'button', props: { onClick }, children: [] }
  for (const enabled of [false, undefined, null, 0, '1']) {
    const tree = CoachMenuMore({ enabled, children: [child] })
    assert.equal(nodes(tree).filter(n => n.type === 'details').length, 0)
    assert.equal(nodes(tree).find(n => n.type === 'button').props.onClick, onClick)
  }
})

test('counter: exact final JSX and baselines translate identically with LF and CRLF', () => {
  for (const name of ['Sidebar.jsx', 'MobilNav.jsx', 'SidebarBase.txt', 'MobilNavBase.txt']) {
    const source = readFileSync(new URL(name, import.meta.url), 'utf8')
    const lf = source.replace(/\r\n/g, '\n')
    assert.equal(jsx(lf).replace(/\r\n/g, '\n'), jsx(lf.replace(/\n/g, '\r\n')).replace(/\r\n/g, '\n'))
  }
  assert.deepEqual(normalize(Sidebar(props({ coachRyd: false }))),
    normalize(Sidebar(props({ coachRyd: undefined }))))
})
