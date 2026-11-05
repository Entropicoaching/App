// Synthetic hook host for actual QuickLogs. No React/browser/layout claims.
// Reconcile element identities and detach refs before effects, including when
// the fast form disappears; focusing a detached node is an assertion failure.
let active
export const createElement = (type, props, ...children) => ({ type, props: props ?? {},
  children: children.flat(Infinity).filter(child => child != null && typeof child !== 'boolean') })
export function useState(initial) {
  const host = active, index = host.cursor++
  if (!(index in host.slots)) host.slots[index] = typeof initial === 'function' ? initial() : initial
  return [host.slots[index], value => {
    host.slots[index] = typeof value === 'function' ? value(host.slots[index]) : value
  }]
}
export const useRef = value => useState(() => ({ current: value }))[0]
export const useId = () => useState('synthetic-readiness-focus')[0]
export function useEffect(callback, deps) {
  const host = active, index = host.cursor++, previous = host.slots[index]
  if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) {
    host.effects.push(() => {
      previous?.cleanup?.()
      host.slots[index] = { deps, cleanup: callback() }
    })
  }
}
export const descendants = node => typeof node !== 'object' || node == null ? []
  : [node, ...node.children.flatMap(descendants)]
export const text = node => typeof node === 'object' && node != null ? node.children.map(text).join('') : String(node ?? '')
export function mount(Component, props) {
  const host = { slots: [], cursor: 0, effects: [], props, tree: null, focus: null, focusCalls: [] }
  let mounted = new Map()
  const detach = node => {
    node.isConnected = false
    if (node.props.ref?.current === node) node.props.ref.current = null
    if (host.focus === node) host.focus = null
  }
  host.render = changes => {
    Object.assign(props, changes)
    active = host; host.cursor = 0; host.effects = []
    const tree = Component(props), next = new Map(), refs = []
    const commit = (description, path) => {
      if (description == null || typeof description !== 'object') return description
      const identity = `${path}:${description.type}:${description.props.key ?? ''}`
      const node = mounted.get(identity) ?? { focus() {
        if (!this.isConnected) throw Error('Attempted focus on an unmounted node')
        host.focus = this; host.focusCalls.push(this)
      } }
      const oldRef = node.props?.ref
      if (oldRef && oldRef !== description.props.ref && oldRef.current === node) oldRef.current = null
      Object.assign(node, description, { isConnected: true })
      node.children = description.children.map((child, i) => commit(child, `${identity}/${i}`))
      next.set(identity, node)
      if (description.props.ref) refs.push([description.props.ref, node])
      return node
    }
    host.tree = commit(tree, 'root')
    for (const [identity, node] of mounted) if (!next.has(identity)) detach(node)
    mounted = next
    for (const [ref, node] of refs) ref.current = node
    active = null
    for (const effect of host.effects) effect()
    return host.tree
  }
  host.nodes = predicate => descendants(host.tree).filter(predicate)
  host.button = label => host.nodes(node => node.type === 'button' &&
    (node.props['aria-label'] === label || text(node) === label))[0]
  host.click = label => {
    const node = host.button(label)
    if (!node || node.props.disabled) throw Error(`Missing enabled button: ${label}`)
    node.focus(); node.props.onClick({ currentTarget: node }); host.render()
    return node
  }
  host.unmount = () => {
    for (const slot of host.slots) slot?.cleanup?.()
    for (const node of mounted.values()) detach(node)
    mounted.clear(); host.tree = null
  }
  host.render()
  return host
}
