// Hermetic React element/hook substitute. No browser, renderer or installed packages.
let current
export function createElement(type, props, ...children) { return { type, props: { ...props, children: children.flat(Infinity) } } }
export function useState(initial) {
  const instance = current, index = instance.cursor++
  if (!(index in instance.values)) instance.values[index] = typeof initial === 'function' ? initial() : initial
  return [instance.values[index], value => { instance.values[index] = typeof value === 'function' ? value(instance.values[index]) : value }]
}
export function useRef(value) { return useState(() => ({ current: value }))[0] }
export function mount(Component, props) {
  const instances = new Map()
  function expand(node, path) {
    if (node == null || node === false) return null
    if (Array.isArray(node)) return expand(createElement(Fragment, null, ...node), path + '/fragment')
    if (typeof node !== 'object') return String(node)
    if (typeof node.type === 'function') {
      const key = path + ':' + node.type.name + ':' + (node.props.key ?? '')
      if (!instances.has(key)) instances.set(key, { values: [], cursor: 0 })
      current = instances.get(key); current.cursor = 0
      let result
      try { result = node.type(node.props) } finally { current = null }
      return expand(result, key)
    }
    return { ...node, props: { ...node.props, children: node.props.children.map((c, i) => expand(c, path + '/' + i)).filter(c => c !== null) } }
  }
  return { render(next = props) { props = next; return expand(createElement(Component, props), 'root') } }
}
export function nodes(tree, predicate) {
  if (!tree || typeof tree !== 'object') return []
  return [...(predicate(tree) ? [tree] : []), ...tree.props.children.flatMap(c => nodes(c, predicate))]
}
export function text(tree) { return tree == null ? '' : typeof tree !== 'object' ? String(tree) : tree.props.children.map(text).join('') }
export function button(tree, label) {
  const found = nodes(tree, n => n.type === 'button' && text(n) === label)
  if (found.length !== 1) throw Error(`Expected button ${label}, got ${found.length}`)
  return found[0].props
}
export function field(tree, label) { return nodes(tree, n => n.props['aria-label'] === label)[0].props }

export const Fragment = Symbol.for('synthetic.fragment')

export function useEffect() {}
