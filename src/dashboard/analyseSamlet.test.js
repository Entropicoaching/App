import test from 'node:test'
import assert from 'node:assert/strict'
import { analyseSamletEnabled, DEFAULT_ANALYSE_SAMLET, analyseDemo, analyseDemoSelection } from './analyseSamlet.mjs'
import { install } from './analyseSamletLoader.mjs'
import { mount, nodes, text, one } from './analyseSamletDom.mjs'
install()
const { default: Prototype } = await import('./AnalyseSamletPrototype.jsx')
const { default: AnalyseTab } = await import('./AnalyseTab.jsx')
const empty = { a: { id: 'synthetic-only' }, athleteLogs: [], athletePRHistory: [], athleteReadiness: [], athleteWeightLogs: [], exerciseLibrary: [], videoAnalyses: [], videoBaselines: [], weeks: [], videoLiftFilter: 'all', selectedAthlete: { id: 'synthetic-only', name: 'Synthetic' } }
const section = (tree, label) => one(tree, n => n.type === 'section' && n.props['aria-label'] === label)
const changeLift = (tree, value) => one(tree, n => n.type === 'select').props.onChange({ target: { value } })
const chooseHistory = (tree, date) => one(section(tree, 'Historik'), n => n.type === 'button' && text(n).includes(date)).props.onClick()

test('flag defaults OFF and only a single explicit 1 enables', () => {
  assert.equal(DEFAULT_ANALYSE_SAMLET, false)
  for (const query of ['', '?other=1', '?analyseSamlet=0', '?analyseSamlet=true', '?analyseSamlet=', '?analyseSamlet=1&analyseSamlet=0', '?analyseSamlet=1&analyseSamlet=1']) assert.equal(analyseSamletEnabled(query), false)
  assert.equal(analyseSamletEnabled('?analyseSamlet=1'), true)
})
test('actual AnalyseTab gates the prototype and keeps legacy AI handler', () => {
  const previous = globalThis.window
  try {
    let opened = 0, cleared = 0
    const props = { ...empty, setAiExportText: value => { assert.equal(value, ''); cleared++ }, setShowAiExport: value => { assert.equal(value, true); opened++ } }
    delete globalThis.window
    const off = mount(AnalyseTab, props).render()
    assert.equal(nodes(off, n => n.props['aria-label'] === 'Samlet analyseprototype').length, 0)
    one(off, n => n.type === 'button' && text(n) === 'AI Rapport').props.onClick()
    assert.equal(opened, 1); assert.equal(cleared, 1)
    globalThis.window = { location: { search: '?analyseSamlet=1' } }
    const on = mount(AnalyseTab, props).render()
    section(on, 'Samlet analyseprototype')
    assert.equal(nodes(on, n => n.type === 'button' && text(n) === 'AI Rapport').length, 1)
  } finally { if (previous === undefined) delete globalThis.window; else globalThis.window = previous }
})
test('one workspace shows all five areas and clearly marks demo data', () => {
  const tree = mount(Prototype).render()
  for (const label of ['Videoanalyse', 'AI-rapport', 'Historik', 'Baseline', 'Målinger']) section(tree, label)
  assert.match(text(tree), /syntetiske data/)
  assert.match(text(section(tree, 'Baseline')), /0,46 m\/s/)
  assert.match(text(section(tree, 'Målinger')), /0,48 m\/s/)
  assert.equal(nodes(tree, n => ['video', 'iframe', 'a', 'form'].includes(n.type)).length, 0)
})
test('history handler changes clip, report, baseline and measurements together', () => {
  const app = mount(Prototype)
  chooseHistory(app.render(), '2026-10-16')
  const tree = app.render()
  assert.match(text(section(tree, 'Videoanalyse')), /demo-squat-1/)
  assert.match(text(section(tree, 'AI-rapport')), /2026-10-16/)
  assert.match(text(section(tree, 'Baseline')), /Utilstrækkeligt grundlag/)
  assert.match(text(section(tree, 'Målinger')), /0,45 m\/s/)
  assert.equal(nodes(section(tree, 'Historik'), n => n.props['aria-pressed'] === true).length, 1)
})
test('lift handler clears selection, prevents cross-lift baseline and shows missing metric', () => {
  const app = mount(Prototype)
  chooseHistory(app.render(), '2026-10-16')
  changeLift(app.render(), 'bench')
  const tree = app.render()
  assert.match(text(section(tree, 'Videoanalyse')), /demo-bench-1/)
  assert.doesNotMatch(text(tree), /demo-squat|0,46|0,45/)
  assert.match(text(section(tree, 'Målinger')), /Ikke målt/)
  assert.match(text(section(tree, 'Baseline')), /Ingen sammenligning/)
  changeLift(tree, 'squat')
  assert.match(text(section(app.render(), 'Videoanalyse')), /demo-squat-2/)
})
test('empty lift clears every area and recovers after changing back', () => {
  const app = mount(Prototype)
  changeLift(app.render(), 'deadlift')
  const tree = app.render()
  assert.match(text(tree), /Ingen analyser for dette løft/)
  assert.equal(nodes(tree, n => n.type === 'button').length, 0)
  assert.doesNotMatch(text(tree), /demo-squat|120 kg|0,46/)
  for (const label of ['Videoanalyse', 'AI-rapport', 'Historik', 'Baseline', 'Målinger']) assert.ok(text(section(tree, label)).length > label.length)
  changeLift(tree, 'squat')
  assert.match(text(app.render()), /demo-squat-2/)
})
test('foreign selection falls back locally and immutable fixtures remain unchanged', () => {
  const before = JSON.stringify(analyseDemo)
  assert.equal(analyseDemoSelection('bench', 'demo-squat-1').selected.id, 'demo-bench-1')
  assert.deepEqual(analyseDemoSelection('unknown', 'demo-squat-1'), { history: [], selected: null })
  assert.throws(() => { analyseDemo[0].kg = 999 }, TypeError)
  assert.equal(JSON.stringify(analyseDemo), before)
})
