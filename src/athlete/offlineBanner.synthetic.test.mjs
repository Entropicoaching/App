// Actual copied component + actual offlineSession, with a synthetic hook/event host.
// These checks supplement, and never substitute for, offlineBanner.react.test.mjs.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { installOfflineBannerLoader } from './offlineBannerLoader.mjs'
import { mount } from './trainingFullscreenFake.mjs'
import { markNetworkFailure, markNetworkSuccess } from '../offlineSession.js'
import { createSessionController } from '../entropi2/session/sessionModel.mjs'

installOfflineBannerLoader({ synthetic: true })
const { default: Banner } = await import('./IngenForbindelse.jsx')
const snapshot = '2026-11-05T07:00:00Z'
const text = tree => tree == null ? '' : typeof tree === 'object' ? tree.children.map(text).join('') : String(tree)

function host(t, online) {
  const listeners = new Map(), descriptors = new Map(), views = []
  for (const [key, value] of [['navigator', { onLine: online }], ['window', {
    addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn) },
    removeEventListener(type, fn) { listeners.get(type)?.delete(fn) },
  }], ['localStorage', { getItem() { assert.fail('banner read storage') }, setItem() { assert.fail('banner wrote storage') } }]]) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key)
    descriptors.set(key, descriptor)
    Object.defineProperty(globalThis, key, { configurable: true, value })
  }
  markNetworkSuccess()
  t.after(() => {
    for (const view of views) view.unmount()
    markNetworkSuccess()
    for (const [key, descriptor] of descriptors)
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
  })
  return { listeners, mount(props) { const view = mount(Banner, props); views.push(view); return view },
    fire(type) { for (const fn of listeners.get(type) || []) fn() } }
}

test('actual banner distinguishes cached program from open-session offline sets', t => {
  const f = host(t, false)
  const view = f.mount({ entropi2: true, offlineSnapshotAt: snapshot })
  assert.equal(view.tree.props.role, 'status')
  assert.equal(view.tree.props['data-ingen-forbindelse'], 'offline')
  assert.match(text(view.tree), /Gå på net og opdatér programmet, før du starter et pas\./)
  assert.doesNotMatch(text(view.tree), /Dagens pas og dine sæt virker|gemme sæt lokalt/)
  assert.match(text(view.tree), /Program fra kl\./)
  view.render({ offlineSnapshotAt: null })
  assert.match(text(view.tree), /I et åbent pas kan du gemme sæt lokalt\. De sendes, når du har net\./)
  assert.doesNotMatch(text(view.tree), /Program fra kl\./)
})

test('connection events keep snapshot warning until fresh data, then hide and clean listeners', t => {
  const f = host(t, true), view = f.mount({ entropi2: true, offlineSnapshotAt: snapshot })
  assert.equal(view.tree.props['data-ingen-forbindelse'], 'oejebliksbillede')
  assert.match(text(view.tree), /Forbindelsen er svag\./)
  markNetworkFailure(); f.fire('entropi:forbindelse'); view.render()
  assert.equal(view.tree.props['data-ingen-forbindelse'], 'offline')
  markNetworkSuccess(); f.fire('entropi:forbindelse'); view.render()
  assert.match(text(view.tree), /Gå på net og opdatér/)
  view.render({ offlineSnapshotAt: null }); assert.equal(view.tree, null)
  globalThis.navigator.onLine = false; f.fire('offline'); view.render()
  assert.match(text(view.tree), /I et åbent pas/)
  globalThis.navigator.onLine = true; f.fire('online'); view.render()
  assert.equal(view.tree, null)
  view.unmount(); assert.ok([...f.listeners.values()].every(set => set.size === 0))
})

test('strict OFF keeps the original message for every non-true flag', t => {
  const f = host(t, false)
  for (const entropi2 of [undefined, false, null, 0, 1, 'true']) {
    const view = f.mount({ entropi2, offlineSnapshotAt: snapshot })
    assert.match(text(view.tree), /Dagens pas og dine sæt virker; resten opdateres, når du har net\./)
    assert.doesNotMatch(text(view.tree), /Du ser et gemt program|I et åbent pas/)
    view.unmount()
  }
})

test('banner warning agrees with actual session gate; wiring is explicit and snapshot blocks writes', () => {
  const source = readFileSync(new URL('../AthleteView.jsx', import.meta.url), 'utf8')
  assert.equal(source.split('<IngenForbindelse {...{ offlineSnapshotAt }} entropi2={e2} />').length, 2)
  const week = { id: 'synthetic-w', athlete_id: 'synthetic-a', sessions: [{ id: 'synthetic-s',
    exercises: [{ id: 'synthetic-e', name: 'Syntetisk løft', sets: 1, reps: 5, recommended_weight: 20 }] }] }
  const p = { enabled: true, athleteId: 'synthetic-a', allWeeks: [week], currentWeek: week,
    exerciseLogs: [], offlineSnapshotAt: snapshot, onLogSet() { assert.fail('snapshot attempted write') } }
  const controller = createSessionController(() => p)
  assert.equal(controller.state().canStart, false); assert.equal(controller.start(), false)
  p.offlineSnapshotAt = null
  assert.equal(controller.start(), true)
  p.offlineSnapshotAt = snapshot; controller.refresh()
  assert.equal(controller.state().open, false)
})
