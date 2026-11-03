// Test-only hook/element host. This makes no browser layout or ReactDOM claims.
let active
export const createElement = (type, props, ...children) => ({ type, props: props ?? {}, children: children.flat(Infinity) })
export function useState(initial) {
  const { slots, host } = active
  const index = active.index++
  if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial
  return [slots[index], value => {
    slots[index] = typeof value === 'function' ? value(slots[index]) : value
    host.dirty = true
  }]
}
export function useId() {
  return useState(() => `synthetic-${active.host.nextId++}`)[0]
}
export function createHost(Component, initialProps) {
  const states = new Map()
  const host = { props: initialProps, nextId: 1, dirty: false, tree: null,
    render(props = host.props) {
      host.props = props
      let attempts = 0
      do {
        if (++attempts > 10) throw new Error('Synthetic render did not settle')
        host.dirty = false
        const seen = new Set()
        const visit = (node, path) => {
          if (node == null || typeof node !== 'object') return node
          if (typeof node.type === 'function') {
            const scope = `${path}/${node.type.name}:${node.props.key ?? ''}`
            seen.add(scope)
            if (!states.has(scope)) states.set(scope, [])
            active = { slots: states.get(scope), index: 0, host }
            return visit(node.type(node.props), scope)
          }
          return { ...node, children: node.children.map((child, index) => visit(child, `${path}/${index}`)) }
        }
        host.tree = visit(createElement(Component, props), 'root')
        for (const key of states.keys()) if (!seen.has(key)) states.delete(key)
      } while (host.dirty)
      active = null
      return host.tree
    },
  }
  host.render()
  return host
}
export function descendants(node) {
  if (node == null || typeof node !== 'object') return []
  return [node, ...node.children.flatMap(descendants)]
}
export function textContent(node) {
  if (node == null) return ''
  return typeof node === 'object' ? node.children.map(textContent).join(' ') : String(node)
}
export function memoryStorage() {
  const data = new Map([['unrelated-key', 'preserved']])
  const calls = []
  return { data, calls,
    getItem(key) { calls.push(['get', key]); return data.get(key) ?? null },
    setItem(key, value) { calls.push(['set', key]); data.set(key, value) },
    removeItem(key) { calls.push(['remove', key]); data.delete(key) },
  }
}
