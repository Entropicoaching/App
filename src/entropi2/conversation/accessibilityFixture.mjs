import assert from 'node:assert/strict'
import { createConversation } from './conversationController.mjs'

// Text/event host for real copied modules and ReactDOM's real renderer.
// Models detachment/focus explicitly; does not claim browser layout or CSS QA.
export class Element {
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
  contains(child) { return this === child || this.children.some(n => n.contains(child)) }
  append(...children) { children.forEach(child => this.appendChild(child)) }
  appendChild(child) {
    child.parentNode?.removeChild(child); this.children.push(child); child.parentNode = this; return child
  }
  removeChild(child) {
    const at = this.children.indexOf(child); assert.notEqual(at, -1)
    if (child.contains(this.ownerDocument.activeElement)) this.ownerDocument.activeElement = this.ownerDocument.body
    this.children.splice(at, 1); child.parentNode = null; return child
  }
  insertBefore(child, before) {
    child.parentNode?.removeChild(child)
    const at = this.children.indexOf(before); assert.notEqual(at, -1)
    this.children.splice(at, 0, child); child.parentNode = this; return child
  }
  replaceChildren(...children) {
    for (const child of [...this.children]) this.removeChild(child)
    this._text = ''; this.append(...children)
  }
  setAttribute(key, value) { this.attributes[key] = String(value) }
  removeAttribute(key) { delete this.attributes[key] }
  addEventListener(type, fn) { this.events.set(type, fn) }
  removeEventListener() {}
  focus(options) { this.ownerDocument.activeElement = this; this.ownerDocument.focusOptions = options }
  scrollIntoView(options) { this.ownerDocument.scrolled = { node: this, options } }
  click() { if (!this.disabled) return this.events.get('click')?.() }
}
export const find = (el, tag) => [...(el.tagName === tag.toUpperCase() ? [el] : []), ...el.children.flatMap(n => find(n, tag))]
export const row = (host, key) => find(host, 'li').find(n => n.dataset.key === key)
export const deferred = () => {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}
export function fixture({ reduced = false, kind = 'message', fail = false, gate } = {}) {
  const doc = { nodeType: 9, activeElement: null, addEventListener() {}, removeEventListener() {},
    createElement: tag => new Element(tag, doc) }
  const queries = []
  const win = { document: doc, HTMLElement: Element, HTMLIFrameElement: class {},
    matchMedia(query) { queries.push(query); return { matches: reduced } } }
  doc.defaultView = win; doc.documentElement = doc.createElement('html'); doc.body = doc.createElement('body')
  doc.activeElement = doc.body
  const host = doc.createElement('div'); doc.body.append(host)
  const calls = []
  const messages = [{ id: 'one', athlete_id: 'synthetic', sender_role: 'coach', content: 'Syntetisk besked',
    created_at: '2026-11-04T12:00:00Z', read_at: null },
  { id: 'two', athlete_id: 'synthetic', sender_role: 'coach', content: 'Anden syntetisk besked',
    created_at: '2026-11-04T13:00:00Z', read_at: null }]
  const analyses = kind === 'video' ? [{ id: 'one', athlete_id: 'synthetic', status: 'shared',
    source_mode: 'athlete_submission', created_at: '2026-11-04T11:00:00Z' }] : []
  const createController = () => createConversation({ enabled: true, storage: () => null, adapters: {
    scope: () => ({ role: 'athlete', ownerId: 'synthetic-owner', athleteId: 'synthetic' }),
    load: async () => ({ messages, analyses }),
    async seen(item) {
      calls.push(item.key)
      if (gate) await gate.promise
      if (fail) throw Error('Synthetic acknowledgement failure')
      return { ...item.value, ...(item.kind === 'video' ? { athlete_seen_at: 'seen' } : { read_at: 'seen' }) }
    },
  } })
  return { doc, win, host, queries, calls, createController, setReduced(value) { reduced = value } }
}
