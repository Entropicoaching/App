import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h, act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import SessionScreen from './SessionScreen.mjs'
import { sessionReactDocument } from './sessionQuickSetReactDom.mjs'
import { quickSetFixture } from './sessionQuickSetFixture.mjs'

// Required real React gate; a missing dependency fails visibly rather than skipping.
test('real React SessionScreen: one submit, prop refresh, next defaults/focus, OFF and unmount', async () => {
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
  const press = async label => {
    const b = host.querySelectorAll('button').find(n => n.textContent === label)
    assert.ok(b, label); assert.equal(b.disabled, false)
    await act(async () => b.click())
  }
  const submit = async label => {
    const b = host.querySelectorAll('button').find(n => n.textContent === label)
    assert.ok(b, label); assert.equal(b.getAttribute('type'), 'submit')
    await act(async () => { b.parentElement.dispatch('submit'); await Promise.resolve(); rerender() })
  }
  try {
    await act(async () => root.render(h(App)))
    await press('Start dagens pas')
    assert.equal(f.calls.length, 0)
    const plan = host.querySelectorAll('section').find(n => n.getAttribute('aria-label') === 'Planlagt belastning')
    assert.equal(plan.querySelectorAll('.plan').length, 1)
    assert.equal(plan.querySelector('.plan').textContent, '5 gentagelser · 80 kg')
    assert.ok(plan.matches('.plan-card'))
    assert.ok(host.querySelector('form').matches('.registration-card'))
    await press('+2,5')
    assert.equal(host.querySelector('[data-field="weight"]').value, '82,5')
    const write = f.p.onLogSet
    let release
    f.p.onLogSet = (...args) => new Promise(resolve => { release = () => resolve(write(...args)) })
    await act(async () => rerender())
    await submit('Godkendt')
    assert.equal(f.calls.length, 0)
    for (const field of host.querySelector('form').querySelectorAll('button,input,textarea,fieldset'))
      assert.equal(field.disabled, true)
    assert.match(host.querySelector('[data-announce]').textContent, /Gemmer sættet. Vent på svar/)
    assert.ok(host.querySelectorAll('button').find(n => n.textContent === 'Afventer svar').disabled)
    await act(async () => { release(); await Promise.resolve(); rerender() })
    f.p.onLogSet = write
    await act(async () => rerender())
    assert.equal(f.calls.length, 1)
    assert.equal(host.querySelector('[data-field="weight"]').value, '82,5')
    assert.equal(host.querySelector('[data-field="reps"]').value, '5')
    assert.equal(host.querySelector('[data-field="rpe"]').value, '')
    assert.equal(doc.activeElement, host.querySelector('[data-heading]'))
    assert.match(host.textContent, /Sæt 2 af 3/); assert.equal(timers.size, 1)
    await submit('Som sidste sæt'); assert.equal(f.calls.length, 2)
    assert.match(host.textContent, /Sæt 3 af 3/)
    await act(async () => { f.p.enabled = false; rerender() })
    assert.equal(host.querySelector('dialog'), null); assert.equal(timers.size, 0)
    assert.equal(f.calls.length, 2)
  } finally {
    await act(async () => root.unmount())
    assert.equal(timers.size, 0); assert.equal(host.children.length, 0)
    for (const [key, value] of Object.entries(original)) {
      if (value) Object.defineProperty(globalThis, key, value); else delete globalThis[key]
    }
  }
})
