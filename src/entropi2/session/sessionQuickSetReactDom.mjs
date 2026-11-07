import { Element } from './a11y-dom.mjs'

// A synthetic document for ReactDOM's host API and the actual session renderer.
// React and ReactDOM themselves must be installed app dependencies, with no loader.
export function sessionReactDocument() {
  let doc
  class Node extends Element {
    constructor(tag) {
      super(tag.toUpperCase(), doc)
      this.nodeType = 1; this.nodeName = this.tagName
      this.namespaceURI = 'http://www.w3.org/1999/xhtml'
      if (this.tagName === 'SELECT') {
        // A live options collection, including options nested in optgroups.
        // ReactDOM reads option.value and changes option.selected on updates.
        const list = () => Array.from(this.querySelectorAll('option'))
        const collection = new Proxy({}, { get: (_target, key) => {
          if (key === 'length') return list().length
          if (key === Symbol.iterator) return () => list()[Symbol.iterator]()
          if (key === 'item') return index => list()[index] ?? null
          if (key === 'namedItem') return name => list().find(n => n.id === name || n.getAttribute('name') === name) ?? null
          if (typeof key === 'string' && /^(0|[1-9][0-9]*)$/.test(key)) return list()[Number(key)]
          return undefined
        } })
        Object.defineProperties(this, {
          options: { configurable: true, get: () => collection },
          selectedIndex: { configurable: true, get: () => {
            const index = list().findIndex(n => n._selected)
            return index >= 0 ? index : this._noSelection ? -1 : list().length ? 0 : -1
          }, set: index => {
            const nodes = list()
            nodes.forEach((n, i) => { n._selected = i === Number(index) })
            this._noSelection = !nodes.some(n => n._selected)
          } },
          value: { configurable: true, get: () => list()[this.selectedIndex]?.value ?? '',
            set: value => { this.selectedIndex = list().findIndex(n => n.value === String(value)) } },
        })
      }
      if (this.tagName === 'OPTION') {
        const select = () => { let n = this.parentElement; while (n && n.tagName !== 'SELECT') n = n.parentElement; return n }
        Object.defineProperties(this, {
          value: { configurable: true, get: () => this.getAttribute('value') ?? this.textContent.trim().replace(/\s+/g, ' '),
            set: value => { this.setAttribute('value', value) } },
          selected: { configurable: true, get: () => {
            const parent = select()
            return parent ? parent.options[parent.selectedIndex] === this : !!this._selected
          }, set: value => {
            const parent = select()
            if (value && parent && !parent.multiple) for (const n of parent.options) n._selected = false
            this._selected = !!value
            if (parent) parent._noSelection = !Array.from(parent.options).some(n => n._selected)
          } },
          defaultSelected: { configurable: true, get: () => this.getAttribute('selected') !== null,
            set: value => { if (value) this.setAttribute('selected', ''); else this.removeAttribute('selected') } },
        })
      }
    }
    get childNodes() { return this.children }
    get firstChild() { return this.children[0] ?? null }
    get lastChild() { return this.children.at(-1) ?? null }
    appendChild(child) { child.parentNode?.removeChild(child); return super.appendChild(child) }
    removeChild(child) {
      const at = this.children.indexOf(child)
      if (at < 0) throw Error('Synthetic child missing')
      this.children.splice(at, 1); child.parentNode = null; return child
    }
    insertBefore(child, before) {
      child.parentNode?.removeChild(child)
      const at = this.children.indexOf(before)
      if (at < 0) throw Error('Synthetic sibling missing')
      this.children.splice(at, 0, child); child.parentNode = this; return child
    }
    removeAttribute(key) { delete this.attributes[key] }
    matches(selector) {
      return selector.startsWith('.') || selector.startsWith('[') ? super.matches(selector)
        : this.tagName.toLowerCase() === selector
    }
  }
  // The shared synthetic tree walks every child, including React's text nodes.
  // Keep its traversal API while text never matches an element selector.
  class Text extends Element {
    constructor(value) {
      super('#text', doc)
      this.nodeType = 3; this.nodeName = '#text'; this.nodeValue = String(value); this.parentNode = null
    }
    get textContent() { return this.nodeValue }
    set textContent(value) { this.nodeValue = String(value) }
    matches() { return false }
  }
  doc = { nodeType: 9, activeElement: null, addEventListener() {}, removeEventListener() {},
    createElement: tag => new Node(tag), createElementNS: (_namespace, tag) => new Node(tag),
    createTextNode: value => new Text(value) }
  doc.defaultView = { document: doc, HTMLElement: Node, HTMLIFrameElement: class {} }
  doc.documentElement = doc.createElement('html'); doc.body = doc.createElement('body'); doc.root = doc.body
  doc.documentElement.append(doc.body)
  return doc
}
