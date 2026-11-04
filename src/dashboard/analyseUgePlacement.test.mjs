import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { install } from './analyseSamletLoader.mjs'
import { mount, text, createElement, nodes } from './analyseSamletDom.mjs'

const hooks = install()
const { default: AnalyseTab } = await import('./AnalyseTab.jsx')
hooks.deregister()
const props = { a: { id: 'synthetic-athlete' }, selectedAthlete: { id: 'synthetic-athlete' },
  athleteLogs: [], athletePRHistory: [], athleteReadiness: [], athleteWeightLogs: [],
  exerciseLibrary: [], videoAnalyses: [], videoBaselines: [], weeks: [], videoLiftFilter: 'all' }

test('actual copied AnalyseTab renders exactly one supplied evaluation before existing tools, OFF retains the old tab', () => {
  const marker = createElement('section', { 'aria-label': 'synthetic-evaluation' }, 'SYNTHETIC EVALUATION')
  const ui = mount(AnalyseTab, { ...props, weeklyEvaluation: marker })
  const tree = ui.render()
  assert.equal(nodes(tree, n => n.props['aria-label'] === 'synthetic-evaluation').length, 1)
  assert.ok(text(tree).indexOf('SYNTHETIC EVALUATION') < text(tree).indexOf('AI Rapport'))
  assert.doesNotMatch(text(ui.render(props)), /SYNTHETIC EVALUATION/)
  ui.dispose()
})

test('Dashboard connects its selected athlete, coach and day only through the existing Entropi 2 gate', () => {
  const source = readFileSync(new URL('../Dashboard.jsx', import.meta.url), 'utf8')
  assert.match(source, /weeklyEvaluation: e2 \? <LazyBoundary factory=\{coachWeekFactory\}/)
  assert.match(source, /componentProps=\{\{ enabled: true, client: supabase, coachId: session\?\.user\?\.id, athleteId: a\.id, asOf: e2Dag\.day \}\} \/> : null/)
  assert.equal(source.split("import('./dashboard/AnalyseUgeevaluering.mjs')").length, 2)
})
