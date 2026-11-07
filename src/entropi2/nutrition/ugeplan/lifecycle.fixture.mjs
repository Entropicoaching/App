// Strict synthetic DOM, no layout/browser claim. Real React/ReactDOM use this
// document; query results deliberately have NodeList's API, without Array.find.
import assert from 'node:assert/strict'
import { act } from 'react'

class NodeList {
  constructor(nodes) {
    nodes.forEach((node, index) => { this[index] = node })
    Object.defineProperty(this, 'length', { value: nodes.length })
  }
  item(index) { return this[index] ?? null }
  *values() { for (let i = 0; i < this.length; i++) yield this[i] }
  *keys() { for (let i = 0; i < this.length; i++) yield i }
  *entries() { for (let i = 0; i < this.length; i++) yield [i, this[i]] }
  forEach(fn, context) { for (const [i, node] of this.entries()) fn.call(context, node, i, this) }
  [Symbol.iterator]() { return this.values() }
  get [Symbol.toStringTag]() { return 'NodeList' }
}

// Independent host implementation: every removal verifies parent ownership;
// no replacement of a browser Node prototype or tolerant removal behavior.
export function strictDocument() {
  const doc = { nodeType: 9, activeElement: null, addEventListener() {}, removeEventListener() {} }
  class Node {
    constructor(tag, value) {
      this.ownerDocument = doc; this.parentNode = null; this._children = []
      this.nodeType = tag === '#text' ? 3 : 1; this.nodeValue = value
      this.tagName = tag.toUpperCase(); this.nodeName = this.tagName
      this.namespaceURI = 'http://www.w3.org/1999/xhtml'
      this.attributes = {}; this.events = new Map(); this.style = {}; this.disabled = false
      this.classList = { add() {}, remove() {} }
    }
    get children() { return new NodeList(this._children.filter(node => node.nodeType === 1)) }
    get childNodes() { return new NodeList(this._children) }
    get firstChild() { return this._children[0] ?? null }
    get lastChild() { return this._children.at(-1) ?? null }
    get parentElement() { return this.parentNode?.nodeType === 1 ? this.parentNode : null }
    get isConnected() { return this === doc.documentElement || !!this.parentNode?.isConnected }
    get options() { return this.querySelectorAll('option') }
    get textContent() { return this.nodeType === 3 ? this.nodeValue : this._children.map(n => n.textContent).join('') }
    set textContent(value) {
      if (this.nodeType === 3) this.nodeValue = String(value)
      else this.replaceChildren(...(String(value) ? [doc.createTextNode(String(value))] : []))
    }
    appendChild(child) {
      if (child === this || child.contains(this)) throw Error('HierarchyRequestError')
      child.parentNode?.removeChild(child)
      this._children.push(child); child.parentNode = this; return child
    }
    append(...nodes) { nodes.forEach(node => this.appendChild(node)) }
    removeChild(child) {
      const at = this._children.indexOf(child)
      if (at < 0 || child.parentNode !== this) throw Error('NotFoundError: child missing')
      this._children.splice(at, 1); child.parentNode = null; return child
    }
    insertBefore(child, before) {
      if (before === null) return this.appendChild(child)
      if (before.parentNode !== this) throw Error('NotFoundError: sibling missing')
      if (child === before) return child
      child.parentNode?.removeChild(child)
      this._children.splice(this._children.indexOf(before), 0, child); child.parentNode = this; return child
    }
    remove() { this.parentNode?.removeChild(this) }
    replaceChildren(...nodes) {
      for (const child of [...this._children]) this.removeChild(child)
      this.append(...nodes)
    }
    contains(node) { return node === this || this._children.some(child => child.contains(node)) }
    setAttribute(key, value) { this.attributes[key] = String(value) }
    getAttribute(key) { return this.attributes[key] ?? null }
    removeAttribute(key) { delete this.attributes[key] }
    addEventListener(key, fn) { if (!this.events.has(key)) this.events.set(key, new Set()); this.events.get(key).add(fn) }
    removeEventListener(key, fn) { this.events.get(key)?.delete(fn) }
    dispatch(key, event = {}) { for (const fn of this.events.get(key) ?? []) fn({ preventDefault() {}, ...event }) }
    click() { if (!this.disabled) this.dispatch('click') }
    focus() { if (!this.disabled) doc.activeElement = this }
    setSelectionRange(start, end, direction) { this.selectionStart = start; this.selectionEnd = end; this.selectionDirection = direction }
    matches(selector) {
      if (this.nodeType !== 1) return false
      if (selector.startsWith('.')) return this.getAttribute('class')?.split(' ').includes(selector.slice(1))
      if (selector.startsWith('[')) {
        const [, key, value] = selector.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/) ?? []
        return value === undefined ? this.getAttribute(key) !== null : this.getAttribute(key) === value
      }
      return this.tagName.toLowerCase() === selector
    }
    querySelectorAll(selector) {
      const selectors = selector.split(',').map(s => s.trim()), found = []
      const visit = node => {
        for (const child of node._children) {
          if (selectors.some(s => child.matches(s))) found.push(child)
          visit(child)
        }
      }
      visit(this); return new NodeList(found)
    }
    querySelector(selector) { return this.querySelectorAll(selector).item(0) }
  }
  doc.createElement = tag => new Node(tag)
  doc.createElementNS = (_namespace, tag) => new Node(tag)
  doc.createTextNode = value => new Node('#text', String(value))
  doc.defaultView = { document: doc, HTMLElement: Node, HTMLIFrameElement: class {} }
  doc.documentElement = doc.createElement('html'); doc.body = doc.createElement('body'); doc.documentElement.append(doc.body)
  return doc
}

export const list = (host, selector) => Array.from(host.querySelectorAll(selector))
export const focus = (host, key) => list(host, '[data-focus]').find(n => n.getAttribute('data-focus') === key)
export const propsOf = node => node?.[Object.keys(node).find(key => key.startsWith('__reactProps$'))]
export const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

export function lifecycleFixture(t, storage) {
  const doc = strictDocument()
  const host = doc.createElement('div'); doc.body.append(host)
  assert.equal(Array.isArray(host.querySelectorAll('div')), false)
  assert.equal(host.querySelectorAll('div').find, undefined)
  assert.equal(Array.isArray(host.childNodes), false)
  assert.equal(Array.isArray(host.children), false)
  assert.throws(() => host.removeChild(doc.createElement('p')), /NotFoundError/)
  const previous = new Map()
  for (const [key, value] of Object.entries({ window: doc.defaultView,
    localStorage: storage, IS_REACT_ACT_ENVIRONMENT: true })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, value, writable: true })
  }
  const errors = []
  t.mock.method(console, 'error', (...args) => errors.push(args.map(String).join(' ')))
  const queued = [], cleanups = [], schedule = globalThis.queueMicrotask
  let holding = false
  t.mock.method(globalThis, 'queueMicrotask', callback => { if (holding) queued.push(callback); else schedule(callback) })
  const hold = fn => { holding = true; try { return fn() } finally { holding = false } }
  const drain = async () => {
    await act(async () => {
      for (let turns = 0; queued.length; turns++) {
        assert.ok(turns < 50, 'bounded cleanup/refresh microtasks')
        queued.shift()()
        await Promise.resolve()
      }
    })
  }
  t.after(async () => {
    await act(async () => { for (const cleanup of cleanups.reverse()) await cleanup() })
    await drain()
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    }
    assert.deepEqual(errors, [], 'no React nested-unmount, stale update or act diagnostic')
    assert.equal(queued.length, 0)
  })
  return { doc, host, queued, hold, drain, errors, cleanup: fn => cleanups.push(fn) }
}
