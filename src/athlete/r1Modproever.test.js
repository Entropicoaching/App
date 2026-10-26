import test from 'node:test'
import assert from 'node:assert/strict'
import { readinessNavigation, openReadinessSurface } from './readinessShortcut.mjs'
import { previewNavigation, renderNav, renderTrainingLinks } from './enkelPrototype.mjs'

// Syntetisk DOM: behold de faktiske renderfunktioners knapper og handlers.
const h = (tag, props, ...children) => ({ tag, props, children })
const buttons = node => [node, ...node.children.flatMap(child =>
  child && typeof child === 'object' ? buttons(child) : [])].filter(x => x.tag === 'button')

test('R1: faktiske navigationsknapper lukker genvejen og bevarer formularen', () => {
  for (const enabled of [false, true]) {
    const draft = Object.freeze({ sleep: '7,5', note: 'syntetisk' })
    const state = { open: true, draft, tab: 'hjem', route: 'traening' }
    const calls = []
    const go = readinessNavigation(previewNavigation(enabled,
      tab => { calls.push('tab'); state.tab = tab }, route => state.route = route),
      open => { calls.push('open'); state.open = open })
    const tree = renderNav(h, { route: 'traening', go })
    for (const button of buttons(tree)) {
      state.open = true; calls.length = 0
      button.props.onClick()
      assert.equal(state.open, false)
      assert.deepEqual(calls, ['open', 'tab'])
      assert.strictEqual(state.draft, draft)
    }
  }
})

test('R1: kontaktgenvej binder faktisk teknikspor og lukker parathed', () => {
  let open = true, track, tab, route
  const go = readinessNavigation(previewNavigation(true, x => tab = x, x => route = x), x => open = x)
  const tree = renderTrainingLinks(h, { messages: [],
    sharedVideoAnalyses: [{ shared_at: '2026-10-26' }], go, setMsgTrack: x => track = x })
  buttons(tree).at(-1).props.onClick()
  assert.deepEqual({ open, track, tab, route }, { open: false, track: 'teknik', tab: 'beskeder', route: 'kontakt' })
})

test('R1: afmontering mellem animationsframes giver ingen fokus eller scroll', () => {
  const frames = [], calls = []
  const ref = { current: { focus: () => calls.push('focus'), scrollIntoView: () => calls.push('scroll') } }
  openReadinessSurface({ setTab() {}, setMereOpen() {}, setReadinessOpen() {},
    readinessCardRef: ref, requestFrame: cb => frames.push(cb) })
  frames.shift()()
  ref.current = null
  frames.shift()()
  assert.deepEqual(calls, [])
  assert.equal(frames.length, 0)
})
