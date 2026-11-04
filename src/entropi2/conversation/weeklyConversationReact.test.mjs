import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement, act } from 'react'
import { createRoot } from 'react-dom/client'
import Conversation from './Conversation.mjs'
import { createConversation } from './conversationController.mjs'
import { createWeeklyLetter } from '../coach/ugebrev/weeklyLetterModel.mjs'
import { letterFixture, emptyFixture } from '../coach/ugebrev/letterFixture.mjs'

// Minimal host document for React's real renderer and the actual imperative view.
// No module hooks, fake React, network, browser, timers or layout assertions.
class Element {
  constructor(tag, ownerDocument) {
    Object.assign(this, { nodeType: 1, tagName: tag.toUpperCase(), nodeName: tag.toUpperCase(),
      namespaceURI: 'http://www.w3.org/1999/xhtml', ownerDocument, parentNode: null,
      style: {}, dataset: {}, attributes: {}, children: [], value: '', _text: '', disabled: false, events: new Map() })
  }
  set textContent(value) { this.replaceChildren(); this._text = String(value) }
  get textContent() { return this._text + this.children.map(n => n.textContent).join(' ') }
  get childNodes() { return this.children }
  get firstChild() { return this.children[0] ?? null }
  get lastChild() { return this.children.at(-1) ?? null }
  append(...children) { children.forEach(child => this.appendChild(child)) }
  appendChild(child) {
    child.parentNode?.removeChild(child); this.children.push(child); child.parentNode = this; return child
  }
  removeChild(child) {
    const at = this.children.indexOf(child); assert.notEqual(at, -1)
    this.children.splice(at, 1); child.parentNode = null; return child
  }
  insertBefore(child, before) {
    child.parentNode?.removeChild(child)
    const at = this.children.indexOf(before); assert.notEqual(at, -1)
    this.children.splice(at, 0, child); child.parentNode = this; return child
  }
  replaceChildren(...children) {
    for (const child of this.children) child.parentNode = null
    this.children = []; this._text = ''; this.append(...children)
  }
  setAttribute(key, value) { this.attributes[key] = String(value) }
  removeAttribute(key) { delete this.attributes[key] }
  addEventListener(type, fn) { this.events.set(type, fn) }
  removeEventListener() {}
}
const find = (el, tag) => [...(el.tagName === tag.toUpperCase() ? [el] : []), ...el.children.flatMap(n => find(n, tag))]

test('real React effect mounts weekly view: loaded, folded, empty, failure, cleanup and OFF', async () => {
  const oldWindow = globalThis.window, oldAct = globalThis.IS_REACT_ACT_ENVIRONMENT
  const doc = { nodeType: 9, addEventListener() {}, removeEventListener() {},
    createElement: tag => new Element(tag, doc), activeElement: null }
  const win = { document: doc, HTMLElement: Element, HTMLIFrameElement: class {} }
  doc.defaultView = win; doc.documentElement = doc.createElement('html'); doc.body = doc.createElement('body')
  globalThis.window = win; globalThis.IS_REACT_ACT_ENVIRONMENT = true
  const host = doc.createElement('div'), root = createRoot(host), ref = { current: null }
  let fail = false, scopeReads = 0, controller, letterData = letterFixture(), sends = 0
  // Choose a timestamp in the current week without consulting data outside this fixture.
  const at = new Date().toISOString()
  const messages = [{ id: 'synthetic-message', athlete_id: 'synthetic', sender_role: 'athlete',
    created_at: at, content: 'Syntetisk tekst' }]
  const createController = () => {
    controller = createConversation({ enabled: true, storage: () => null, adapters: {
      scope: () => { scopeReads++; return { role: 'coach', athleteId: 'synthetic', ownerId: 'synthetic-owner' } },
      load: async () => { if (fail) throw Error('Synthetic read failure'); return { messages, analyses: [] } },
      send: async () => { sends++; throw Error('Unexpected send') },
    } })
    controller.weeklyLetter = async () => createWeeklyLetter({ enabled: true, data: letterData })
    return controller
  }
  try {
    await act(async () => { root.render(createElement(Conversation, { enabled: true, createController, controllerRef: ref })) })
    assert.equal(ref.current, controller)
    assert.match(host.textContent, /Denne uge · 1 beskeder · 1 ubesvarede · 0 video-feedback/)
    const details = find(host, 'details')[0]
    assert.equal(details.open, false); assert.equal(details.hidden, false)
    assert.equal(details.children[0].tagName, 'SUMMARY')
    const letterButton = find(host, 'button').find(b => b.textContent === 'Lav udkast til ugebrev')
    const input = find(host, 'textarea')[0]
    assert.equal(letterButton.disabled, false)
    await act(async () => { await letterButton.events.get('click')() })
    assert.match(input.value, /Godt arbejde/)
    assert.match(host.textContent, /Redigér teksten, og tryk selv Send/)
    assert.equal(sends, 0); assert.equal(letterButton.disabled, true)
    await act(async () => { controller.draft('') })
    letterData = emptyFixture()
    await act(async () => { await letterButton.events.get('click')() })
    assert.match(host.textContent, /Ingen kendte søvnregistreringer/)
    assert.equal(input.value, '')
    letterData = { state: 'error' }
    await act(async () => { await letterButton.events.get('click')() })
    assert.match(host.textContent, /Udkastet kunne ikke dannes/)
    assert.equal(input.value, ''); assert.equal(sends, 0)
    details.open = true
    await act(async () => { controller.draft('Syntetisk kladde') })
    assert.equal(details.open, true)
    messages.length = 0
    await act(async () => { await controller.refresh() })
    assert.match(host.textContent, /Ingen beskeder eller video-feedback i denne uge/)
    fail = true
    await act(async () => { await controller.refresh() })
    assert.match(host.textContent, /Ugens opsummering er ikke tilgængelig/)
    assert.equal(find(host, 'details')[0].hidden, true)
    await act(async () => { root.render(createElement(Conversation, { enabled: false, createController, controllerRef: ref })) })
    assert.equal(host.children.length, 0); assert.equal(ref.current, null)
    const reads = scopeReads
    await act(async () => { root.render(createElement(Conversation, { enabled: false, createController, controllerRef: ref })) })
    assert.equal(scopeReads, reads)
  } finally {
    await act(async () => { root.unmount() })
    if (oldWindow === undefined) delete globalThis.window; else globalThis.window = oldWindow
    if (oldAct === undefined) delete globalThis.IS_REACT_ACT_ENVIRONMENT; else globalThis.IS_REACT_ACT_ENVIRONMENT = oldAct
  }
})
