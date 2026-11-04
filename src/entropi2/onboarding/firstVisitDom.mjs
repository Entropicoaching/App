// A synthetic host document for the REAL ReactDOM renderer. No browser, layout,
// module replacement, network, fake React hooks, timers or persisted user data.
class Element {
  constructor(tag, ownerDocument) {
    Object.assign(this, { nodeType: 1, tagName: tag.toUpperCase(), nodeName: tag.toUpperCase(),
      namespaceURI: 'http://www.w3.org/1999/xhtml', ownerDocument, parentNode: null,
      style: {}, attributes: {}, children: [], _text: '', disabled: false, events: new Map() })
  }
  set textContent(value) { this.replaceChildren(); this._text = String(value) }
  get textContent() { return this._text + this.children.map(n => n.textContent).join('') }
  get childNodes() { return this.children }
  get firstChild() { return this.children[0] ?? null }
  get lastChild() { return this.children.at(-1) ?? null }
  append(...children) { children.forEach(child => this.appendChild(child)) }
  appendChild(child) { child.parentNode?.removeChild(child); this.children.push(child); child.parentNode = this; return child }
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
  replaceChildren(...children) {
    for (const child of this.children) child.parentNode = null
    this.children = []; this._text = ''; this.append(...children)
  }
  setAttribute(key, value) { this.attributes[key] = String(value) }
  getAttribute(key) { return this.attributes[key] ?? null }
  removeAttribute(key) { delete this.attributes[key] }
  addEventListener(type, callback, options) {
    const capture = options === true || options?.capture === true
    this.events.set(`${type}:${capture ? 'capture' : 'bubble'}`, callback)
  }
  removeEventListener(type, _callback, options) {
    const capture = options === true || options?.capture === true
    this.events.delete(`${type}:${capture ? 'capture' : 'bubble'}`)
  }
  focus() { this.ownerDocument.activeElement = this }
}

export function createDocument() {
  const doc = { nodeType: 9, addEventListener() {}, removeEventListener() {}, activeElement: null,
    createElement: tag => new Element(tag, doc),
    createElementNS: (_namespace, tag) => new Element(tag, doc),
    createTextNode: value => ({ nodeType: 3, nodeName: '#text', nodeValue: String(value), parentNode: null,
      get textContent() { return this.nodeValue }, set textContent(text) { this.nodeValue = String(text) } }),
  }
  doc.defaultView = { document: doc, HTMLElement: Element, HTMLIFrameElement: class {} }
  doc.documentElement = doc.createElement('html'); doc.body = doc.createElement('body')
  return doc
}
export const elements = node => node?.nodeType !== 1 ? [] : [node, ...node.children.flatMap(elements)]
export function click(host, label) {
  const target = elements(host).find(n => n.tagName === 'BUTTON' && n.textContent === label)
  if (!target || target.disabled) throw Error(`Missing enabled button: ${label}`)
  const event = { type: 'click', target, button: 0, bubbles: true, defaultPrevented: false,
    preventDefault() { this.defaultPrevented = true }, stopPropagation() {} }
  host.events.get('click:capture')?.(event)
  const bubble = host.events.get('click:bubble')
  if (!bubble) throw Error('React event delegation was not installed')
  bubble(event)
}
