// Synthetic React surface, no DOM/browser/network dependencies.
export function createElement(type, props, ...children) {
  children = children.flat(Infinity).filter(x => x !== null && x !== undefined && typeof x !== 'boolean')
  return typeof type === 'function' ? type({ ...props, children }) : { type, props: props || {}, children }
}
let slots = [], cursor = 0, effects = []
const same = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]))
export function useState(initial) {
  const index = cursor++
  if (!(index in slots)) slots[index] = { value: typeof initial === 'function' ? initial() : initial }
  return [slots[index].value, value => {
    slots[index].value = typeof value === 'function' ? value(slots[index].value) : value
  }]
}
export const useRef = value => useState(() => ({ current: value }))[0]
export function useMemo(fn, deps) {
  const index = cursor++
  if (!slots[index] || !same(slots[index].deps, deps)) slots[index] = { value: fn(), deps }
  return slots[index].value
}
export function useEffect(fn, deps) {
  const index = cursor++
  if (!slots[index] || !same(slots[index].deps, deps)) {
    const previous = slots[index]
    slots[index] = { deps }
    effects.push(() => { previous?.cleanup?.(); slots[index].cleanup = fn() })
  }
}
export function render(component, props) { cursor = 0; return component(props) }
export function flush() { effects.splice(0).forEach(fn => fn()) }
export function reset() { slots.forEach(slot => slot.cleanup?.()); slots = []; cursor = 0; effects = [] }
export const nodes = tree => tree && typeof tree === 'object' ? [tree, ...(tree.children || []).flatMap(nodes)] : []
export const text = tree => typeof tree === 'string' || typeof tree === 'number' ? String(tree) : (tree?.children || []).map(text).join(' ')
