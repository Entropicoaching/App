import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { readFileSync } from 'node:fs'
import { jsx } from '../../../dashboard/analyseSamletJsx.mjs'
import { mount, text, nodes, createElement as h } from '../../../dashboard/analyseSamletDom.mjs'
import { fixture } from './restitutionFixtures.mjs'

// Actual copied tab, adapter, component and model. Only legacy visuals and
// React are synthetic boundaries; these assertions are not real React proof.
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
const { default: CoachRestitution, CoachRestitutionContent } = await import('./CoachRestitution.mjs')
hook.deregister()

const data = fixture()
const scope = { enabled: true, coachId: 'synthetic-coach', athleteId: data.athleteId, asOf: '2026-11-05', client: {} }
const props = { coachId: scope.coachId, a: { id: scope.athleteId }, selectedAthlete: { id: scope.athleteId },
  athleteLogs: data.exerciseLogs, athletePRHistory: [], athleteReadiness: data.readinessRows, athleteWeightLogs: [],
  exerciseLibrary: [], videoAnalyses: [], videoBaselines: [], weeks: [], videoLiftFilter: 'all' }

test('actual AnalyseTab places exactly one restitution boundary below sleep and forwards exact selected scope', async () => {
  const seen = []
  function Boundary(p) { seen.push(p); return h('p', null, p.label || 'SYNTHETIC WEEK') }
  const ui = mount(AnalyseTab, { ...props, weeklyEvaluation: h(Boundary, { componentProps: scope }) })
  const output = text(ui.render())
  const labels = ['SYNTHETIC WEEK', 'Søvn (4-8 uger)', 'Restitution (7-14 dage)', '4-ugers eksport', 'AI Rapport']
  for (let i = 1; i < labels.length; i++) assert.ok(output.indexOf(labels[i - 1]) < output.indexOf(labels[i]))
  const rest = seen.filter(p => p.label === 'Restitution (7-14 dage)')
  assert.equal(rest.length, 1)
  assert.deepEqual(rest[0].componentProps, { ...scope, readinessRows: props.athleteReadiness, exerciseLogs: props.athleteLogs })
  assert.equal((await rest[0].factory()).default, CoachRestitution)
  ui.dispose()
})

test('actual AnalyseTab OFF/missing/wrong selected scope never requests restitution factory', () => {
  for (const s of [null, { ...scope, enabled: false }, { ...scope, enabled: 'true' },
    { ...scope, coachId: 'synthetic-other' }, { ...scope, athleteId: 'synthetic-other' }]) {
    const labels = [], Boundary = p => { labels.push(p.label); return null }
    const ui = mount(AnalyseTab, { ...props, weeklyEvaluation: s && h(Boundary, { componentProps: s }) })
    ui.render(); assert.ok(!labels.includes('Restitution (7-14 dage)')); ui.dispose()
  }
})

test('actual content is folded, coach language once, evidence further folded, zero invented values', () => {
  const ui = mount(CoachRestitutionContent, { snapshot: data })
  const tree = ui.render(), output = text(tree)
  const folds = nodes(tree, n => n.type === 'details')
  assert.equal(folds.length, 2)
  assert.ok(folds.every(f => f.props.open === undefined))
  assert.equal(nodes(tree, n => n.type === 'h2').length, 0)
  assert.equal(nodes(tree, n => n.type === 'summary')[0].props.style.minHeight, 44)
  for (const expected of ['Restitution (7-14 dage)', 'Forsigtig restitutionsstatus: God', '4/7 dage',
    'atletens restitution', 'atletens egne svar', 'ikke', 'forklaring på årsager', 'Programmet ændres ikke.'])
    assert.ok(output.includes(expected), expected)
  assert.doesNotMatch(output, /din restitution|dine egne|synthetic-|NaN|Infinity|undefined/)
  ui.dispose()
})

test('authoritative absence hides the section; sparse genuine sources show For lidt data; errors stay retryable', () => {
  const ui = mount(CoachRestitutionContent)
  for (const patch of [{ readinessRows: [] }, { exerciseLogs: [] },
    { exerciseLogs: data.exerciseLogs.map(row => ({ ...row, skipped: true })) }]) {
    assert.equal(ui.render({ snapshot: { ...data, ...patch } }), null)
  }
  let tree = ui.render({ snapshot: { ...data, readinessRows: [data.readinessRows.at(-1)] } })
  assert.match(text(tree), /For lidt data/); assert.doesNotMatch(text(tree), /Forsigtig restitutionsstatus/)
  let retried = 0
  tree = ui.render({ snapshot: { status: 'error', message: 'synthetic-hidden' }, onRetry: () => retried++ })
  assert.equal(nodes(tree, n => n.props.role === 'alert').length, 1)
  nodes(tree, n => n.type === 'button')[0].props.onClick()
  assert.equal(retried, 1); assert.doesNotMatch(text(tree), /synthetic-hidden|For lidt data/)
  ui.dispose()
})

test('actual active component: no reads without both sources or while OFF; generic failure and retry', async () => {
  let reads = 0
  const client = { from() { reads++; throw Error('synthetic-hidden') } }
  for (const patch of [{ enabled: false }, { readinessRows: [] }, { exerciseLogs: [] }, { athleteId: 'synthetic-other' }]) {
    const ui = mount(CoachRestitution, { ...scope, client, readinessRows: data.readinessRows, exerciseLogs: data.exerciseLogs, ...patch })
    assert.equal(ui.render(), null); ui.dispose()
  }
  assert.equal(reads, 0)
  const ui = mount(CoachRestitution, { ...scope, client, readinessRows: data.readinessRows, exerciseLogs: data.exerciseLogs })
  assert.match(text(ui.render()), /Henter registreringer/)
  await new Promise(resolve => setImmediate(resolve))
  let tree = ui.render(); assert.match(text(tree), /Kunne ikke vise hele datagrundlaget/)
  assert.doesNotMatch(text(tree), /synthetic-hidden/)
  const failedReads = reads
  nodes(tree, n => n.type === 'button')[0].props.onClick()
  assert.match(text(ui.render()), /Henter registreringer/)
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(reads, failedReads * 2)
  ui.dispose()
})

test('actual active component rejects late former-athlete responses and invalidates OFF immediately', async () => {
  const pending = []
  const client = { from(table) {
    const q = {}
    for (const method of ['select', 'eq', 'gte', 'lte', 'lt', 'order']) q[method] = () => q
    q.limit = () => new Promise(resolve => pending.push({ table, resolve }))
    return q
  } }
  const initial = { ...scope, client, readinessRows: data.readinessRows, exerciseLogs: data.exerciseLogs }
  const ui = mount(CoachRestitution, initial)
  assert.match(text(ui.render()), /Henter registreringer/)
  const otherData = fixture(), otherId = 'synthetic-other'
  otherData.athleteId = otherId
  for (const row of [...otherData.readinessRows, ...otherData.exerciseLogs]) row.athlete_id = otherId
  otherData.readinessRows.forEach(row => { row.energy = 2 })
  const other = { ...initial, athleteId: otherId, readinessRows: otherData.readinessRows, exerciseLogs: otherData.exerciseLogs }
  assert.match(text(ui.render(other)), /Henter registreringer/)
  for (const item of pending.slice(0, 2)) item.resolve({ data: item.table === 'readiness_logs' ? data.readinessRows : data.exerciseLogs })
  await new Promise(resolve => setImmediate(resolve))
  assert.match(text(ui.render()), /Henter registreringer/)
  assert.doesNotMatch(text(ui.render()), /Forsigtig restitutionsstatus: God/)
  for (const item of pending.slice(2)) item.resolve({ data: item.table === 'readiness_logs' ? otherData.readinessRows : otherData.exerciseLogs })
  await new Promise(resolve => setImmediate(resolve))
  assert.match(text(ui.render()), /Forsigtig restitutionsstatus: Lav/)
  assert.equal(ui.render({ ...other, enabled: false }), null)
  ui.dispose()
})
