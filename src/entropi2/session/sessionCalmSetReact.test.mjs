import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h, act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import SessionScreen from './SessionScreen.mjs'
import { sessionReactDocument } from './sessionQuickSetReactDom.mjs'
import { quickSetFixture } from './sessionQuickSetFixture.mjs'

// Run with the app's real React dependencies; missing React is a failure, never a skip.
test('real React prop refresh preserves step/RPE focus, optional RPE and confirmed receipt lifecycle', async () => {
  const doc = sessionReactDocument(), host = doc.createElement('div'), f = quickSetFixture(), timers = new Set()
  doc.body.append(host)
  const replacements = { window: doc.defaultView, IS_REACT_ACT_ENVIRONMENT: true,
    setInterval(fn) { timers.add(fn); return fn }, clearInterval(fn) { timers.delete(fn) } }
  const original = Object.fromEntries(Object.keys(replacements).map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]))
  for (const [key, value] of Object.entries(replacements)) Object.defineProperty(globalThis, key, { configurable: true, value })
  const root = createRoot(host)
  let rerender
  function App() {
    const [, update] = useState(0)
    rerender = () => update(n => n + 1)
    return h(SessionScreen, { ...f.p, setLogInputs(fn) { f.p.logInputs = fn(f.p.logInputs); rerender() } })
  }
  const fold = () => host.querySelector('[data-detail="rpe"]')
  const step = id => host.querySelector(`[data-step="${id}"]`)
  try {
    await act(async () => root.render(h(App)))
    await act(async () => host.querySelector('button').click())
    assert.equal(fold().open, false)
    for (const id of ['weight-up', 'weight-down', 'reps-up', 'reps-down', 'rpe-8.5', 'rpe-8.5']) {
      if (id.startsWith('rpe-')) fold().open = true
      await act(async () => { step(id).focus(); step(id).click() })
      assert.ok(doc.activeElement === step(id), id)
    }
    assert.equal(host.querySelector('[data-field="rpe"]').value, '')
    assert.equal(fold().open, true)
    const write = f.p.onLogSet
    f.p.onLogSet = (...args) => {
      const result = write(...args)
      f.p.rekordFejring = { key: 'quick-a_1', id: 'quick-a_1:80:5', tekst: 'Ny rekord' }
      return result
    }
    await act(async () => rerender())
    await act(async () => { host.querySelector('form').dispatch('submit'); await Promise.resolve(); rerender() })
    assert.equal(f.calls.length, 1); assert.equal(f.calls[0].input.rpe, '')
    assert.equal(f.calls[0].input.rpe_source, null)
    assert.ok(doc.activeElement === host.querySelector('[data-heading]'))
    assert.equal(fold().open, false)
    assert.equal(host.querySelectorAll('[data-rekord-fejring]').length, 1)
    await act(async () => { step('weight-up').focus(); f.p.rekordFejring = null; rerender() })
    assert.equal(host.querySelectorAll('[data-rekord-fejring]').length, 0)
    assert.ok(doc.activeElement === step('weight-up'))
    await act(async () => { f.p.enabled = false; rerender() })
    assert.equal(host.querySelector('dialog'), null); assert.equal(timers.size, 0)
  } finally {
    await act(async () => root.unmount())
    assert.equal(timers.size, 0); assert.equal(host.children.length, 0)
    for (const [key, value] of Object.entries(original)) {
      if (value) Object.defineProperty(globalThis, key, value); else delete globalThis[key]
    }
  }
})
