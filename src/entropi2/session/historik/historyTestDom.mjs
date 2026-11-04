import { dom, Element } from '../a11y-dom.mjs'

// Only the DOM APIs used by the real content renderer; no React replacement.
export function historyTestDom() {
  const root = dom(), doc = root.ownerDocument
  doc.createElementNS = (namespace, tag) => {
    const node = doc.createElement(tag); node.namespaceURI = namespace; return node
  }
  doc.createTextNode = text => {
    const node = new Element('#text', doc); node.textContent = text; return node
  }
  return root
}
