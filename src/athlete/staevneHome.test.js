import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './staevneHomeLoader.mjs'
import { createElement, nodes, text } from './staevneHomeDom.mjs'
const hooks = install()
const { staevneHome, renderStaevneHome, DEFAULT_STAEVNE_HOME } = await import('./staevneHome.mjs')
const { previewNavigation } = await import('./enkelPrototype.mjs')
const Home = (await import('./HjemTab.jsx')).default
const SimpleHome = (await import('./EnkelHjemTab.jsx')).default
const input = extra => ({ enabled: true, athlete: { competition_date: '2026-10-27' },
  currentWeek: { block_name: 'Toppe' }, now: new Date('2026-10-27T12:00:00Z'), ...extra })
const card = tree => nodes(tree, n => 'data-staevne-home' in n.props)

test('strict default OFF does not inspect athlete or program data', () => {
  assert.equal(DEFAULT_STAEVNE_HOME, false)
  const poison = new Proxy({}, { get() { assert.fail('nested read while OFF') } })
  for (const enabled of [undefined, false, null, 0, 1, 'true'])
    assert.equal(staevneHome({ enabled, athlete: poison, currentWeek: poison }), null)
})
test('0, 1 and 30 days show date count and only the existing block label', () => {
  for (const [date, days, label] of [['2026-10-27', 0, 'Stævne i dag'], ['2026-10-28', 1, '1 dag til stævne'], ['2026-11-26', 30, '30 dage til stævne']]) {
    const args = input({ athlete: { competition_date: date } })
    assert.deepEqual(staevneHome(args), { days, countdown: label, focus: 'Ugens fokus: Toppe' })
    assert.match(text(renderStaevneHome(createElement, args)), /Ugens fokus: Toppe/)
  }
  assert.equal(staevneHome(input({ currentWeek: { block_name: 'Hvile før stævne' } })).focus, 'Ugens fokus: Hvile før stævne')
  for (const currentWeek of [null, {}, { block_name: ' ' }, { block_name: 42 }])
    assert.equal(staevneHome(input({ currentWeek })).focus, null)
})
test('missing, invalid and passed meets are absent, with no invented date', () => {
  for (const date of [null, undefined, '', '2026-02-30', '2026-10-26', '2026-1-01', '2026-10-27T12:00Z', 0])
    assert.equal(staevneHome(input({ athlete: { competition_date: date } })), null)
  assert.equal(staevneHome(input({ athlete: null })), null)
  assert.equal(staevneHome(input({ now: new Date('invalid') })), null)
})
test('Copenhagen calendar days across spring and autumn DST, midnight and year end', () => {
  for (const [instant, date, days] of [
    ['2026-03-28T23:30:00Z', '2026-03-30', 1],
    ['2026-03-29T21:59:59Z', '2026-03-30', 1],
    ['2026-03-29T22:00:00Z', '2026-03-30', 0],
    ['2026-10-24T22:30:00Z', '2026-10-26', 1],
    ['2026-10-25T01:30:00Z', '2026-10-26', 1],
    ['2026-10-25T23:00:00Z', '2026-10-26', 0],
    ['2026-12-31T23:30:00Z', '2027-01-01', 0],
  ]) assert.equal(staevneHome(input({ now: new Date(instant), athlete: { competition_date: date } })).days, days)
})
const props = extra => ({ ...input(), tab: 'hjem', staevneHjem: true,
  currentWeek: { block_name: 'Toppe', sessions: [] }, allWeeks: [], exerciseLogs: [],
  days: Array(7).fill('dag'), months: Array(12).fill('måned'), messages: [], sharedVideoAnalyses: [],
  readinessHistory: [], prs: [], weightLogs: [], liftProgress: [], weeklyTonnage: [],
  exerciseHistory: {}, logInputs: {}, setTab() {}, ...extra })
for (const Component of [Home, SimpleHome]) {
  test(`${Component === Home ? 'Hjem' : 'EnkelHjem'}: real component and existing navigation handler`, () => {
    for (const enkelOn of [false, true]) {
      const calls = []
      const setTab = previewNavigation(enkelOn, value => calls.push(['tab', value]), value => calls.push(['route', value]))
      const args = props({ setTab })
      const before = JSON.stringify(args)
      const tree = Component(args)
      assert.equal(card(tree).length, 1)
      assert.match(text(card(tree)[0]), /Stævne i dagUgens fokus: ToppeSe Stævne/)
      assert.deepEqual(calls, [])
      card(tree)[0].props.onClick()
      assert.deepEqual(calls, enkelOn ? [['route', 'stævnedag'], ['tab', 'stævnedag']] : [['tab', 'stævnedag']])
      assert.equal(JSON.stringify(args), before)
    }
  })
  test('OFF preserves full legacy tree and other tabs hide the card', () => {
    const legacy = JSON.stringify(Component(props({ staevneHjem: undefined })))
    for (const staevneHjem of [false, null, 1, 'true'])
      assert.equal(JSON.stringify(Component(props({ staevneHjem }))), legacy)
    assert.equal(card(Component(props({ tab: 'program' }))).length, 0)
  })
}
test('simple week and readiness subroutes exclude the Home card', () => {
  for (const enkelDel of ['uge', 'dagsform'])
    assert.equal(card(SimpleHome(props({ enkelDel, readinessInput: { soreZones: [] } }))).length, 0)
})
test.after(() => hooks.deregister())
