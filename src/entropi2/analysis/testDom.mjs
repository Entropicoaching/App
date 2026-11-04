// Small synthetic DOM for this isolated leaf component. No browser or JSX
// transform, layout engine, React reconciler or network is simulated.
class Text {
  constructor(value) { this.textContent = String(value) }
}
export class Element {
  constructor(tag) { this.tagName = tag; this.children = []; this.attributes = {}; this.listeners = {} }
  appendChild(child) { this.children.push(child); return child }
  setAttribute(name, value) { this.attributes[name] = String(value) }
  getAttribute(name) { return this.attributes[name] ?? null }
  addEventListener(type, callback) { this.listeners[type] = callback }
  dispatchEvent(event) { return this.listeners[event.type]?.(event) }
  get textContent() { return this.children.map(c => c.textContent).join('') }
  querySelectorAll(selector) {
    const match = node => node instanceof Element && (selector.startsWith('[')
      ? Object.hasOwn(node.attributes, selector.slice(1, -1)) : node.tagName === selector)
    return this.children.flatMap(node => [ ...(match(node) ? [node] : []),
      ...(node instanceof Element ? node.querySelectorAll(selector) : []) ])
  }
}
export function createElement(tag, props, ...children) {
  if (typeof tag === 'function') return tag({ ...props, children })
  const element = new Element(tag)
  for (const [key, value] of Object.entries(props || {})) {
    if (key === 'key' || key === 'style') continue
    if (key.startsWith('on') && typeof value === 'function') element.addEventListener(key.slice(2).toLowerCase(), value)
    else element.setAttribute(key, value)
  }
  for (const child of children.flat(Infinity)) {
    if (child == null || typeof child === 'boolean') continue
    element.appendChild(child instanceof Element ? child : new Text(child))
  }
  return element
}

// React createElement returns an element description, not a DOM node. Convert
// host elements explicitly so tests also work with the application's real React.
// Existing synthetic nodes pass through; no loader ordering is assumed.
export function renderTree(node) {
  if (node == null || typeof node === 'boolean') return null
  if (node instanceof Element || node instanceof Text) return node
  if (typeof node === 'string' || typeof node === 'number') return new Text(node)
  if (typeof node?.type === 'function' && node.props) return renderTree(node.type(node.props))
  if (typeof node !== 'object' || typeof node.type !== 'string' || !node.props)
    throw new TypeError('Expected a host React element or synthetic node')
  const { children, ...props } = node.props
  const element = createElement(node.type, props)
  for (const child of [children].flat(Infinity)) {
    const rendered = renderTree(child)
    if (rendered) element.appendChild(rendered)
  }
  return element
}
