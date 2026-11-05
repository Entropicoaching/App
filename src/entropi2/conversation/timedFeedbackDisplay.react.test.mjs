import test from 'node:test'
import assert from 'node:assert/strict'
import { act, createElement, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Conversation from './Conversation.mjs'
import { createConversation } from './conversationController.mjs'
import { fixture, find, row } from './accessibilityFixture.mjs'

// Real React/ReactDOM, actual copied Conversation/controller/view; synthetic data and host only.
test('React: coach sends timed feedback and athlete sees lift/date/time without an internal id', async () => {
  const f = fixture(), ref = { current: null }, messages = [], writes = []
  const oldWindow = globalThis.window, oldAct = globalThis.IS_REACT_ACT_ENVIRONMENT
  globalThis.window = f.win; globalThis.IS_REACT_ACT_ENVIRONMENT = true
  const root = createRoot(f.host)
  const analyses = ['synthetic-first', 'synthetic-selected'].map(id => ({ id, athlete_id: 'synthetic',
    lift: 'squat', status: 'shared', created_at: '2026-11-02T08:00:00Z' }))
  const controllerFor = role => () => createConversation({ enabled: true, storage: () => null,
    uuid: () => 'synthetic-message', adapters: {
      scope: () => ({ role, athleteId: 'synthetic', ownerId: 'synthetic-owner' }),
      load: async () => ({ messages, analyses }),
      send: async value => {
        writes.push({ ...value })
        const saved = { ...value, created_at: '2026-11-02T09:00:00Z' }
        messages.push(saved); return saved
      },
      seen: async item => ({ ...item.value, read_at: 'seen' }),
    } })
  try {
    await act(async () => root.render(createElement(StrictMode, null,
      createElement(Conversation, { enabled: true, createController: controllerFor('coach'), controllerRef: ref }))))
    assert.equal(writes.length, 0)
    await act(async () => { ref.current.draft('Hold brystet oppe.') })
    const select = find(f.host, 'select')[0]
    assert.equal(select.children[2].textContent, 'Squat-video 2. nov.')
    select.value = 'synthetic-selected'
    find(f.host, 'input').find(n => n.attributes['aria-label'] === 'Tidspunkt i sekunder').value = '3.5'
    await act(async () => { await find(f.host, 'button').find(n => n.textContent === 'Send tidsfeedback').click() })
    assert.equal(writes.length, 1)
    assert.equal(writes[0].content, 'Squat-video 2. nov. ved 3,5 s\nHold brystet oppe.\nVideo-id: synthetic-selected')
    assert.equal(writes[0].category, 'teknik')
    assert.doesNotMatch(f.host.textContent, /Video-id:|synthetic-selected|synthetic-first/)
    await act(async () => root.render(createElement(Conversation,
      { enabled: true, createController: controllerFor('athlete'), controllerRef: ref })))
    let item = row(f.host, 'message:synthetic-message')
    const expected = 'Squat-video 2. nov. ved 3,5 s\nHold brystet oppe.'
    assert.equal(item.children[2].textContent, expected)
    await act(async () => { await item.children[0].click() })
    item = row(f.host, 'message:synthetic-message')
    assert.equal(item.children[1].hidden, false)
    assert.equal(item.children[1].textContent, expected)
    assert.doesNotMatch(f.host.textContent, /Video-id:|synthetic-selected|synthetic-first/)
    assert.equal(find(f.host, 'select').length, 0)
    await act(async () => root.render(createElement(Conversation, { enabled: false,
      createController: () => assert.fail('OFF controller access'), controllerRef: ref })))
    assert.equal(ref.current, null); assert.equal(f.host.children.length, 0)
    assert.equal(writes.length, 1)
  } finally {
    await act(async () => root.unmount())
    if (oldWindow === undefined) delete globalThis.window; else globalThis.window = oldWindow
    if (oldAct === undefined) delete globalThis.IS_REACT_ACT_ENVIRONMENT; else globalThis.IS_REACT_ACT_ENVIRONMENT = oldAct
  }
})
