import test from 'node:test'
import assert from 'node:assert/strict'
import { act, createElement, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Conversation from './Conversation.mjs'
import { fixture, find, row } from './accessibilityFixture.mjs'

// Actual React/ReactDOM and actual Conversation effect/controller/view.
// No React loader or substitute. Host models events/focus, not browser layout.
test('React F2/F7: StrictMode mount, reduced-motion jump, acknowledgement focus and explicit OFF cleanup', async () => {
  const f = fixture({ reduced: true }), ref = { current: null }
  const previousWindow = globalThis.window, previousAct = globalThis.IS_REACT_ACT_ENVIRONMENT
  globalThis.window = f.win; globalThis.IS_REACT_ACT_ENVIRONMENT = true
  const root = createRoot(f.host)
  try {
    await act(async () => root.render(createElement(StrictMode, null,
      createElement(Conversation, { enabled: true, createController: f.createController, controllerRef: ref }))))
    const jump = find(f.host, 'button').find(n => n.textContent.includes('Spring til første ulæste'))
    await act(async () => { await jump.click() })
    assert.equal(f.doc.scrolled.options.behavior, 'instant')
    assert.equal(f.doc.activeElement, row(f.host, 'message:one').children[0])
    await act(async () => { await f.doc.activeElement.click() })
    assert.equal(f.doc.activeElement, row(f.host, 'message:one').children[0])
    assert.equal(row(f.host, 'message:one').children[1].hidden, false)
    assert.equal(find(f.host, 'li')[0].dataset.key, 'message:two')
    assert.deepEqual(f.calls, ['message:one'])
    await act(async () => root.render(createElement(Conversation, { enabled: false,
      createController: () => assert.fail('OFF controller access'), controllerRef: ref })))
    assert.equal(ref.current, null); assert.equal(f.host.children.length, 0)
  } finally {
    await act(async () => root.unmount())
    if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow
    if (previousAct === undefined) delete globalThis.IS_REACT_ACT_ENVIRONMENT; else globalThis.IS_REACT_ACT_ENVIRONMENT = previousAct
  }
})
