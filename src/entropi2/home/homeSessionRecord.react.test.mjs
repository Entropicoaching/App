import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h, act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import HomeSession from './HomeSession.mjs'
import { sessionRecordFixture } from '../session/sessionRecordFixture.mjs'
import { sessionReactDocument } from '../session/sessionQuickSetReactDom.mjs'
import { calls } from '../session/sessionSaveBoundary.mjs'

// Required genuine React gate, discovered by the app's npm test. No substitute
// React runtime or skip is allowed when dependencies are absent in a public copy.
test('real HomeSession: actual confirmed writer receipt reaches the open pass and unmount clears subscriptions', async t => {
  const f = sessionRecordFixture(t), doc = sessionReactDocument(), host = doc.createElement('div')
  const createElement = doc.createElement
  doc.createElement = tag => {
    const node = createElement(tag)
    if (tag === 'select') Object.defineProperty(node, 'options', { get: () => node.children.filter(n => n.tagName === 'OPTION') })
    return node
  }
  doc.body.append(host)
  const replacements = { window: doc.defaultView, IS_REACT_ACT_ENVIRONMENT: true,
    setTimeout: f.clock.setTimeout, clearTimeout: f.clock.clearTimeout,
    setInterval() { return 1 }, clearInterval() {} }
  const originals = Object.fromEntries(Object.keys(replacements).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  for (const [key, value] of Object.entries(replacements)) Object.defineProperty(globalThis, key, { configurable: true, value })
  const root = createRoot(host)
  let historyReads = 0
  const readHomeRecordHistory = async () => {
    historyReads++
    return { status: 'ready', complete: true, athleteId: f.p.athlete.id, rows: [] }
  }
  let rerender
  function App() {
    const [, update] = useState(0)
    rerender = () => update(n => n + 1)
    f.onChange(rerender)
    return h(HomeSession, { ...f.p, readHomeRecordHistory })
  }
  try {
    await act(async () => root.render(h(App)))
    const start = host.querySelectorAll('button').find(b => b.textContent === 'Start dagens pas')
    assert.ok(start)
    await act(async () => {
      host.dispatch('click', { type: 'click', target: start, button: 0, bubbles: true, stopPropagation() {} })
      // Rebased onto the lazy bridge: wait for the actual renderer import and
      // its mounting continuation before asserting the open session.
      await import('../session/sessionView.mjs')
      await new Promise(resolve => setImmediate(resolve))
    })
    assert.ok(host.querySelector('dialog'))
    assert.equal(host.querySelector('[data-rekord-fejring]'), null)
    await act(async () => {
      host.querySelector('dialog').querySelector('form').dispatch('submit')
      await new Promise(resolve => setImmediate(resolve))
    })
    assert.equal(calls.filter(c => c.op === 'insert').length, 1)
    const receipt = host.querySelector('[data-rekord-fejring]')
    assert.ok(receipt); assert.match(receipt.textContent, /Squat · Sæt 1: Ny rekord/)
    assert.equal(receipt.getAttribute('role'), 'status')
    assert.equal(f.receipts.length, 1)
    assert.equal(historyReads, 1, 'sets reuse the existing loaded Home history')
    await act(async () => { f.p.exerciseLogs = []; f.p.rekordFejring = null; rerender() })
    assert.equal(host.querySelector('[data-rekord-fejring]'), null)
    await act(async () => { f.p.enabled = false; rerender() })
    assert.equal(host.querySelector('dialog'), null)
    assert.equal(f.timers.size, 0)
    await act(async () => f.save(2, 100))
    assert.equal(f.receipts.length, 1)
  } finally {
    await act(async () => root.unmount())
    assert.equal(f.timers.size, 0)
    for (const [key, value] of Object.entries(originals)) {
      if (value) Object.defineProperty(globalThis, key, value); else delete globalThis[key]
    }
  }
})
