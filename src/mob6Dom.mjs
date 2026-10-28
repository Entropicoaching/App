// Synthetic element tree only. Effects do not access the host DOM or storage.
let current
export function createElement(type, props, ...children) {
  return { type, props: { ...props, children: children.flat(Infinity) } }
}
export function h(type, props, unused, ...children) { return createElement(type, props, ...children) }
export function useState(initial) {
  const instance = current, index = instance.cursor++
  if (!(index in instance.values)) instance.values[index] = typeof initial === 'function' ? initial() : initial
  return [instance.values[index], value => { instance.values[index] = typeof value === 'function' ? value(instance.values[index]) : value }]
}
export function useRef(initial) { return useState(() => ({ current: initial }))[0] }
export function useId() { return useState(() => 'synthetic-id')[0] }
export function useEffect() {}
export function createPortal(node) { return node }
export function mount(Component, initialProps) {
  let props = initialProps
  const instances = new Map()
  function expand(node, path, visited) {
    if (node == null || typeof node === 'boolean') return null
    if (typeof node !== 'object') return String(node)
    if (typeof node.type === 'function') {
      const key = `${path}:${node.type.name}:${node.props.key ?? ''}`
      visited.add(key)
      if (!instances.has(key)) instances.set(key, { values: [], cursor: 0 })
      const before = current
      current = instances.get(key); current.cursor = 0
      let result
      try { result = node.type(node.props) } finally { current = before }
      return expand(result, key, visited)
    }
    return { ...node, props: { ...node.props, children: node.props.children.map((child, i) => expand(child, `${path}/${i}`, visited)).filter(child => child !== null) } }
  }
  return { render(nextProps = props) {
    props = nextProps
    const visited = new Set()
    const result = expand(createElement(Component, props), 'root', visited)
    for (const key of instances.keys()) if (!visited.has(key)) instances.delete(key)
    return result
  } }
}
export function nodes(tree, predicate) {
  return tree && typeof tree === 'object' ? [...(predicate(tree) ? [tree] : []), ...tree.props.children.flatMap(child => nodes(child, predicate))] : []
}
export function text(tree) { return tree == null ? '' : typeof tree !== 'object' ? String(tree) : tree.props.children.map(text).join(' ') }
export function button(tree, label) {
  const found = nodes(tree, n => n.type === 'button' && text(n).trim() === label)
  if (found.length !== 1) throw new Error(`Expected one button ${label}, got ${found.length}`)
  return found[0]
}
export function useMemo(factory) { return factory() }
