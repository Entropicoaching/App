// Synthetic hook state and element tree. These are test doubles, not React or a browser.
let current
export const io = { rpc: 0 }
export const supabase = { rpc() { io.rpc++; throw new Error('Backend access forbidden in synthetic test') } }
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
export function mount(Component, initialProps) {
  const instances = new Map()
  let props = initialProps
  function expand(node, path) {
    if (node == null || typeof node === 'boolean') return null
    if (typeof node !== 'object') return String(node)
    if (typeof node.type === 'function') {
      const key = `${path}:${node.type.name}:${node.props.key ?? ''}`
      if (!instances.has(key)) instances.set(key, { values: [], cursor: 0 })
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

let effectsEnabled = false
const pendingEffects = []
export function enableEffects() { effectsEnabled = true }
export async function flushEffects() {
  while (pendingEffects.length) pendingEffects.shift()()
  for (let i = 0; i < 15; i++) await Promise.resolve()
}
export function useEffect(run, deps) {
  if (!effectsEnabled) return
  const instance = current, index = instance.cursor++
  instance.effects ||= []
  const previous = instance.effects[index]
  if (previous && deps.every((d,i) => Object.is(d,previous.deps[i]))) return
  previous?.cleanup?.()
  const effect = { deps }
  instance.effects[index] = effect
  pendingEffects.push(() => { effect.cleanup = run() })
}
export function useRef(value) { return { current: value } }
export const createElement = (type, props, ...children) => h(type, props, null, ...children)
export const withRetry = () => { throw Error('Unexpected retry in synthetic test') }
export const queueWrite = () => { throw Error('Unexpected write in synthetic test') }
