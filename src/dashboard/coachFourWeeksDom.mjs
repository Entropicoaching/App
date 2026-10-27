// Synthetic hook state and element tree. These are test doubles, not React or a browser.
let current
export const io = { rpc: 0 }
export const supabase = { from(...args) { return io.database.from(...args) }, rpc() { throw new Error('Unexpected RPC') } }
export const s = new Proxy({}, { get: () => ({}) })
export function useState(initial) {
  if (!current) throw new Error('Hook outside synthetic render')
  const instance = current
  const index = instance.cursor++
  if (!(index in instance.values)) instance.values[index] = typeof initial === 'function' ? initial() : initial
  return [instance.values[index], next => {
    instance.values[index] = typeof next === 'function' ? next(instance.values[index]) : next
  }]
}
export function h(type, props, _unused, ...children) {
  return { type, props: { ...props, children: children.flat(Infinity) } }
}
export function mount(Component, initialProps, rootValues = []) {
  const instances = new Map()
  let props = initialProps
  function expand(node, path) {
    if (node == null || typeof node === 'boolean') return null
    if (typeof node !== 'object') return String(node)
    if (typeof node.type === 'function') {
      const key = `${path}:${node.type.name}:${node.props.key ?? ''}`
      if (!instances.has(key)) instances.set(key, { values: path === 'root' ? rootValues.slice() : [], cursor: 0 })
      current = instances.get(key); current.cursor = 0
      let result
      try { result = node.type(node.props) } finally { current = null }
      return expand(result, key)
    }
    return { ...node, props: { ...node.props, children: node.props.children.map((child, n) => expand(child, `${path}/${n}`)).filter(child => child !== null) } }
  }
  return { render(next = props) { props = next; return expand(h(Component, props, null), 'root') } }
}
export function nodes(tree, predicate) {
  if (tree == null || typeof tree !== 'object') return []
  return [...(predicate(tree) ? [tree] : []), ...tree.props.children.flatMap(child => nodes(child, predicate))]
}
export function text(tree) {
  if (tree == null) return ''
  if (typeof tree !== 'object') return String(tree)
  return tree.props.children.map(text).join('')
}
export const button = (tree, label) => {
  const found = nodes(tree, n => n.type === 'button' && text(n).trim() === label)
  if (found.length !== 1) throw new Error(`Expected one button ${label}, found ${found.length}`)
  return found[0]
}

export function useRef(initial) { return useState(() => ({ current: initial }))[0] }
export function useEffect() {}
