// Synthetic React state and tree only. Effects and external I/O never run.
export const Fragment = Symbol.for('program-overblik.fragment')
let state = [], refs = [], cursor = 0, refCursor = 0
export const calls = []
export function reset() { state = []; refs = []; calls.length = 0; begin() }
export function begin() { cursor = 0; refCursor = 0 }
export function createElement(type, props, ...children) {
  return { type, props: props || {}, children: children.flat(Infinity).filter(x => x != null && x !== false && x !== true) }
}
export const h = (type, props, unused, ...children) => createElement(type, props, ...children)
export function useState(initial) {
  const index = cursor++
  if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial
  return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value }]
}
export function useRef(initial) { const index = refCursor++; return refs[index] ||= { current: initial } }
export const useEffect = () => {}
export const useMemo = fn => fn()
export const openProfile = (...args) => calls.push(args)
export const noOp = () => {}
export const emptyFactory = () => new Proxy({}, { get: () => noOp })
export const styles = new Proxy({}, { get: () => ({}) })
export const priority = () => ({ coachPriorityItems: [], coachPriorityCount: 0, videoMeasurementByAthlete: {} })
export function nodes(tree, predicate = () => true) {
  if (!tree || typeof tree !== 'object') return []
  return [...(predicate(tree) ? [tree] : []), ...(tree.children || []).flatMap(child => nodes(child, predicate))]
}
export const text = tree => tree == null ? '' : typeof tree !== 'object' ? String(tree) : (tree.children || []).map(text).join(' ')
