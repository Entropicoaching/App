// Minimal synthetic React/DOM lifecycle. Does not claim browser rendering fidelity.
let active
export const createElement = (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity).filter(x => x !== false && x != null) })
export function useState(initial) {
  const runtime = active, i = runtime.cursor++
  if (!(i in runtime.slots)) runtime.slots[i] = typeof initial === 'function' ? initial() : initial
  return [runtime.slots[i], value => { runtime.slots[i] = typeof value === 'function' ? value(runtime.slots[i]) : value }]
}
export function useRef(value) { const [ref] = useState(() => ({ current: value })); return ref }
export function useId() { return useState('synthetic-training')[0] }
export function useEffect(fn, deps) {
  const runtime = active, i = runtime.cursor++, prev = runtime.slots[i]
  if (!prev || deps.some((v, n) => !Object.is(v, prev.deps[n]))) {
    runtime.effects.push(() => { prev?.cleanup?.(); runtime.slots[i] = { deps, cleanup: fn() } })
  }
}
export class FakeNode {
  constructor(type) { this.type = type; this.listeners = new Map(); this.isConnected = true; this.open = false; this.focused = false }
  addEventListener(type, fn) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(fn) }
  removeEventListener(type, fn) { this.listeners.get(type)?.delete(fn) }
  fire(type, event = {}) { for (const fn of [...(this.listeners.get(type) || [])]) fn(event) }
  focus() { this.focused = true }
  showModal() { this.open = true }
  close() { this.open = false; this.fire('close') }
  setPointerCapture(id) { this.capture = id }
}
export function mount(Component, props) {
  const runtime = { slots: [], cursor: 0, effects: [], tree: null, props }
  runtime.render = changes => {
    if (changes) Object.assign(runtime.props, changes)
    runtime.cursor = 0; runtime.effects = []; active = runtime
    runtime.tree = Component(runtime.props)
    function refs(node) {
      if (!node || typeof node !== 'object') return
      if (node.props.ref && !node.props.ref.current) node.props.ref.current = new FakeNode(node.type)
      for (const child of node.children) refs(child)
    }
    refs(runtime.tree)
    for (const effect of runtime.effects) effect()
    return runtime.tree
  }
  runtime.nodes = (predicate) => {
    const found = []
    function walk(node) { if (!node || typeof node !== 'object') return; if (predicate(node)) found.push(node); node.children.forEach(walk) }
    walk(runtime.tree); return found
  }
  runtime.text = () => {
    const walk = node => typeof node === 'object' ? node.children.map(walk).join(' ') : String(node)
    return walk(runtime.tree)
  }
  runtime.unmount = () => { for (const slot of runtime.slots) slot?.cleanup?.() }
  runtime.render()
  return runtime
}
