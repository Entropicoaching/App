export const state = { values: [], cursor: 0, effects: [], database: null }
export const Fragment = 'fragment'
export function createElement(type, props, ...children) { return { type, props: { ...props, children: children.length ? children.flat(Infinity) : props?.children || [] } } }
export const __h = (type, props, unused, ...children) => createElement(type, props, ...children)
export function useState(initial) {
  const index = state.cursor++
  if (!(index in state.values)) state.values[index] = typeof initial === 'function' ? initial() : initial
  return [state.values[index], value => { state.values[index] = typeof value === 'function' ? value(state.values[index]) : value }]
}
export const useEffect = effect => { state.effects.push(effect) }
export const useRef = value => ({ current: value })
export const useMemo = fn => fn()
export const useCallback = fn => fn
export const lazy = () => () => null
export const Suspense = Fragment
export const supabase = { from: (...args) => state.database.from(...args), rpc: () => { throw new Error('No RPC') } }
export function reset() { state.values = []; state.cursor = 0; state.effects = [] }
export function walk(node, predicate) {
  if (!node || typeof node !== 'object') return []
  return [...(predicate(node) ? [node] : []), ...(node.props?.children || []).flatMap(n => walk(n, predicate))]
}
export function text(node) { return node == null || node === false ? '' : typeof node === 'object' ? (node.props?.children || []).map(text).join(' ') : String(node) }

export const withRetry = run => run()
