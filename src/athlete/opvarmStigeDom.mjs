// Synthetic hooks and element tree only; no browser or storage implementation.
let current
export const s = new Proxy({}, { get: () => ({}) })
export const Fragment = 'fragment'
export const createElement = (type, props, ...children) => ({ type, props: { ...props, children: children.flat(Infinity) } })
export const h = (type, props, _, ...children) => createElement(type, props, ...children)
export function useState(initial) {
  const instance = current, index = instance.cursor++
  if (!(index in instance.values)) instance.values[index] = typeof initial === 'function' ? initial() : initial
  return [instance.values[index], next => { instance.values[index] = typeof next === 'function' ? next(instance.values[index]) : next }]
}
export const useRef = value => { const [ref] = useState({ current: value }); return ref }
export function useEffect(run, deps) {
  const instance = current, index = instance.cursor++
  const previous = instance.effects[index]
  if (previous && deps.every((dep, i) => Object.is(dep, previous.deps[i]))) return
  previous?.cleanup?.()
  instance.effects[index] = { deps, pending: run }
}
export function mount(Component, initialProps) {
  const instances = new Map()
  let props = initialProps
  function dispose(instance) { for (const effect of Object.values(instance.effects)) effect.cleanup?.() }
  function expand(node, path, seen) {
    if (node == null || typeof node === 'boolean') return null
    if (typeof node !== 'object') return String(node)
    if (typeof node.type === 'function') {
      const key = `${path}:${node.type.name}:${node.props.key ?? ''}`
      seen.add(key)
      if (!instances.has(key)) instances.set(key, { cursor: 0, values: [], effects: {} })
      current = instances.get(key); current.cursor = 0
      const output = node.type(node.props)
      current = null
      return expand(output, key, seen)
    }
    return { ...node, props: { ...node.props, children: node.props.children.map((child, i) => expand(child, `${path}/${i}`, seen)).filter(child => child !== null) } }
  }
  return {
    render(next = props) {
      props = next
      const seen = new Set(), tree = expand(createElement(Component, props), 'root', seen)
      for (const [key, instance] of instances) {
        if (!seen.has(key)) { dispose(instance); instances.delete(key); continue }
        for (const effect of Object.values(instance.effects)) if (effect.pending) { effect.cleanup = effect.pending(); delete effect.pending }
      }
      return tree
    },
    unmount() { for (const instance of instances.values()) dispose(instance); instances.clear() },
  }
}
export const nodes = (tree, predicate) => tree && typeof tree === 'object' ? [...(predicate(tree) ? [tree] : []), ...tree.props.children.flatMap(child => nodes(child, predicate))] : []
export const text = tree => tree == null ? '' : typeof tree !== 'object' ? String(tree) : tree.props.children.map(text).join(' ')
export function button(tree, label) {
  const found = nodes(tree, node => node.type === 'button' && text(node).trim() === label)
  if (found.length !== 1) throw Error(`Expected one button ${label}, found ${found.length}`)
  return found[0]
}
