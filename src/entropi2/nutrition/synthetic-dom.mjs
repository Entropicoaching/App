// Minimal owned DOM, sufficient for actual mount/event handlers. No browser emulation claim.
export class Element {
  constructor(tag, doc) { this.tagName = tag.toUpperCase(); this.ownerDocument = doc; this.children = []; this.attrs = {}; this.events = {}; this.disabled = false; this.open = false; this._text = '' }
  append(...nodes) { for (const n of nodes) { this.children.push(n); n.parentElement = this } }
  replaceChildren(...nodes) { this.children = []; this._text = ''; this.append(...nodes) }
  set textContent(value) { this._text = String(value); this.children = [] }
  get textContent() { return this._text + this.children.map(n => n.textContent).join(' ') }
  setAttribute(key, value) { this.attrs[key] = String(value) }
  getAttribute(key) { return this.attrs[key] ?? null }
  addEventListener(event, fn) { (this.events[event] ||= []).push(fn) }
  async fire(event, extra = {}) {
    if (event === 'click' && this.disabled) return
    for (const fn of this.events[event] || []) await fn({ target: this, preventDefault() {}, ...extra })
  }
  focus() { this.ownerDocument.activeElement = this }
  querySelectorAll(selector) {
    const match = selector.startsWith('[') ? n => n.getAttribute(selector.slice(1, -1)) !== null
      : n => n.tagName.toLowerCase() === selector
    return this.children.flatMap(n => [...(match(n) ? [n] : []), ...n.querySelectorAll(selector)])
  }
}
export function syntheticHost() {
  const doc = { activeElement: null, createElement(tag) { return new Element(tag, doc) } }
  return new Element('div', doc)
}
export function find(host, tag, text) { return host.querySelectorAll(tag).find(n => n.textContent === text) }
export const flush = () => new Promise(resolve => setImmediate(resolve))
