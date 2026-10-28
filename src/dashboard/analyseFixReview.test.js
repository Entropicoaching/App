import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './analyseFixLoader.mjs'
import { mount, nodes, text, one } from './analyseSamletDom.mjs'
install({ before: process.argv.includes('--before-observed') })
const { default: AnalyseTab } = await import('./AnalyseTab.jsx')
const { liftEvidence } = await import('../dataEvidence.mjs')
const { DEFAULT_ANALYSE_SAMLET, analyseSamletEnabled } = await import('./analyseSamlet.mjs')
const { DEFAULT_ANALYSE_SAMMENLIGN, analyseSammenlignEnabled } = await import('./analyseSammenlign.mjs')
const props = { a: { id: 'review-synthetic' }, selectedAthlete: { id: 'review-synthetic' }, athleteLogs: [], athletePRHistory: [], athleteReadiness: [], athleteWeightLogs: [], exerciseLibrary: [], videoAnalyses: [], videoBaselines: [], weeks: [], videoLiftFilter: 'all' }
const row = (name, weight, logged_at) => ({ weight, reps_completed: 3, logged_at, exercises: { name } })
function enabled(run) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'location')
  try {
    Object.defineProperty(globalThis, 'location', { configurable: true, value: { search: '?appData2=1' } })
    run()
  } finally { if (previous) Object.defineProperty(globalThis, 'location', previous); else delete globalThis.location }
}
const planCharts = tree => {
  const card = one(tree, n => n.type === 'div' && n.props.children[0]?.type === 'div' && text(n.props.children[0]).trim().startsWith('Planlagt vs faktisk'))
  return nodes(card, n => n.type === 'synthetic-chart')
}

test('exact final: plan charts use per-lift evidence ON and preserve legacy series OFF', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'location')
  try {
    const logs = [row('Squat', 100, '2026-10-01T12:00:00Z'), row('Bænkpres', 70, '2026-10-02T12:00:00Z'), row('Dødløft', 140, '2026-10-03T12:00:00Z')]
    const app = mount(AnalyseTab, { ...props, athleteLogs: logs })
    Object.defineProperty(globalThis, 'location', { configurable: true, value: { search: '?appData2=1' } })
    const on = planCharts(app.render())
    assert.equal(on.length, 3)
    assert.deepEqual(on.map(chart => chart.props.series[0].data), [[{ y: 110, label: '2026-10-01' }], [{ y: 77, label: '2026-10-02' }], [{ y: 154, label: '2026-10-03' }]])
    for (const search of ['', '?appData2=0', '?appData2=true', '?appData2=false']) {
      globalThis.location.search = search
      const off = planCharts(app.render())
      assert.equal(off.length, 3)
      for (const chart of off) {
        assert.deepEqual(chart.props.series[0].data, [{ y: 777, label: 'legacy-only' }])
        assert.deepEqual(chart.props.series[1].data, [{ y: 888, label: 'planned-only' }])
      }
    }
    app.dispose()
  } finally { if (previous) Object.defineProperty(globalThis, 'location', previous); else delete globalThis.location }
})

test('counterexample: unordered duplicate days choose strongest valid set and reject bad date/unknown lift', () => enabled(() => {
  const logs = [row('Squat', 90, '2026-10-02T12:00:00Z'), row('Squat', 100, '2026-10-01T12:00:00Z'), row('Squat', 110, '2026-10-01T13:00:00Z'), row('Unrelated synthetic lift', 999, '2026-10-01T12:00:00Z'), row('Squat', 999, 'invalid-date')]
  const expected = [{ y: 121, label: '2026-10-01' }, { y: 99, label: '2026-10-02' }]
  assert.deepEqual(liftEvidence(logs, 'Squat').rows.map(p => ({ y: p.e1rm, label: p.dag })), expected)
  // Invalid timestamps are checked at the evidence boundary: the legacy page
  // still expects its existing timestamp contract.
  const tree = mount(AnalyseTab, { ...props, athleteLogs: logs.slice(0, -1) }).render()
  assert.deepEqual(planCharts(tree)[0].props.series[0].data, expected)
  assert.deepEqual(planCharts(tree)[1].props.series[0].data, [])
}))

test('counterexample: same mount with replacement athlete logs retains no prior actual points', () => enabled(() => {
  const app = mount(AnalyseTab, { ...props, athleteLogs: [row('Squat', 100, '2026-10-01T12:00:00Z')] })
  assert.equal(planCharts(app.render())[0].props.series[0].data[0].y, 110)
  const next = planCharts(app.render({ ...props, a: { id: 'other-synthetic' }, athleteLogs: [row('Dødløft', 140, '2026-10-02T12:00:00Z')] }))
  assert.deepEqual(next[0].props.series[0].data, [])
  assert.deepEqual(next[2].props.series[0].data, [{ y: 154, label: '2026-10-02' }])
}))

test('counterexample: both prototype flags remain default OFF and reject ambiguous opt-in', () => {
  assert.equal(DEFAULT_ANALYSE_SAMLET, false)
  assert.equal(DEFAULT_ANALYSE_SAMMENLIGN, false)
  for (const [flag, check] of [['analyseSamlet', analyseSamletEnabled], ['analyseSammenlign', analyseSammenlignEnabled]]) {
    for (const search of ['', `?${flag}=0`, `?${flag}=true`, `?${flag}=1&${flag}=0`]) assert.equal(check(search), false)
    assert.equal(check(`?${flag}=1`), true)
  }
})
