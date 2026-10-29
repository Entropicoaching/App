// Synthetic element tree and hook state, no browser or React installation.
let current
export function useState(initial) {
  const instance = current
  if (!instance) throw Error('Hook outside synthetic mount')
  const i = instance.cursor++
  if (!(i in instance.values)) instance.values[i] = initial
  return [instance.values[i], next => { instance.values[i] = typeof next === 'function' ? next(instance.values[i]) : next }]
}
export function useRef(initial) {
  const [ref] = useState({ current: initial })
  return ref
}
export function useEffect(effect, dependencies) {
  const instance = current, i = instance.cursor++
  const prior = instance.values[i]
  if (!prior || dependencies.some((value, j) => value !== prior.dependencies[j])) {
    prior?.cleanup?.()
    instance.values[i] = { dependencies, cleanup: effect() }
  }
}
export function createElement(type, props, ...children) {
  return { type, props: { ...props, children: children.flat(Infinity) } }
}
export const h = (type, props, ignored, ...children) => createElement(type, props, ...children)
export function mount(Component, props = {}) {
  const instances = new Map()
  function expand(node, path) {
    if (Array.isArray(node)) return node.length === 1 ? expand(node[0], path) : { type: Fragment, props: { children: node.map((child, i) => expand(child, `${path}/${i}`)) } }
    if (node == null || typeof node === 'boolean') return null
    if (typeof node !== 'object') return String(node)
    if (typeof node.type === 'function') {
      const key = `${path}:${node.type.name}:${node.props.key || ''}`
      if (!instances.has(key)) instances.set(key, { values: [], cursor: 0 })
      current = instances.get(key); current.cursor = 0
      let value
      try { value = node.type(node.props) } finally { current = null }
      return expand(value, key)
    }
    return { ...node, props: { ...node.props, children: node.props.children.map((child, i) => expand(child, `${path}/${i}`)).filter(child => child !== null) } }
  }
  return { dispose() { for (const instance of instances.values()) for (const value of instance.values) value?.cleanup?.() }, render(next = props) { props = next; return expand(createElement(Component, props), 'root') } }
}
export function nodes(tree, match) {
  if (!tree || typeof tree !== 'object') return []
  return [...(match(tree) ? [tree] : []), ...tree.props.children.flatMap(child => nodes(child, match))]
}
export const text = tree => tree == null ? '' : typeof tree !== 'object' ? String(tree) : tree.props.children.map(text).join(' ')
export function one(tree, match) {
  const result = nodes(tree, match)
  if (result.length !== 1) throw Error(`Expected one node, got ${result.length}`)
  return result[0]
}

export const Fragment = Symbol.for('synthetic.fragment')
