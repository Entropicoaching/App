import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { mount, text, nodes, createElement as h } from '../../../dashboard/analyseSamletDom.mjs'
import { readFileSync } from 'node:fs'
import { jsx } from '../../../dashboard/analyseSamletJsx.mjs'

const tabURL = new URL('../../../dashboard/AnalyseTab.jsx', import.meta.url).href
const fixtureURL = new URL('./monthlyReactFixture.mjs', import.meta.url).href
const legacy = new Set(['../dashboardCharts.jsx', './AnalyseLokaltVaerktoej.jsx', './primaerKurve.js', '../danskDato.js', '../AthleteSilentFailNote.jsx'])
const boundary = registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'react' && context.parentURL?.startsWith(new URL('../../../', import.meta.url).href))
      return { url: fixtureURL, shortCircuit: true }
    if (context.parentURL === tabURL && legacy.has(specifier))
      return { url: new URL('../../../dashboard/analyseSamletStubs.mjs', import.meta.url).href, shortCircuit: true }
    return next(specifier, context)
  },
  load(url, context, next) {
    if (url.endsWith('.jsx') && url.startsWith(new URL('../../../', import.meta.url).href))
      return { format: 'module', source: `import { h as __h } from '${fixtureURL}';\n${jsx(readFileSync(new URL(url), 'utf8'))}`, shortCircuit: true }
    return next(url, context)
  },
})
const { default: AnalyseTab } = await import('../../../dashboard/AnalyseTab.jsx')
const { default: Export, MonthlyExportContent } = await import('./CoachMonthlyExport.mjs')
boundary.deregister()

const props = { coachId: 'synthetic-coach', a: { id: 'synthetic-athlete' }, selectedAthlete: { id: 'synthetic-athlete' },
  athleteLogs: [], athletePRHistory: [], athleteReadiness: [], athleteWeightLogs: [],
  exerciseLibrary: [], videoAnalyses: [], videoBaselines: [], weeks: [], videoLiftFilter: 'all' }
const scope = { enabled: true, coachId: props.coachId, athleteId: props.a.id, asOf: '2026-11-04', client: {} }

test('actual AnalyseTab mounts one export boundary below Ugeevaluering and before legacy tools; scope is exact', async () => {
  const seen = []
  function WeeklyBoundary(p) {
    seen.push(p)
    return p.label === '4-ugers eksport' ? h('div', null, 'SYNTHETIC EXPORT') : h('h2', null, 'Ugeevaluering')
  }
  const ui = mount(AnalyseTab, { ...props, weeklyEvaluation: h(WeeklyBoundary, { componentProps: scope }) })
  const tree = ui.render(), output = text(tree)
  assert.ok(output.indexOf('Ugeevaluering') < output.indexOf('SYNTHETIC EXPORT'))
  assert.ok(output.indexOf('SYNTHETIC EXPORT') < output.indexOf('AI Rapport'))
  const exportBoundary = seen.filter(p => p.label === '4-ugers eksport')
  assert.equal(exportBoundary.length, 1); assert.equal(exportBoundary[0].componentProps, scope)
  assert.equal((await exportBoundary[0].factory()).default, Export)
  ui.dispose()
})

test('actual tab OFF, missing evaluation and mismatched coach/athlete never expose export', () => {
  for (const evaluation of [null, h('section', null, 'marker'),
    ...[{ ...scope, enabled: false }, { ...scope, athleteId: 'synthetic-other' }, { ...scope, coachId: 'synthetic-other' }]
      .map(componentProps => h(p => h('div', null, p.label === '4-ugers eksport' ? 'SYNTHETIC EXPORT' : ''), { componentProps }))]) {
    const ui = mount(AnalyseTab, { ...props, weeklyEvaluation: evaluation })
    assert.doesNotMatch(text(ui.render()), /Eksportér|SYNTHETIC EXPORT/)
    ui.dispose()
  }
})

test('actual export control: folded by default, mobile wrapping, separate CSV/JSON handlers and distinct states', () => {
  const calls = [], ui = mount(MonthlyExportContent, { onExport: format => calls.push(format) })
  let tree = ui.render()
  assert.match(text(tree), /Eksportér 4 uger \(CSV\/JSON\)/)
  assert.equal(nodes(tree, n => n.type === 'details')[0].props.open, undefined)
  const buttons = nodes(tree, n => n.type === 'button')
  buttons.forEach(button => button.props.onClick())
  assert.deepEqual(calls, ['csv', 'json'])
  tree = ui.render({ state: { status: 'loading' } })
  assert.match(text(tree), /Henter eksport/)
  assert.ok(nodes(tree, n => n.type === 'button').every(button => button.props.disabled))
  tree = ui.render({ state: { status: 'empty', message: 'Ingen registreringer i perioden.' } })
  assert.match(text(tree), /Ingen registreringer/)
  assert.equal(nodes(tree, n => n.props.role === 'alert').length, 0)
  tree = ui.render({ state: { status: 'error', message: 'Prøv igen.' } })
  assert.equal(nodes(tree, n => n.props.role === 'alert').length, 1)
  ui.dispose()
})

test('actual hooked component does not read before click; errors permit retry; unmount cancels a pending request', async () => {
  let reads = 0, release
  const wait = new Promise(resolve => { release = resolve })
  const client = { from() { reads++; throw Error('synthetic error') } }
  const ui = mount(Export, { ...scope, client })
  let tree = ui.render()
  assert.equal(reads, 0)
  await nodes(tree, n => n.type === 'button')[0].props.onClick()
  tree = ui.render()
  assert.match(text(tree), /Eksporten kunne ikke hentes komplet/)
  assert.ok(nodes(tree, n => n.type === 'button').every(button => !button.props.disabled))
  const slow = { from() { const q = { select() { return q }, eq() { return q }, gte() { return q },
    lte() { return q }, lt() { return q }, order() { return q }, async range() { await wait; return { data: [] } } }; return q } }
  tree = ui.render({ ...scope, client: slow })
  const pending = nodes(tree, n => n.type === 'button')[0].props.onClick()
  assert.match(text(ui.render()), /Henter eksport/)
  ui.dispose(); release(); await pending
  assert.match(text(ui.render()), /Henter eksport/)
})

test('export component strict OFF inspects no client and exposes no UI', () => {
  const poison = new Proxy({}, { get() { throw Error('OFF client read') } })
  assert.equal(Export({ enabled: false, client: poison }), null)
})

test('actual component invalidates old athlete results synchronously and starts new scope idle', async () => {
  let release
  const wait = new Promise(resolve => { release = resolve })
  const client = { from() { const q = { select() { return q }, eq() { return q }, gte() { return q },
    lte() { return q }, lt() { return q }, order() { return q }, async range() { await wait; return { data: [] } } }; return q } }
  const ui = mount(Export, { ...scope, client })
  const pending = nodes(ui.render(), n => n.type === 'button')[0].props.onClick()
  assert.match(text(ui.render()), /Henter eksport/)
  const switched = ui.render({ ...scope, client, athleteId: 'synthetic-other' })
  assert.doesNotMatch(text(switched), /Henter eksport|Ingen registreringer|kunne ikke/)
  release(); await pending
  assert.doesNotMatch(text(ui.render()), /Henter eksport|Ingen registreringer|kunne ikke/)
  ui.dispose()
})
