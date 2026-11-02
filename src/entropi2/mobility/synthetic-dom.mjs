// Synthetic DOM only: events and text, no browser/layout/media implementation.
export class Node {
  constructor(tag, ownerDocument) {
    this.tagName = tag; this.ownerDocument = ownerDocument; this.children = []
    this.attributes = {}; this.style = {}; this.events = new Map(); this._text = ''
    this.disabled = false
  }
  set textContent(value) { this._text = String(value); this.children = [] }
  get textContent() { return this._text + this.children.map(n => n.textContent).join(' ') }
  appendChild(node) { this.children.push(node); return node }
  replaceChildren(...nodes) { this._text = ''; this.children = nodes }
  setAttribute(key, value) { this.attributes[key] = String(value) }
  addEventListener(type, callback) {
    if (!this.events.has(type)) this.events.set(type, new Set())
    this.events.get(type).add(callback)
  }
  removeEventListener(type, callback) { this.events.get(type)?.delete(callback) }
  click() { if (!this.disabled) for (const callback of this.events.get('click') || []) callback() }
}
export function dom() {
  const doc = { createElement: tag => new Node(tag, doc) }
  return doc.createElement('root')
}
export function nodes(root, tag) {
  return [...(root.tagName === tag ? [root] : []), ...root.children.flatMap(n => nodes(n, tag))]
}
export function button(root, label) {
  const matches = nodes(root, 'button').filter(n => n.textContent === label)
  if (matches.length !== 1) throw Error(`Expected one button ${label}: ${matches.length}`)
  return matches[0]
}
export function fakeClock() {
  let time = 0, id = 0
  const active = new Map(), history = []
  return { now: () => time,
    setInterval(fn) { const next = ++id; active.set(next, fn); history.push(fn); return next },
    clearInterval(id) { active.delete(id) },
    advance(ms) { time += ms; for (const fn of [...active.values()]) fn() },
    get count() { return active.size }, history }
}
