// Synthetic hook/element fixture only. Does not claim React reconciliation or DOM QA.
let owner
export const createElement = (type, config, ...children) => {
  const { key, ...props } = config ?? {}
  return { type, key, props: { ...props, children: children.flat(Infinity).filter(n => n != null && n !== false) } }
}
export function useState(initial) {
  const state = owner, i = state.cursor++
  if (!(i in state.values)) state.values[i] = typeof initial === 'function' ? initial() : initial
  return [state.values[i], value => { state.values[i] = typeof value === 'function' ? value(state.values[i]) : value }]
}
export const useRef = initial => useState(() => ({ current: initial }))[0]
// Effects are tested through their exported lifecycle functions, never run here.
export const useEffect = () => {}
export const useSyncExternalStore = (_subscribe, snapshot, serverSnapshot) => {
  if (serverSnapshot !== snapshot) throw Error('Mismatched server snapshot')
  return snapshot()
}
export function mount(Component, initial) {
  let props = initial, states = new Map()
  return { render(next) {
    props = { ...props, ...next }
    const used = new Set()
    const expand = (node, path) => {
      if (!node || typeof node !== 'object') return node
      const identity = `${path}:${node.key ?? ''}`
      if (typeof node.type === 'function') {
        const key = `${identity}:${node.type.name}`
        used.add(key)
        if (!states.has(key)) states.set(key, { values: [], cursor: 0 })
        const previous = owner; owner = states.get(key); owner.cursor = 0
        let result
        try { result = node.type(node.props) } finally { owner = previous }
        return expand(result, key)
      }
      return { ...node, props: { ...node.props, children: node.props.children.map((child, i) => expand(child, `${identity}/${i}`)) } }
    }
    const result = expand(createElement(Component, props), 'root')
    for (const key of states.keys()) if (!used.has(key)) states.delete(key)
    return result
  } }
}
export const nodes = tree => !tree || typeof tree !== 'object' ? [] : [tree, ...tree.props.children.flatMap(nodes)]
export const text = tree => tree == null || tree === false ? '' : typeof tree === 'object' ? tree.props.children.map(text).join(' ') : String(tree)
export function memoryStorage() {
  const data = new Map(), calls = []
  return { data, calls, getItem(key) { calls.push(['get', key]); return data.get(key) ?? null },
    setItem(key, value) { calls.push(['set', key]); data.set(key, value) } }
}
