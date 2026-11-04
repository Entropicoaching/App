// Element fixture only: no React DOM, browser or layout simulation.
export const createElement = (type, props, ...children) => ({ type, props: props || {},
  children: children.flat(Infinity).filter(value => value !== false && value != null) })
export function text(node) {
  return typeof node === 'object' ? node.children.map(text).join(' ') : String(node ?? '')
}
export function nodes(node, type) {
  return !node || typeof node !== 'object' ? []
    : [...(node.type === type ? [node] : []), ...node.children.flatMap(child => nodes(child, type))]
}
