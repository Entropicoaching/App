// Synthetic host contracts only. Real React/ReactDOM are used by consumers.
import { sessionReactDocument } from '../session/sessionQuickSetReactDom.mjs'

class StaticNodeList {
  constructor(nodes) {
    nodes.forEach((node, i) => Object.defineProperty(this, i, { value: node, enumerable: true }))
    Object.defineProperty(this, 'length', { value: nodes.length })
  }
  item(index) { return this[index] ?? null }
  *values() { for (let i = 0; i < this.length; i++) yield this[i] }
  *keys() { for (let i = 0; i < this.length; i++) yield i }
  *entries() { for (let i = 0; i < this.length; i++) yield [i, this[i]] }
  forEach(fn, context) { for (let i = 0; i < this.length; i++) fn.call(context, this[i], i, this) }
  [Symbol.iterator]() { return this.values() }
  get [Symbol.toStringTag]() { return 'NodeList' }
}
export const all = (host, selector) => Array.from(host.querySelectorAll(selector))
export const byKey = (host, value) => all(host, '[data-focus]').find(n => n.getAttribute('data-focus') === value)
export const propsOf = node => node[Object.keys(node).find(k => k.startsWith('__reactProps$'))]
export const tick = () => new Promise(resolve => setImmediate(resolve))
export const button = (host, text) => all(host, 'button').find(n => n.textContent === text)
export function hostFixture() {
  const doc = sessionReactDocument(), host = doc.createElement('div'); doc.body.append(host)
  const prototype = Object.getPrototypeOf(host), query = prototype.querySelectorAll
  // No Array methods on DOM collections. Product lifetime checks must use DOM
  // ownership or iteration, not Array-only includes/find assumptions.
  prototype.querySelectorAll = function(selector) { return new StaticNodeList(query.call(this, selector)) }
  Object.defineProperty(prototype, 'options', { configurable: true, get() { return this.querySelectorAll('option') } })
  const originals = new Map()
  const globals = values => {
    for (const [key, value] of Object.entries(values)) {
      if (!originals.has(key)) originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
      Object.defineProperty(globalThis, key, { configurable: true, value })
    }
  }
  globals({ window: doc.defaultView, IS_REACT_ACT_ENVIRONMENT: true })
  return { host, doc, globals, restore() {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    }
  } }
}
