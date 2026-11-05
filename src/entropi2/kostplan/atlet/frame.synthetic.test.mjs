// Actual frame module, explicit synthetic hook storage. Structural assertions
// supplement the mandatory real-React SSR and reconciliation tests beside it.
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'

let owner
const createElement = (type, props, ...children) => ({ type, props: { ...props, children } })
globalThis.__syntheticDayFrame = { createElement,
  useRef(initial) { return owner.ref ||= { current: initial } },
  useSyncExternalStore(_subscribe, snapshot) { return snapshot() } }
const targets = ['./KostDayFrame.mjs', './KostplanAtlet.mjs'].map(path => new URL(path, import.meta.url).href)
const hook = registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'react' && targets.includes(context.parentURL)) return {
    url: 'data:text/javascript,' + encodeURIComponent('export const { createElement, useRef, useSyncExternalStore } = globalThis.__syntheticDayFrame'), shortCircuit: true }
  return next(specifier, context)
} })
let Frame, View
try {
  ;({ default: Frame } = await import('./KostDayFrame.mjs'))
  ;({ KostplanAtletView: View } = await import('./KostplanAtlet.mjs'))
} finally { hook.deregister(); delete globalThis.__syntheticDayFrame }

const tracker = createElement('div', { 'data-frame-tracker': '' })
const nodes = n => !n || typeof n !== 'object' ? [] : [n, ...n.props.children.flat(Infinity).flatMap(nodes)]
function fixture(initial) {
  let value = initial, calls = 0
  const refs = {}, controller = { subscribe: () => () => {}, snapshot: () => value, load() { calls++ } }
  return { controller, set(next) { value = next }, get calls() { return calls },
    render(next = controller) { owner = refs; try { return Frame({ controller: next, tracker }) } finally { owner = null } } }
}
const fold = tree => nodes(tree).find(n => n.type === 'details')
const planView = tree => nodes(tree).find(n => n.type === View)
const ready = () => ({ mode: 'plan', phase: 'ready', meals: [{ id: 'synthetic-meal', canSave: true }] })

test('frame: idle, loading, no plan and unknown first-load error contain the direct tracker and no disclosure/plan view', () => {
  const f = fixture()
  for (const state of [undefined, { phase: 'idle' }, { phase: 'loading' }, { mode: 'tracker', phase: 'ready' },
    { mode: null, phase: 'load-error', message: 'Dagens kost kunne ikke hentes. Prøv igen.' }]) {
    f.set(state)
    const tree = state ? f.render() : f.render(null)
    assert.equal(fold(tree), undefined)
    assert.equal(planView(tree), undefined)
    assert.equal(tree.props.children[1], tracker)
  }
  assert.equal(f.calls, 0)
})

test('frame: only a verified plan gets a collapsed, visible summary and its tracker', () => {
  const f = fixture(ready()), tree = f.render(), details = fold(tree)
  assert.ok(planView(tree))
  assert.equal(details.props.open, undefined)
  const [summary, content] = details.props.children
  assert.equal(summary.type, 'summary'); assert.equal(summary.props.hidden, undefined)
  assert.equal(summary.props.children[0], 'Kostlog og vejning')
  assert.equal(content, tracker)
})

test('frame: known plan survives refresh disabled and exposes a retry after failure, then clears on no-plan or scope change', () => {
  const original = ready(), f = fixture(original)
  f.render(); f.set({ phase: 'loading', mode: null })
  let tree = f.render(), view = planView(tree)
  assert.ok(fold(tree)); assert.equal(view.props.snapshot.pending, true)
  assert.equal(view.props.snapshot.meals[0].canSave, false)
  assert.equal(original.meals[0].canSave, true)
  f.set({ phase: 'load-error', mode: null, message: 'synthetic failure' })
  view = planView(f.render())
  assert.equal(view.props.snapshot.phase, 'load-error')
  assert.equal(view.props.snapshot.message, 'synthetic failure')
  view.props.onRetry(); assert.equal(f.calls, 1)
  const other = { ...f.controller, snapshot: () => ({ phase: 'load-error', mode: null }) }
  assert.equal(planView(f.render(other)), undefined)
  f.set(original); f.render()
  f.set({ phase: 'ready', mode: 'tracker' }); assert.equal(fold(f.render()), undefined)
  f.set({ phase: 'load-error', mode: null }); assert.equal(planView(f.render()), undefined)
})
