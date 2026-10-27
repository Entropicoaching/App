// Synthetic element tree and hook state. No browser, storage, backend or React runtime.
let current
export const s = new Proxy({}, { get: () => ({}) })
export default function CountdownRing() { return null }
export function useState(initial) {
  const instance = current, index = instance.cursor++
  if (!(index in instance.values)) instance.values[index] = initial
  return [instance.values[index], next => { instance.values[index] = typeof next === 'function' ? next(instance.values[index]) : next }]
}
export function h(type, props, _unused, ...children) { return { type, props: { ...props, children: children.flat(Infinity) } } }
export function createElement(type, props, ...children) { return h(type, props, null, ...children) }
export function mount(Component, props) {
  const instances = new Map()
  function expand(node, path) {
    if (node == null || typeof node === 'boolean') return null
    if (typeof node !== 'object') return String(node)
    if (typeof node.type === 'function') {
      const key = `${path}:${node.type.name}`
      if (!instances.has(key)) instances.set(key, { values: [], cursor: 0 })
      const previous = current
      current = instances.get(key); current.cursor = 0
      let result
      try { result = node.type(node.props) } finally { current = previous }
      return expand(result, key)
    }
    return { ...node, props: { ...node.props, children: node.props.children.map((child, i) => expand(child, `${path}/${i}`)).filter(child => child !== null) } }
  }
  return { render(next = props) { props = next; return expand(createElement(Component, props), 'root') } }
}
export function nodes(tree, predicate) {
  return tree && typeof tree === 'object' ? [...(predicate(tree) ? [tree] : []), ...tree.props.children.flatMap(child => nodes(child, predicate))] : []
}
export function text(tree) { return tree == null ? '' : typeof tree !== 'object' ? String(tree) : tree.props.children.map(text).join(' ') }
export function button(tree, label) {
  const found = nodes(tree, n => n.type === 'button' && text(n).trim() === label)
  if (found.length !== 1) throw new Error(`Expected one button: ${label}, found ${found.length}`)
  return found[0]
}
