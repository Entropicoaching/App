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
  doc = { nodeType: 9, activeElement: null, addEventListener() {}, removeEventListener() {},
    createElement: tag => new Node(tag), createElementNS: (_namespace, tag) => new Node(tag),
    createTextNode: value => ({ nodeType: 3, nodeName: '#text', nodeValue: String(value), parentNode: null,
      get textContent() { return this.nodeValue }, set textContent(text) { this.nodeValue = String(text) } }) }
  doc.defaultView = { document: doc, HTMLElement: Node, HTMLIFrameElement: class {} }
  doc.documentElement = doc.createElement('html'); doc.body = doc.createElement('body'); doc.root = doc.body
  doc.documentElement.append(doc.body)
  return doc
}
