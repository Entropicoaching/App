import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './analyseFixLoader.mjs'
import { mount, nodes, text, one } from './analyseSamletDom.mjs'
install({ before: process.argv.includes('--before-observed') })
const { default: AnalyseTab } = await import('./AnalyseTab.jsx')
const { liftEvidence } = await import('../dataEvidence.mjs')
const { dataEnoughEnabled } = await import('../dataEnough.mjs')
const { setPlanPresent, legacyActual, legacyPlan } = await import('./analyseFixStubs.mjs')
const names = ['Squat', 'Bænkpres', 'Dødløft']
const log = (name, weight, extra = {}) => ({ logged_at: '2026-10-01T12:00:00Z', weight, reps_completed: 3, exercises: { name }, ...extra })
const logs = [log(names[0], 100), log(names[1], 70), log(names[2], 140), log(names[0], 1000, { skipped: true }), log(names[1], 1000, { exercises: { name: names[1], sessions: { weeks: { block_name: 'Deload' } } } })]
const props = { a: { id: 'synthetic' }, selectedAthlete: { id: 'synthetic' }, athleteLogs: logs, athletePRHistory: [], athleteReadiness: [], athleteWeightLogs: [], exerciseLibrary: [], videoAnalyses: [], videoBaselines: [], weeks: [], videoLiftFilter: 'all' }
function withSearch(search, action) {
  const location = Object.getOwnPropertyDescriptor(globalThis, 'location')
  const window = Object.getOwnPropertyDescriptor(globalThis, 'window')
  try {
    Object.defineProperty(globalThis, 'location', { configurable: true, value: { search } })
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: { search } } })
    return action()
  } finally {
    if (location) Object.defineProperty(globalThis, 'location', location); else delete globalThis.location
    if (window) Object.defineProperty(globalThis, 'window', window); else delete globalThis.window
  }
}
const planCard = tree => one(tree, n => n.type === 'div' && n.props.children[0]?.type === 'div' && text(n.props.children[0]).trim().startsWith('Planlagt vs faktisk'))
const charts = tree => nodes(planCard(tree), n => n.type === 'synthetic-chart')

test('appData2 ON: plan section renders actual evidence for each lift without ReferenceError', () => withSearch('?appData2=1', () => {
  let tree
  assert.doesNotThrow(() => { tree = mount(AnalyseTab, props).render() })
  const series = charts(tree)
  assert.equal(series.length, 3, 'the previously untested plan branch must be open')
  const expected = [[{ y: 110, label: '2026-10-01' }], [{ y: 77, label: '2026-10-01' }], [{ y: 154, label: '2026-10-01' }]]
  series.forEach((chart, i) => {
    assert.deepEqual(liftEvidence(logs, names[i]).rows.map(p => ({ y: p.e1rm, label: p.dag })), expected[i])
    assert.deepEqual(chart.props.series[0], { data: expected[i], color: '#c8923a' })
    assert.deepEqual(chart.props.series[1], { data: legacyPlan, color: '#7a7770', dashed: true })
  })
}))

test('default and explicit OFF retain legacy actual and planned series', () => {
  for (const search of ['', '?appData2=0', '?appData2=true']) withSearch(search, () => {
    assert.equal(dataEnoughEnabled(), false)
    for (const chart of charts(mount(AnalyseTab, props).render())) {
      assert.deepEqual(chart.props.series[0].data, legacyActual)
      assert.deepEqual(chart.props.series[1].data, legacyPlan)
    }
  })
})

test('ON with no logs yields empty actual series, never legacy or another lift', () => withSearch('?appData2=1', () => {
  for (const chart of charts(mount(AnalyseTab, { ...props, athleteLogs: [] }).render())) assert.deepEqual(chart.props.series[0].data, [])
}))

test('no planned series hides the plan section', () => withSearch('?appData2=1', () => {
  setPlanPresent(false)
  try { assert.doesNotMatch(text(mount(AnalyseTab, props).render()), /Planlagt vs faktisk/) }
  finally { setPlanPresent(true) }
}))

test('actual component handler remains connected and render performs no external IO', () => withSearch('?appData2=1', () => {
  const keys = ['fetch', 'localStorage', 'sessionStorage', 'XMLHttpRequest', 'WebSocket']
  const prior = keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)])
  const calls = []
  try {
    for (const key of keys) Object.defineProperty(globalThis, key, { configurable: true, get() { throw Error('Forbidden IO: ' + key) } })
    const tree = mount(AnalyseTab, { ...props, setAiExportText: value => calls.push(['text', value]), setShowAiExport: value => calls.push(['show', value]) }).render()
    one(tree, n => n.type === 'button' && text(n) === 'AI Rapport').props.onClick()
    assert.deepEqual(calls, [['text', ''], ['show', true]])
    assert.equal(nodes(tree, n => n.props['aria-label'] === 'Samlet analyseprototype').length, 0)
  } finally {
    for (const [key, descriptor] of prior) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]
    }
  }
}))
