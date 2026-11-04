// Synthetic, local DOM contract only; no browser or visual-layout claim.
import { syntheticHost } from '../synthetic-dom.mjs'
export function viewHost() {
  const host = syntheticHost()
  const create = host.ownerDocument.createElement.bind(host.ownerDocument)
  host.ownerDocument.createElement = tag => {
    const node = create(tag)
    node.removeEventListener = (event, handler) => {
      node.events[event] = (node.events[event] || []).filter(fn => fn !== handler)
    }
    node.remove = () => {
      if (node.parentElement) {
        node.parentElement.children = node.parentElement.children.filter(child => child !== node)
        node.parentElement = null
      }
    }
    return node
  }
  return host
}
