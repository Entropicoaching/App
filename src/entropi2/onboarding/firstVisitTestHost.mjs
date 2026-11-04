// Test-only hook/element host. No React reconciler, browser, layout or network.
// The real React contract is tested separately without this substitution.
let active
export const createElement = (type, props, ...children) => ({ type, props: props ?? {}, children: children.flat(Infinity) })
export function useState(initial) {
  const { slots, host } = active, index = active.index++
  if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial
  return [slots[index], value => {
    slots[index] = typeof value === 'function' ? value(slots[index]) : value
    host.dirty = true
  }]
}
export const useRef = value => useState(() => ({ current: value }))[0]
export function useEffect(callback, deps) {
  const { slots, host } = active, index = active.index++
  const prior = slots[index]
  if (!prior || deps.some((value, i) => !Object.is(value, prior.deps[i]))) {
    const effect = { deps, cleanup: prior?.cleanup }
    slots[index] = effect
    host.effects.push(() => { effect.cleanup?.(); effect.cleanup = callback() })
  }
}
export function createHost(Component, props) {
  const scopes = new Map(), nodes = new Map()
  const cleanup = slots => slots.forEach(slot => slot?.cleanup?.())
  const host = { props, tree: null, effects: [], dirty: false, focus: null,
    render(props = host.props) {
      host.props = props
      let attempts = 0, seen
      do {
        if (++attempts > 10) throw Error('Synthetic render did not settle')
        host.dirty = false
        seen = new Set()
        const visit = (node, path) => {
          if (node == null || typeof node !== 'object') return node
          if (typeof node.type === 'function') {
            const scope = `${path}/${node.type.name}:${node.props.key ?? ''}`
            seen.add(scope)
            if (!scopes.has(scope)) scopes.set(scope, [])
            active = { slots: scopes.get(scope), index: 0, host }
            return visit(node.type(node.props), scope)
          }
          let element = nodes.get(path)
          if (!element || element.type !== node.type) {
            element = { focus() { host.focus = this } }
            nodes.set(path, element)
          }
          Object.assign(element, node, { children: node.children.map((child, i) => visit(child, `${path}/${i}`)) })
          if (node.props.ref) node.props.ref.current = element
          return element
        }
        host.tree = visit(createElement(Component, props), 'root')
      } while (host.dirty)
      active = null
      for (const [scope, slots] of scopes) if (!seen.has(scope)) { cleanup(slots); scopes.delete(scope) }
      for (const run of host.effects.splice(0)) run()
      return host.tree
    },
    unmount() { for (const slots of scopes.values()) cleanup(slots); scopes.clear(); host.tree = null },
  }
  host.render()
  return host
}
export const descendants = node => node == null || typeof node !== 'object' ? [] : [node, ...node.children.flatMap(descendants)]
export const textContent = node => node == null || typeof node === 'boolean' ? ''
  : typeof node === 'object' ? node.children.map(textContent).join(' ') : String(node)
