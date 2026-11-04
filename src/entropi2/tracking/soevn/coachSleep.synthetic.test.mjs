import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { readFileSync } from 'node:fs'
import { jsx } from '../../../dashboard/analyseSamletJsx.mjs'
import { mount, text, nodes, createElement as h } from '../../../dashboard/analyseSamletDom.mjs'

const src = new URL('../../../', import.meta.url).href
const tabURL = new URL('../../../dashboard/AnalyseTab.jsx', import.meta.url).href
const fixtureURL = new URL('../../../dashboard/analyseSamletDom.mjs', import.meta.url).href
const legacy = new Set(['../dashboardCharts.jsx', './AnalyseLokaltVaerktoej.jsx', './primaerKurve.js', '../danskDato.js', '../AthleteSilentFailNote.jsx'])
const hook = registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'react' && context.parentURL?.startsWith(src)) return { url: fixtureURL, shortCircuit: true }
    if (context.parentURL === tabURL && legacy.has(specifier))
      return { url: new URL('../../../dashboard/analyseSamletStubs.mjs', import.meta.url).href, shortCircuit: true }
    return next(specifier, context)
  },
  load(url, context, next) {
    if (url.endsWith('.jsx') && url.startsWith(src)) return { format: 'module',
      source: `import { h as __h } from '${fixtureURL}';\n${jsx(readFileSync(new URL(url), 'utf8'))}`, shortCircuit: true }
    return next(url, context)
  },
})
const { default: AnalyseTab } = await import('../../../dashboard/AnalyseTab.jsx')
const { default: CoachSleep, CoachSleepContent } = await import('./CoachSleep.mjs')
hook.deregister()

const scope = { enabled: true, coachId: 'synthetic-coach', athleteId: 'synthetic-athlete', asOf: '2026-11-04', client: {} }
const row = { athlete_id: scope.athleteId, logged_date: '2026-11-03', sleep_hours: 0 }
const snapshot = { status: 'ready', complete: true, athleteId: scope.athleteId, endDate: '2026-11-03',
  readinessRows: [row], qualityRows: [], exerciseLogs: [] }
const props = { coachId: scope.coachId, a: { id: scope.athleteId }, selectedAthlete: { id: scope.athleteId },
  athleteLogs: [], athletePRHistory: [], athleteReadiness: [row], athleteWeightLogs: [],
  exerciseLibrary: [], videoAnalyses: [], videoBaselines: [], weeks: [], videoLiftFilter: 'all' }

test('actual AnalyseTab: one lazy sleep boundary immediately below evaluation, before export; forwards exact scope', async () => {
  const seen = []
  function Boundary(p) {
    seen.push(p)
    return h('p', null, p.label || 'SYNTHETIC WEEK')
  }
  const ui = mount(AnalyseTab, { ...props, weeklyEvaluation: h(Boundary, { componentProps: scope }) })
  const output = text(ui.render())
  assert.ok(output.indexOf('SYNTHETIC WEEK') < output.indexOf('Søvn (4-8 uger)'))
  assert.ok(output.indexOf('Søvn (4-8 uger)') < output.indexOf('4-ugers eksport'))
  const sleep = seen.filter(p => p.label === 'Søvn (4-8 uger)')
  assert.equal(sleep.length, 1)
  assert.deepEqual(sleep[0].componentProps, { ...scope, readinessRows: props.athleteReadiness })
  assert.equal((await sleep[0].factory()).default, CoachSleep)
  ui.dispose()
})

test('actual AnalyseTab OFF/missing/mismatched scopes never request the sleep factory', () => {
  for (const s of [null, { ...scope, enabled: false }, { ...scope, coachId: 'synthetic-other' },
    { ...scope, athleteId: 'synthetic-other' }]) {
    const labels = []
    const Boundary = p => { labels.push(p.label); return null }
    const ui = mount(AnalyseTab, { ...props, weeklyEvaluation: s && h(Boundary, { componentProps: s }) })
    ui.render(); assert.ok(!labels.includes('Søvn (4-8 uger)')); ui.dispose()
  }
})

test('actual coach view: closed fold, 4/6/8 period handler, hours only, unknown coverage, no causal claims', () => {
  const periods = []
  const ui = mount(CoachSleepContent, { snapshot, onWeeks: value => periods.push(value) })
  let tree = ui.render()
  const fold = nodes(tree, n => n.type === 'details')[0]
  assert.equal(fold.props.open, undefined)
  assert.equal(fold.props.children[0].props.children[0], 'Søvn (4-8 uger)')
  const selector = nodes(tree, n => n.type === 'select')[0]
  assert.deepEqual(nodes(selector, n => n.type === 'option').map(n => n.props.value), [4, 6, 8])
  selector.props.onChange({ target: { value: '4' } }); assert.deepEqual(periods, [4])
  assert.match(text(tree), /8 uger/); assert.match(text(tree), /For lidt data · 1\/7 dage/)
  assert.doesNotMatch(text(tree), /Søvnkvalitet|Kvalitet:|dine pas|RPE|e1RM|synthetic-/)
  tree = ui.render({ snapshot, weeks: 4 }); assert.match(text(tree), /4 uger/)
  tree = ui.render({ snapshot: { ...snapshot, readinessRows: [] } }); assert.equal(tree, null)
  ui.dispose()
})

test('actual active adapter: absent data has no reads; fetch/retry/failure and stale athlete results', async () => {
  let reads = 0
  const client = { from() { reads++; throw Error('synthetic-private-error') } }
  for (const readinessRows of [[], [ { ...row, athlete_id: 'synthetic-other' } ]]) {
    const ui = mount(CoachSleep, { ...scope, client, readinessRows })
    assert.equal(ui.render(), null); ui.dispose()
  }
  assert.equal(reads, 0)
  const ui = mount(CoachSleep, { ...scope, client, readinessRows: [row] })
  assert.match(text(ui.render()), /Henter søvnregistreringer/)
  await new Promise(resolve => setImmediate(resolve))
  let tree = ui.render(); assert.match(text(tree), /Kunne ikke vise hele perioden/)
  assert.doesNotMatch(text(tree), /synthetic-private-error/)
  nodes(tree, n => n.type === 'button')[0].props.onClick()
  assert.match(text(ui.render()), /Henter søvnregistreringer/)
  await new Promise(resolve => setImmediate(resolve)); assert.equal(reads, 2)
  tree = ui.render({ ...scope, athleteId: 'synthetic-other', client, readinessRows: [row] })
  assert.equal(tree, null); ui.dispose()
})

test('actual active adapter: a late former-athlete response cannot replace the selected athlete', async () => {
  const pending = []
  const client = { from() {
    const q = {}
    for (const name of ['select', 'eq', 'gte', 'lte', 'order']) q[name] = () => q
    q.limit = () => new Promise(resolve => pending.push(resolve))
    return q
  } }
  const ui = mount(CoachSleep, { ...scope, client, readinessRows: [row] })
  assert.match(text(ui.render()), /Henter søvnregistreringer/)
  const otherRow = { ...row, athlete_id: 'synthetic-other', sleep_hours: 9 }
  const other = { ...scope, client, athleteId: otherRow.athlete_id, readinessRows: [otherRow] }
  assert.match(text(ui.render(other)), /Henter søvnregistreringer/)
  pending[0]({ data: [{ ...row, sleep_hours: 2 }] })
  await new Promise(resolve => setImmediate(resolve))
  assert.match(text(ui.render()), /Henter søvnregistreringer/)
  assert.doesNotMatch(text(ui.render()), /Søvn: 2 timer/)
  pending[1]({ data: [otherRow] })
  await new Promise(resolve => setImmediate(resolve))
  assert.match(text(ui.render()), /Søvn: 9 timer/)
  assert.doesNotMatch(text(ui.render()), /Henter søvnregistreringer|Søvn: 2 timer/)
  ui.dispose()
})
