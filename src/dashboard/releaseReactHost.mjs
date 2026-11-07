// Inert owned host for the real ReactDOM client renderer. No browser or layout.
import { createDocument, elements } from '../entropi2/onboarding/firstVisitDom.mjs'
export { elements }

export function programDocument() {
  const doc = createDocument(), create = doc.createElement
  doc.oninput = null
  doc.createElement = tag => {
    const node = create(tag)
    if (node.tagName === 'INPUT') node.type = 'text'
    const setAttribute = node.setAttribute.bind(node), removeAttribute = node.removeAttribute.bind(node)
    node.setAttribute = (key, value) => {
      setAttribute(key, value)
      if (key === 'disabled') node.disabled = true
    }
    node.removeAttribute = key => {
      removeAttribute(key)
      if (key === 'disabled') node.disabled = false
    }
    let value = ''
    Object.defineProperty(node, 'value', {
      configurable: true,
      get() {
        if (node.tagName === 'OPTION') return node.getAttribute('value') ?? node.textContent
        if (node.tagName === 'SELECT') return node.options.find(option => option.selected)?.value ?? ''
        return value
      },
      set(next) {
        value = String(next)
        if (node.tagName === 'SELECT') for (const option of node.options) option.selected = option.value === value
      },
    })
    if (node.tagName === 'SELECT') Object.defineProperty(node, 'options', {
      get: () => elements(node).filter(child => child.tagName === 'OPTION'),
    })
    return node
  }
  doc.createElementNS = (_namespace, tag) => doc.createElement(tag)
  return doc
}

// Use React's installed delegated listeners, never invoke stored component props.
export function dispatch(host, target, type, extra = {}) {
  if (!target || target.disabled) throw Error(`Missing enabled target for ${type}`)
  const event = { type, target, button: 0, bubbles: true, defaultPrevented: false,
    preventDefault() { this.defaultPrevented = true }, stopPropagation() { this.cancelBubble = true }, ...extra }
  const capture = host.events.get(`${type}:capture`), bubble = host.events.get(`${type}:bubble`)
  if (!bubble) throw Error(`React did not delegate ${type}`)
  capture?.(event)
  if (!event.cancelBubble) bubble(event)
}
