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
    const input = find(f.host, 'textarea')[0]
    await act(async () => ref.current.draft('Syntetisk React-kladde'))
    const write = find(f.host, 'button').find(n => n.textContent === 'Skriv til din coach')
    assert.equal(write.style.minHeight, '44px')
    await act(async () => { await write.click() })
    assert.equal(f.doc.activeElement, input)
    assert.equal(f.doc.scrolled.node, input)
    assert.equal(f.doc.scrolled.options.behavior, 'instant')
    assert.equal(input.value, 'Syntetisk React-kladde')
    assert.deepEqual(f.calls, [])
    const list = find(f.host, 'ol')[0], sender = row(f.host, 'message:one').children[0]
    assert.equal(list.attributes.role, 'list')
    assert.equal(list.style.paddingInlineStart, '0'); assert.equal(list.style.listStyle, 'none')
    assert.equal(sender.style.background, 'transparent'); assert.equal(sender.style.border, '0')
    assert.equal(sender.style.width, '100%'); assert.equal(sender.style.minHeight, '44px')
    const jump = find(f.host, 'button').find(n => n.textContent.includes('Spring til første ulæste'))
    await act(async () => { await jump.click() })
    assert.equal(f.doc.scrolled.options.behavior, 'instant')
    assert.equal(f.doc.activeElement, row(f.host, 'message:one').children[0])
    await act(async () => { await f.doc.activeElement.click() })
    assert.equal(f.doc.activeElement, row(f.host, 'message:one').children[0])
    assert.equal(row(f.host, 'message:one').children[1].hidden, false)
    // U2: chronological; reading does not move the message.
    assert.equal(find(f.host, 'li')[0].dataset.key, 'message:one')
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
