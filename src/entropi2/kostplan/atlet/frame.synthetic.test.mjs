// Actual frame module, explicit synthetic hook storage. Structural assertions
// supplement the mandatory real-React SSR and reconciliation tests beside it.
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'

let owner
const createElement = (type, props, ...children) => ({ type, props: { ...props, children } })
globalThis.__syntheticDayFrame = { createElement,
  useState(initial) { return [owner.selection ?? initial, value => { owner.selection = value }] },
  useRef(initial) { return owner.ref ||= { current: initial } },
  useSyncExternalStore(_subscribe, snapshot) { return snapshot() } }
const targets = ['./KostDayFrame.mjs', './KostplanAtlet.mjs'].map(path => new URL(path, import.meta.url).href)
const hook = registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'react' && targets.includes(context.parentURL)) return {
    url: 'data:text/javascript,' + encodeURIComponent('export const { createElement, useRef, useState, useSyncExternalStore } = globalThis.__syntheticDayFrame'), shortCircuit: true }
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

test('frame: loading, empty and failed reads have distinct status above the same open diary', () => {
  const f = fixture()
  for (const state of [{ phase: 'idle' }, { phase: 'loading' }, { mode: 'tracker', phase: 'ready' },
    { mode: null, phase: 'load-error' }]) {
    f.set(state)
    const tree = f.render(), details = fold(tree)
    assert.equal(details.props.open, true)
    assert.equal(details.props.children[1], tracker)
    assert.equal(planView(tree), undefined)
    assert.ok(nodes(tree).includes(tracker))
    assert.equal(tree.props.children[2].props.hidden, false)
    const buttons = nodes(tree).filter(n => n.type === 'button')
    assert.equal(buttons.length, ['idle', 'loading'].includes(state.phase) ? 0 : 1)
    if (buttons.length) { buttons[0].props.onClick(); assert.ok(f.calls) }
  }
})

test('frame: verified plan uses the real meal view above the same open diary', () => {
  const f = fixture(ready()), tree = f.render(), details = fold(tree)
  assert.ok(planView(tree))
  assert.equal(details.props.open, true)
  const [summary, content] = details.props.children
  assert.equal(summary.type, 'summary'); assert.equal(summary.props.hidden, undefined)
  assert.equal(summary.props.children[0], 'Kostlog og vejning')
  assert.equal(content, tracker)
})

test('frame: refreshing/error never exposes stale plan actions; a current ready read restores them', () => {
  const f = fixture(ready())
  assert.ok(planView(f.render()))
  for (const phase of ['loading', 'load-error']) {
    f.set({ phase, mode: null })
    assert.equal(planView(f.render()), undefined)
    assert.ok(fold(f.render()))
  }
  f.set(ready()); assert.ok(planView(f.render()))
  f.set({ phase: 'ready', mode: 'tracker' }); assert.equal(planView(f.render()), undefined)
})
