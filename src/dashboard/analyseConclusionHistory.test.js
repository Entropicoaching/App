import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRegistry } from '../testModuleRegistry.mjs'
import { install } from './analyseConclusionLoader.mjs'
import { mount, nodes, text, one } from './analyseTestDom.mjs'
install()
const { default: AnalyseTab } = await import('./AnalyseTab.jsx')
const { default: Baseline } = await import('./analyseConclusionBaseline.jsx')
const { default: Conclusion, DEFAULT_ANALYSE_CONCLUSION } = await import('./analyseConclusion.mjs')
const props = { a: { id: 'demo' }, selectedAthlete: { id: 'demo' }, athleteLogs: [], athletePRHistory: [], athleteReadiness: [], athleteWeightLogs: [], exerciseLibrary: [], videoAnalyses: [], videoBaselines: [], weeks: [], videoLiftFilter: 'all' }
const row = (id, date, focus, extra = {}) => ({ id, athlete_id: 'demo', lift: 'squat', status: 'coach_approved', analyzed_at: date, athlete_feedback: { focus: [{ text: focus }] }, ...extra })
const rows = [row('current', '2026-10-24', 'Hold spaendingen.'), row('old', '2026-10-10', 'Hold pausen. Mere tekst.'), row('oldest', '2026-09-30', 'Loeft roligt', { status: 'shared' })]
function render(extra = {}, query = '?analyseConclusion=1', Component = AnalyseTab) {
  globalThis.window = { location: { search: query } }
  return mount(Component, { ...props, ...extra }).render()
}
const history = tree => nodes(tree, n => n.props['aria-label'] === 'Tidligere konklusioner')
const clean = value => typeof value === 'function' ? '[handler]' : Array.isArray(value) ? value.map(clean) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, clean(v)])) : value

test('many: actual tab shows closed history directly after the unchanged headline, newest first', () => {
  for (const videoAnalyses of [rows, [...rows].reverse()]) {
    const tree = render({ videoAnalyses })
    const fold = history(tree)[0]
    assert.equal(history(tree).length, 1)
    assert.equal(tree.props.children[1], fold)
    assert.equal(fold.type, 'details')
    assert.equal(fold.props.open, undefined)
    assert.equal(text(fold.props.children[0]), 'Tidligere konklusioner (2)')
    assert.deepEqual(nodes(fold, n => n.type === 'li').map(text), ['2026-10-10 : Hold pausen.', '2026-09-30 : Loeft roligt.'])
    assert.deepEqual(nodes(fold, n => n.type === 'time').map(n => n.props.dateTime), ['2026-10-10', '2026-09-30'])
    assert.equal(text(tree.props.children[0]), 'Godkendt videoreview (Squat, 2026-10-24): Hold spaendingen.')
    assert.doesNotMatch(text(fold), /Hold spaendingen|Mere tekst/)
  }
})

test('one previous and no previous: count and absence have no invented conclusion', () => {
  assert.equal(text(history(render({ videoAnalyses: rows.slice(0, 2) }))[0].props.children[0]), 'Tidligere konklusioner (1)')
  for (const videoAnalyses of [[], rows.slice(0, 1)]) assert.equal(history(render({ videoAnalyses })).length, 0)
})

test('same athlete and same headline lift only, also when all lifts are selected', () => {
  const videoAnalyses = [...rows,
    row('bench', '2026-10-23', 'BENCH', { lift: 'bench' }),
    row('bench-old', '2026-10-02', 'Bench pause.', { lift: 'bench' }),
    row('foreign', '2026-10-22', 'FOREIGN', { athlete_id: 'other' }),
    row('draft', '2026-10-21', 'DRAFT', { status: 'draft' }),
    row('invalid', '2026-10-20', 'INVALID', { status: 'invalid' }),
    row('date', 'not-a-date', 'BAD DATE'), row('empty', '2026-10-19', ' ')]
  assert.doesNotMatch(text(history(render({ videoAnalyses }))[0]), /BENCH|Bench|FOREIGN|DRAFT|INVALID|BAD DATE/)
  assert.match(text(history(render({ videoAnalyses, videoLiftFilter: 'bench' }))[0]), /Bench pause/)
  for (const extra of [{ videoLiftFilter: 'deadlift' }, { selectedAthlete: { id: 'other' } }, { videoAnalysisLoading: true }, { videoAnalysisError: 'failed' }]) {
    assert.equal(history(render({ videoAnalyses, ...extra })).length, 0)
  }
})

test('OFF preserves exact pinned baseline and never reads history props', () => {
  assert.equal(DEFAULT_ANALYSE_CONCLUSION, false)
  for (const query of ['', '?analyseConclusion=0', '?analyseConclusion=true', '?analyseConclusion=1&analyseConclusion=0']) {
    const extra = { videoAnalyses: rows }
    assert.deepEqual(clean(render(extra, query)), clean(render(extra, query, Baseline)))
  }
  const child = {}
  assert.equal(Conclusion({ children: child, get analyses() { throw Error('OFF read') } }), child)
})

test('saved focus stays text, ties retain the existing deterministic order; no row mutation', () => {
  const videoAnalyses = [row('b', '2026-10-24', '<img onerror=bad>'), row('a', '2026-10-24', 'First.'), ...rows.slice(1)]
  const before = JSON.stringify(videoAnalyses)
  const tree = render({ videoAnalyses })
  assert.match(text(tree.props.children[0]), /First/)
  assert.match(text(history(tree)[0]), /<img onerror=bad>/)
  assert.equal(nodes(history(tree)[0], n => n.type === 'img').length, 0)
  assert.equal(JSON.stringify(videoAnalyses), before)
})

test('actual lift handler and rerender replace history without retaining previous athlete data', () => {
  let lift
  const instance = mount(AnalyseTab, { ...props, videoAnalyses: rows, setVideoLiftFilter: value => { lift = value } })
  globalThis.window = { location: { search: '?analyseConclusion=1' } }
  const tree = instance.render()
  one(tree, n => n.type === 'button' && text(n) === 'Bænk').props.onClick()
  assert.equal(lift, 'bench')
  assert.equal(history(instance.render({ ...props, videoAnalyses: rows, videoLiftFilter: lift })).length, 0)
  assert.equal(history(instance.render({ ...props, videoAnalyses: rows, selectedAthlete: { id: 'other' } })).length, 0)
  instance.dispose()
})

test('closed actual-layout registry admits the exact new edge for existing loaders only', () => {
  const data = JSON.parse(readFileSync(new URL('../testModuleRegistry.json', import.meta.url), 'utf8'))
  const root = new URL('../../', import.meta.url)
  const registry = createRegistry(data, root)
  for (const loader of Object.keys(data.loaders)) {
    const parent = new URL('src/dashboard/analyseConclusion.mjs', root).href
    assert.equal(registry.lookup(loader, './analyseConclusionHistory.mjs', parent)?.url, new URL('src/dashboard/analyseConclusionHistory.mjs', root).href)
    assert.equal(registry.lookup(loader, './analyseConclusionHistory', parent), null)
    assert.equal(registry.lookup(loader, './analyseConclusionHistory.mjs', new URL('src/dashboard/AnalyseTab.jsx', root).href), null)
    assert.equal(registry.lookup(loader, '../secrets.mjs', parent), null)
  }
})
