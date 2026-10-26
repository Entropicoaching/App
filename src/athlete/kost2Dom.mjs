import { readFileSync } from 'node:fs'
import { athleteViewUrl } from './kost2Paths.mjs'
export const s = new Proxy({}, { get: () => ({}) })
export const today = () => '2026-10-26'
let cursor = 0, state = {}, overrides = {}, labels = [], effects = []
export function reset(next = {}) {
  labels = [...readFileSync(athleteViewUrl, 'utf8').matchAll(/const \[([^,]+),[^\]]+\] = useState\(/g)].map(m => m[1])
  state = {}; overrides = { athlete: { id: 'synthetic-a' }, loading: false, onboardingDone: true, ...next }
}
export function begin() { cursor = 0; effects = [] }
export function useState(initial) {
  const name = labels[cursor++]
  if (!Object.hasOwn(state, name)) state[name] = Object.hasOwn(overrides, name) ? overrides[name] : typeof initial === 'function' ? initial() : initial
  return [state[name], value => { state[name] = typeof value === 'function' ? value(state[name]) : value }]
}
export const useRef = value => ({ current: value })
export const useMemo = fn => fn()
export const useEffect = fn => { effects.push(fn) }
export const h = (type, props, _unused, ...children) => ({ type, props: { ...props, children: children.flat(Infinity) } })
export const createElement = (type, props, ...children) => h(type, props, null, ...children)
export const nodes = (tree, predicate) => tree && typeof tree === 'object' ? [...(predicate(tree) ? [tree] : []), ...(tree.props?.children || []).flatMap(n => nodes(n, predicate))] : []
export const text = tree => tree == null || typeof tree === 'boolean' ? '' : typeof tree !== 'object' ? String(tree) : (tree.props?.children || []).map(text).join('')
export function stub(name) {
  const fn = props => h(name, props, null)
  Object.defineProperty(fn, 'name', { value: name })
  return fn
}
export const factory = () => new Proxy({}, { get: () => () => {} })
export const empty = () => ({})
export const noop = () => {}
