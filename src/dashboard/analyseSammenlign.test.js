import test from 'node:test'
import assert from 'node:assert/strict'
import { comparisonClips, comparisonState, comparisonTransition as step, selectedPair, comparisonPoint, DEFAULT_ANALYSE_SAMMENLIGN, analyseSammenlignEnabled } from './analyseSammenlign.mjs'
import { install } from './analyseSamletLoader.mjs'
import { mount, nodes, one, text } from './analyseSamletDom.mjs'
install()
const { default: Compare } = await import('./AnalyseSammenlign.jsx')
const { default: AnalyseTab } = await import('./AnalyseTab.jsx')
const button = (tree, label) => one(tree, n => n.type === 'button' && text(n) === label)
const select = (tree, label) => one(one(tree, n => n.type === 'label' && text(n).startsWith(label)), n => n.type === 'select')
const change = (node, value) => node.props.onChange({ target: { value } })
const empty = { a: { id: 'synthetic-only' }, athleteLogs: [], athletePRHistory: [], athleteReadiness: [], athleteWeightLogs: [], exerciseLibrary: [], videoAnalyses: [], videoBaselines: [], weeks: [], videoLiftFilter: 'all', selectedAthlete: { id: 'synthetic', name: 'FOREIGN_SENTINEL' } }
const clean = node => {
  if (typeof node === 'function') return '[handler]'
  if (!node || typeof node !== 'object') return node
  if (Array.isArray(node)) return node.filter(x => x?.props?.['aria-label'] !== 'To videoer side om side').map(clean)
  return Object.fromEntries(Object.entries(node).map(([key, value]) => [key, clean(value)]))
}

test('default OFF, strict opt in and unchanged existing AnalyseTab tree and AI handler', () => {
  assert.equal(DEFAULT_ANALYSE_SAMMENLIGN, false)
  for (const query of ['', '?analyseSammenlign=0', '?analyseSammenlign=true', '?analyseSammenlign=1&analyseSammenlign=1', '?analyseSammenlign=0&analyseSammenlign=1']) assert.equal(analyseSammenlignEnabled(query), false)
  assert.equal(analyseSammenlignEnabled('?analyseSammenlign=1'), true)
  const prior = globalThis.window
  try {
    let calls = 0
    const props = { ...empty, setShowAiExport: () => calls++, setAiExportText() {} }
    delete globalThis.window
    const off = mount(AnalyseTab, props).render()
    assert.equal(nodes(off, n => n.props['aria-label'] === 'To videoer side om side').length, 0)
    button(off, 'AI Rapport').props.onClick()
    assert.equal(calls, 1)
    globalThis.window = { location: { search: '?analyseSammenlign=1' } }
    const on = mount(AnalyseTab, props).render()
    const panel = one(on, n => n.props['aria-label'] === 'To videoer side om side')
    assert.doesNotMatch(text(panel), /FOREIGN_SENTINEL|synthetic /)
    assert.deepEqual(clean(on), clean(off))
    globalThis.window.location.search = '?analyseSammenlign=0'
    assert.deepEqual(clean(mount(AnalyseTab, props).render()), clean(off))
    globalThis.window.location.search = '?analyseSammenlign=1&analyseSamlet=1'
    const both = mount(AnalyseTab, props).render()
    one(both, n => n.props['aria-label'] === 'Samlet analyseprototype')
    one(both, n => n.props['aria-label'] === 'To videoer side om side')
  } finally { if (prior === undefined) delete globalThis.window; else globalThis.window = prior }
})

test('actual handlers select two distinct clips of same lift and reset both on lift switch', () => {
  const app = mount(Compare)
  let tree = app.render()
  assert.equal(nodes(tree, n => n.type === 'svg').length, 2)
  const right = select(tree, 'Højre video')
  change(right, 'demo-squat-2')
  tree = app.render()
  assert.equal(nodes(tree, n => n.type === 'svg').length, 0)
  assert.equal(button(tree, 'Afspil begge').props.disabled, true)
  change(select(tree, 'Højre video'), 'demo-bench-1')
  assert.equal(select(app.render(), 'Højre video').props.value, 'demo-squat-2')
  change(select(tree, 'Højre video'), 'demo-squat-1')
  assert.equal(nodes(app.render(), n => n.type === 'svg').length, 2)
  change(select(app.render(), 'Løft til sammenligning'), 'bench')
  tree = app.render()
  assert.equal(button(tree, 'Afspil begge').props.disabled, true)
  assert.doesNotMatch(text(tree), /demo-squat|2026-10-16|2026-10-23/)
  change(select(tree, 'Løft til sammenligning'), 'deadlift')
  assert.equal(nodes(app.render(), n => n.type === 'svg').length, 0)
  change(select(app.render(), 'Løft til sammenligning'), 'squat')
  assert.equal(nodes(app.render(), n => n.type === 'svg').length, 2)
  app.dispose()
})

test('shared seek and marker handlers move both frames and display corresponding points', () => {
  const app = mount(Compare)
  button(app.render(), 'Venstre video: Bund 2 s').props.onClick()
  let tree = app.render()
  assert.deepEqual(nodes(tree, n => n.type === 'svg').map(n => n.props['data-time']), [2, 2])
  assert.deepEqual(nodes(tree, n => n.props['data-current-point']).map(n => n.props.cx), [48, 42])
  const slider = one(tree, n => n.type === 'input')
  change(slider, '3')
  tree = app.render()
  assert.deepEqual(nodes(tree, n => n.type === 'svg').map(n => n.props['data-time']), [3, 3])
  assert.deepEqual(nodes(tree, n => n.props['data-current-point']).map(n => n.props.cy), [47.5, 47.5])
  button(tree, 'Højre video: Slut 4 s').props.onClick()
  assert.equal(one(app.render(), n => n.type === 'input').props.value, 4)
  button(app.render(), 'Til start').props.onClick()
  assert.equal(one(app.render(), n => n.type === 'input').props.value, 0)
  app.dispose()
})

test('synthetic clock drives real component play, speed, pause, end and cleanup', () => {
  const originalSet = globalThis.setInterval, originalClear = globalThis.clearInterval
  const nowDescriptor = Object.getOwnPropertyDescriptor(performance, 'now')
  const timers = new Map(); let id = 0, now = 0
  globalThis.setInterval = callback => { timers.set(++id, callback); return id }
  globalThis.clearInterval = key => timers.delete(key)
  Object.defineProperty(performance, 'now', { configurable: true, value: () => now })
  const app = mount(Compare)
  const advance = seconds => { now += seconds * 1000; for (const cb of [...timers.values()]) cb(); return app.render() }
  try {
    button(app.render(), 'Afspil begge').props.onClick(); app.render()
    assert.equal(timers.size, 1)
    assert.deepEqual(nodes(advance(1), n => n.type === 'svg').map(n => n.props['data-time']), [1, 1])
    change(select(app.render(), 'Hastighed for begge'), '0.5')
    app.render()
    assert.equal(one(advance(2), n => n.type === 'input').props.value, 2)
    button(app.render(), 'Pause begge').props.onClick(); app.render()
    assert.equal(timers.size, 0)
    assert.equal(one(advance(2), n => n.type === 'input').props.value, 2)
    button(app.render(), 'Afspil begge').props.onClick(); app.render()
    const ended = advance(20)
    assert.equal(one(ended, n => n.type === 'input').props.value, 5)
    assert.equal(timers.size, 0)
    button(ended, 'Afspil begge').props.onClick(); app.render()
    assert.equal(one(app.render(), n => n.type === 'input').props.value, 0)
    change(select(app.render(), 'Venstre video'), 'demo-squat-1'); app.render()
    assert.equal(timers.size, 0)
    change(select(app.render(), 'Venstre video'), 'demo-squat-2'); app.render()
    button(app.render(), 'Afspil begge').props.onClick(); app.render()
    app.dispose()
    assert.equal(timers.size, 0)
  } finally {
    app.dispose(); globalThis.setInterval = originalSet; globalThis.clearInterval = originalClear
    if (nowDescriptor) Object.defineProperty(performance, 'now', nowDescriptor); else delete performance.now
  }
})

test('counterexamples: invalid numbers, bounds, different lifts and immutable fixtures', () => {
  const before = JSON.stringify(comparisonClips)
  let state = comparisonState()
  for (const value of [NaN, Infinity, -Infinity]) assert.equal(step(state, { type: 'seek', value }), state)
  for (const value of [0, -1, 2, NaN]) assert.equal(step(state, { type: 'rate', value }), state)
  assert.equal(step(state, { type: 'seek', value: -7 }).time, 0)
  assert.equal(step(state, { type: 'seek', value: 900 }).time, 5)
  assert.equal(step(state, { type: 'select', side: '__proto__', value: 'demo-squat-1' }), state)
  assert.equal(step(state, { type: 'select', side: 'left', value: 'demo-bench-1' }), state)
  assert.deepEqual(selectedPair({ ...state, right: 'demo-bench-1' }), [])
  state = step(state, { type: 'play' })
  for (const seconds of [NaN, Infinity, -1]) assert.equal(step(state, { type: 'tick', seconds }), state)
  assert.equal(step(state, { type: 'tick', seconds: 100 }).playing, false)
  assert.deepEqual(comparisonPoint(comparisonClips[0], 99), comparisonClips[0].points.at(-1))
  assert.throws(() => { comparisonClips[0].points[0].x = 99 }, TypeError)
  assert.equal(JSON.stringify(comparisonClips), before)
})

test('counterexample: all rendered interactions need no network, storage, files or real media', () => {
  const names = ['fetch', 'localStorage', 'sessionStorage', 'XMLHttpRequest', 'WebSocket']
  const descriptors = names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)])
  try {
    for (const name of names) Object.defineProperty(globalThis, name, { configurable: true, get() { throw Error('Forbidden: ' + name) } })
    const app = mount(Compare)
    const tree = app.render()
    assert.match(text(tree), /Syntetiske videospillere/)
    assert.equal(nodes(tree, n => ['video', 'iframe', 'a', 'form'].includes(n.type) || n.props.src || n.props.srcDoc).length, 0)
    for (const node of nodes(tree, n => n.type === 'button')) {
      assert.equal(node.props.type, 'button'); assert.ok(node.props.style.minHeight >= 44)
      if (!node.props.disabled) { node.props.onClick(); app.render() }
    }
    for (const lift of ['bench', 'deadlift', 'squat']) { change(select(app.render(), 'Løft til sammenligning'), lift); app.render() }
    app.dispose()
  } finally { for (const [name, descriptor] of descriptors) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name] } }
})
