// Actual entry/effects/DOM tracker and adapters, with explicitly synthetic hooks.
// This is NOT a React reconciliation test; integration.react.test.mjs uses React.
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { syntheticHost, find } from '../../nutrition/synthetic-dom.mjs'
import { fixture, athleteId, date, flush } from './daySession.fixture.mjs'
import { createElement, text } from '../coach/portal.fixture.mjs'

let current
const react = {
  createElement,
  useRef(value) {
    const owner = current, index = owner.cursor++
    return owner.values[index] ||= { current: value }
  },
  useState(initial) {
    const owner = current, index = owner.cursor++
    if (!(index in owner.values)) owner.values[index] = initial
    return [owner.values[index], value => { owner.values[index] = value }]
  },
  useEffect(effect, deps) {
    const owner = current, index = owner.cursor++, before = owner.effects[index]
    if (!deps || !before || deps.some((value, i) => value !== before.deps?.[i])) {
      owner.effects[index] = { deps, effect, cleanup: before?.cleanup }
      owner.pending.add(index)
    }
  },
  useSyncExternalStore(_subscribe, snapshot) { return snapshot() },
}
globalThis.__syntheticKostEntry = react
const targets = ['../../Entropi2Kost.mjs', './KostDayFrame.mjs', './KostplanAtlet.mjs'].map(name => new URL(name, import.meta.url).href)
const hook = registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'react' && targets.includes(context.parentURL)) return {
    url: 'data:text/javascript,' + encodeURIComponent('export const { createElement, useRef, useState, useEffect, useSyncExternalStore } = globalThis.__syntheticKostEntry'), shortCircuit: true,
  }
  return next(specifier, context)
} })
let Entry, Frame, View, TrackerHost
try {
  ;({ default: Entry, KostTrackerHost: TrackerHost } = await import('../../Entropi2Kost.mjs'))
  ;({ default: Frame } = await import('./KostDayFrame.mjs'))
  ;({ KostplanAtletView: View } = await import('./KostplanAtlet.mjs'))
} finally { hook.deregister(); delete globalThis.__syntheticKostEntry }

const owner = () => ({ values: [], effects: [], pending: new Set(), cursor: 0 })
function render(state, component, props) {
  current = state; state.cursor = 0
  try { return component(props) } finally { current = null }
}
function commit(state) {
  for (const index of state.pending) {
    const effect = state.effects[index]; effect.cleanup?.(); effect.cleanup = effect.effect()
  }
  state.pending.clear()
}
function unmount(state) { for (const effect of state.effects) effect?.cleanup?.() }
const nodes = node => !node || typeof node !== 'object' ? [] : [node, ...[node.props.children].flat(Infinity).flatMap(nodes)]
function mount(f, extra = {}) {
  const entry = owner(), frame = owner()
  let tracker = owner(), host = syntheticHost(), inFold = false, controller
  let props = { enabled: true, athlete: { id: athleteId, kcal_target: 2000, protein_target: 150 }, date, client: f.client, foods: [], ...extra }
  return {
    get host() { return host },
    get controller() { return controller },
    render(next = {}) {
      props = { ...props, ...next }
      let tree = render(entry, Entry, props)
      commit(entry)
      if (!tree) { unmount(tracker); return null }
      // Apply the parent's session update, then explicitly model the child
      // unmount/mount when its native parent changes. This is synthetic lifecycle
      // coverage; the separate ReactDOM test verifies actual reconciliation.
      tree = render(entry, Entry, props); commit(entry)
      controller = tree.props.controller
      const result = render(frame, Frame, tree.props)
      const folded = nodes(result).some(n => n.type === 'details' && n.props.children?.includes(tree.props.tracker))
      if (folded !== inFold) { unmount(tracker); tracker = owner(); host = syntheticHost(); inFold = folded }
      const mounted = render(tracker, TrackerHost, tree.props.tracker.props)
      mounted.props.ref.current = host; commit(tracker)
      const expand = node => !node || typeof node !== 'object' ? node : node.type === View ? View(node.props)
        : node.type === TrackerHost ? mounted
          : { ...node, props: { ...node.props, children: [node.props.children].flat(Infinity).map(expand) } }
      return expand(result)
    },
    unmount() { unmount(tracker); unmount(entry); unmount(frame) },
  }
}

test('entry actual effects: missing/no plan keeps tracker and forwarded weight retry', async t => {
  for (const missing of [true, false]) {
    const f = fixture(missing ? { missing: true } : {}), calls = []
    const screen = mount(f, { weightLogs: [], weightStatus: { athleteId, state: 'error' }, retryWeight: () => calls.push('old') })
    t.after(screen.unmount); screen.render(); await flush()
    const tree = screen.render()
    assert.doesNotMatch(text(tree), /Dagens kostplan|Plan fra din coach/)
    assert.equal(nodes(tree).filter(n => n.type === 'details' || n.type === 'summary').length, 2)
    assert.ok(find(screen.host, 'h2', 'Log hurtigt'))
    screen.render({ retryWeight: () => calls.push('latest') })
    const weight = screen.host.querySelectorAll('section').find(n => n.textContent.startsWith('Din vægt'))
    await weight.querySelectorAll('button').find(n => n.textContent === 'Hent igen').fire('click')
    assert.deepEqual(calls, ['latest'])
    assert.equal(f.plan.calls.filter(c => c.limit === 0).length, missing ? 1 : 3)
    screen.unmount(); assert.equal(screen.host.textContent, '')
  }
})

test('entry actual effects: approved plan, one tap, stable tracker host, no duplicate ActivePlan', async t => {
  const f = fixture(); f.approve()
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: f.storage })
  t.after(() => { if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage); else delete globalThis.localStorage })
  const screen = mount(f); t.after(screen.unmount)
  screen.render(); await flush()
  let tree = screen.render()
  assert.match(text(tree), /Dagens kostplan.*Tilbage i dag: 500 kcal · 50 g protein/)
  assert.doesNotMatch(text(tree), /Plan fra din coach/)
  const trackerHost = screen.host
  const details = nodes(tree).find(n => n.type === 'details' && n.props.children?.[0]?.type === 'summary' && text(n.props.children[0]) === 'Kostlog og vejning')
  assert.equal(details.props.open, true)
  assert.equal(details.props.children[1].props.ref.current, trackerHost)
  await nodes(tree).find(n => n.type === 'button' && n.props['aria-label'] === 'Frokost <syntetisk>: Spist som planlagt').props.onClick()
  await flush(); tree = screen.render()
  assert.match(text(tree), /1 af 2 måltider spist.*Tilbage i dag: 300 kcal · 30 g protein/)
  assert.equal(f.rows.length, 1); assert.equal(f.plan.writes().length, 0)
  assert.match(screen.host.textContent, /Frokost <syntetisk>/)
  assert.doesNotMatch(screen.host.textContent, /Ingen måltider registreret i dag/)
  assert.equal(screen.host, trackerHost)
  // Another athlete is hidden immediately, before its pending load settles.
  assert.doesNotMatch(text(screen.render({ athlete: { id: 'synthetic-other' } })), /Frokost <syntetisk>/)
  await flush(); assert.doesNotMatch(text(screen.render()), /Frokost <syntetisk>/)
})

test('entry actual effects: OFF and cleanup perform no delayed plan/diary writes', async () => {
  const f = fixture(), screen = mount(f, { enabled: false })
  assert.equal(screen.render(), null); await flush()
  assert.equal(f.plan.calls.length, 0); assert.equal(f.calls.length, 0)
  screen.unmount()
  let release
  const held = new Promise(resolve => { release = resolve })
  const late = fixture({ before: () => held }); late.approve()
  const cancelled = mount(late); cancelled.render(); cancelled.unmount(); release(); await flush()
  assert.equal(cancelled.host.textContent, '')
  assert.equal(late.plan.writes().length, 0); assert.equal(late.writes.length, 0)
})

test('entry actual effects: uncertain insert refreshes the real tracker and never offers a blind duplicate', async t => {
  const f = fixture({ lostInsert: true }); f.approve()
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: f.storage })
  t.after(() => { if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage); else delete globalThis.localStorage })
  const screen = mount(f); t.after(screen.unmount); screen.render(); await flush()
  let tree = screen.render()
  const action = nodes(tree).find(n => n.type === 'button' && n.props['aria-label'] === 'Frokost <syntetisk>: Spist som planlagt')
  await action.props.onClick(); await flush(); tree = screen.render()
  assert.match(text(tree), /Gemningen kunne ikke bekræftes/)
  assert.match(screen.host.textContent, /Frokost <syntetisk>/)
  await nodes(tree).find(n => n.type === 'button' && text(n) === 'Hent dagen igen').props.onClick()
  tree = screen.render()
  assert.match(text(tree), /Registreringen er uafklaret/)
  assert.equal(nodes(tree).find(n => n.type === 'button' && n.props['aria-label'] === 'Frokost <syntetisk>: Spist som planlagt').props.disabled, true)
  await action.props.onClick(); assert.equal(f.rows.length, 1)
})


test('entry fallback: first-load plan/probe errors expose a retry above the usable tracker', async t => {
  for (const options of [{ error: '42501' }, { error: 'XX000' }, { before() { throw Error('synthetic offline') } }]) {
    const f = fixture(options), screen = mount(f); t.after(screen.unmount)
    screen.render(); await flush()
    const tree = screen.render()
    assert.equal(screen.controller.snapshot().phase, 'load-error')
    assert.match(text(tree), /Kostplanen kunne ikke hentes.*Hent kostplan igen/)
    assert.doesNotMatch(text(tree), /Du har ingen aktiv kostplan/)
    assert.equal(nodes(tree).filter(n => n.props.role === 'alert').length, 1)
    assert.ok(find(screen.host, 'h2', 'Log hurtigt'))
    assert.equal(f.rows.length, 0); assert.equal(f.plan.writes().length, 0); assert.deepEqual(f.writes, [])
  }
})

test('entry fallback: offline first entry recovers after reopening with the same client', async t => {
  let offline = true
  const f = fixture({ before() { if (offline) throw Error('synthetic offline') } }); f.approve()
  const first = mount(f); first.render(); await flush(); first.render()
  assert.equal(first.controller.snapshot().phase, 'load-error'); first.unmount()
  offline = false
  const second = mount(f); t.after(second.unmount)
  second.render(); await flush()
  assert.match(text(second.render()), /Dagens kostplan/)
  await flush()
  assert.ok(find(second.host, 'h2', 'Log hurtigt'))
  assert.equal(f.rows.length, 0); assert.equal(f.plan.writes().length, 0); assert.deepEqual(f.writes, [])
})

test('entry fallback: known-plan failure stays retryable; removing the plan preserves its working tracker host', async t => {
  const options = {}, f = fixture(options); f.approve()
  const screen = mount(f); t.after(screen.unmount)
  screen.render(); await flush(); screen.render()
  const controller = screen.controller, plannedHost = screen.host
  options.error = 'XX000'
  await controller.load()
  let tree = screen.render()
  assert.match(text(tree), /Kostplanen kunne ikke hentes.*Hent kostplan igen/)
  assert.equal(screen.host, plannedHost)
  assert.equal(nodes(tree).filter(n => n.props.role === 'alert').length, 1)
  delete options.error
  await nodes(tree).find(n => n.type === 'button' && text(n) === 'Hent kostplan igen').props.onClick()
  assert.match(text(screen.render()), /Dagens kostplan/)
  f.plan.data.kostplan_v1_plans.length = 0
  await controller.load(); tree = screen.render(); await flush()
  assert.equal(screen.controller, controller)
  assert.equal(screen.host, plannedHost)
  assert.ok(find(screen.host, 'h2', 'Log hurtigt'))
  assert.equal(nodes(tree).filter(n => n.type === 'details' || n.type === 'summary').length, 2)
  assert.equal(f.rows.length, 0); assert.equal(f.plan.writes().length, 0); assert.deepEqual(f.writes, [])
})


test('entry lifecycle: a late plan preserves the same imperative tracker and unfinished manual input', async t => {
  let release
  const gate = new Promise(resolve => { release = resolve })
  const f = fixture({ before: () => gate }); f.approve()
  const screen = mount(f); t.after(() => { release(); screen.unmount() })
  screen.render(); await flush()
  const direct = screen.host, content = direct.children[0], controller = screen.controller
  const input = direct.querySelectorAll('input').find(n => n.getAttribute('data-focus') === 'field-Måltid')
  assert.ok(input); input.value = 'Syntetisk kladde'; await input.fire('input')
  release(); await flush(); screen.render()
  assert.equal(screen.host, direct)
  assert.equal(screen.host.children[0], content)
  assert.equal(screen.controller, controller)
  assert.equal(screen.host.querySelectorAll('input').find(n => n.getAttribute('data-focus') === 'field-Måltid').value, 'Syntetisk kladde')
  assert.equal(f.plan.calls.filter(c => c.limit === 0).length, 3)
  assert.equal(f.rows.length, 0); assert.equal(f.plan.writes().length, 0); assert.deepEqual(f.writes, [])
})
