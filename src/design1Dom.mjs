// Hermetic React surface: effects are never run, so no timers or IO start.
let slots = [], cursor = 0
export function reset() { slots = []; cursor = 0 }
export function render(component, props) { cursor = 0; return component(props) }
export function useState(initial) {
  const i = cursor++
  if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial
  return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value }]
}
export const useEffect = () => {}
export const useMemo = fn => fn()
export const useRef = value => ({ current: value })
export function createElement(type, props, ...children) {
  children = children.flat(Infinity).filter(v => v !== null && v !== undefined && typeof v !== 'boolean')
  return typeof type === 'function' ? type({ ...props, children }) : { type, props: props || {}, children }
}
export const nodes = tree => tree && typeof tree === 'object' ? [tree, ...(tree.children || []).flatMap(nodes)] : []
export const text = tree => typeof tree === 'string' || typeof tree === 'number' ? String(tree) : (tree?.children || []).map(text).join(' ')
