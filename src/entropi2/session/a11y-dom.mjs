// Synthetic DOM: focus/event/attribute contracts only, no browser or layout.
export class Element {
  constructor(tag, doc) {
    this.tagName = tag; this.ownerDocument = doc; this.children = []; this.attributes = {}
    this.style = {}; this.events = new Map(); this._text = ''; this.disabled = false
    this.classList = { add: () => {}, remove: () => {} }
  }
  get parentElement() { return this.parentNode }
  get isConnected() { return this === this.ownerDocument.root || !!this.parentNode?.isConnected }
  get textContent() { return this._text + this.children.map(n => n.textContent).join(' ') }
  set textContent(v) { this.replaceChildren(); this._text = String(v) }
  appendChild(n) { n.parentNode = this; this.children.push(n); return n }
  append(...nodes) { nodes.forEach(n => this.appendChild(n)) }
  replaceChildren(...nodes) {
    for (const n of this.children) n.parentNode = null
    this.children = []; this._text = ''; this.append(...nodes)
  }
  remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(n => n !== this); this.parentNode = null }
  contains(n) { return n === this || this.children.some(c => c.contains(n)) }
  setAttribute(k, v) { this.attributes[k] = String(v) }
  getAttribute(k) { return this.attributes[k] ?? null }
  addEventListener(k, f) { if (!this.events.has(k)) this.events.set(k, new Set()); this.events.get(k).add(f) }
  removeEventListener(k, f) { this.events.get(k)?.delete(f) }
  dispatch(k, e = {}) { for (const f of this.events.get(k) || []) f({ preventDefault() {}, ...e }) }
  click() { if (!this.disabled) this.dispatch('click') }
  focus() { if (!this.disabled) this.ownerDocument.activeElement = this }
  setSelectionRange(a, b) { this.selectionStart = a; this.selectionEnd = b }
  showModal() { this.open = true }
  close() { this.open = false; this.dispatch('close') }
  matches(s) {
    if (s.startsWith('.')) return this.getAttribute('class')?.split(' ').includes(s.slice(1))
    if (s.startsWith('[')) {
      const [, k, v] = s.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/) || []
      return v === undefined ? this.getAttribute(k) !== null : this.getAttribute(k) === v
    }
    return this.tagName === s
  }
  querySelectorAll(selector) {
    const selectors = selector.split(',').map(s => s.trim())
    const match = n => selectors.some(s => {
      const [ancestor, child] = s.split(' ')
      if (!child) return n.matches(s)
      let p = n.parentNode
      while (p && p !== this) { if (p.matches(ancestor) && n.matches(child)) return true; p = p.parentNode }
      return false
    })
    const walk = n => n.children.flatMap(c => [...(match(c) ? [c] : []), ...walk(c)])
    return walk(this)
  }
  querySelector(s) { return this.querySelectorAll(s)[0] ?? null }
}
export function dom() {
  const doc = { createElement: tag => new Element(tag, doc) }
  doc.root = doc.createElement('root'); return doc.root
}
export const button = (root, text) => root.querySelectorAll('button').find(n => n.textContent === text)
