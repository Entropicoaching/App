import { FakeNode } from '../../athlete/trainingFullscreenFake.mjs'

// Extend the pinned synthetic event/dialog helper with the renderer's tree API.
// No layout, browser, storage, React or backend is simulated.
export function syntheticDom() {
  const doc = { activeElement: null, createElement: tag => new Node(tag) }
  class Node extends FakeNode {
    constructor(tag) {
      super(tag); this.ownerDocument = doc; this.children = []; this.attrs = {}; this.text = ''
      this.classList = { add() {}, remove() {} }
    }
    setAttribute(k, v) { this.attrs[k] = String(v) }
    getAttribute(k) { return this.attrs[k] ?? null }
    set textContent(v) { this.text = String(v); this.children = [] }
    get textContent() { return this.text + this.children.map(n => n.textContent).join('\n') }
    append(...nodes) { for (const n of nodes) { n.parent = this; this.children.push(n) } }
    replaceChildren(...nodes) { for (const n of this.children) n.parent = null; this.children = []; this.text = ''; this.append(...nodes) }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(n => n !== this); this.parent = null }
    contains(node) { return node === this || this.children.some(n => n.contains(node)) }
    focus() { doc.activeElement = this }
    setSelectionRange(a, b) { this.selectionStart = a; this.selectionEnd = b }
    querySelectorAll(selector) {
      const matches = n => selector.split(',').some(part => {
        const s = part.trim(), attr = s.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/)
        return attr ? n.getAttribute(attr[1]) != null && (attr[2] == null || n.getAttribute(attr[1]) === attr[2]) : n.type === s
      })
      return this.children.flatMap(n => [...(matches(n) ? [n] : []), ...n.querySelectorAll(selector)])
    }
    querySelector(s) { return this.querySelectorAll(s)[0] || null }
  }
  const timers = new Map()
  let id = 0
  const clock = { Date: { now: () => Date.parse('2026-11-03T12:00:00Z') },
    setInterval(fn) { timers.set(++id, fn); return id }, clearInterval(i) { timers.delete(i) } }
  return { root: new Node('section'), clock, timers, doc }
}
