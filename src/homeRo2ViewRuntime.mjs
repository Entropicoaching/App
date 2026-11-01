// Named synthetic state injection. Effects and backend factories never execute.
export { createElement } from './homeRo2Dom.mjs'
let names = [], values = {}, cursor = 0
export function reset(stateNames, overrides = {}) {
  names = stateNames
  values = { athlete: { id: 'synthetic-athlete' }, loading: false, onboardingDone: true, ...overrides }
  cursor = 0
}
export function begin() { cursor = 0 }
export function state() { return { ...values } }
export function useState(initial) {
  const name = names[cursor++]
  if (!name) throw Error('Unexpected synthetic hook')
  if (!Object.hasOwn(values, name)) values[name] = typeof initial === 'function' ? initial() : initial
  return [values[name], value => { values[name] = typeof value === 'function' ? value(values[name]) : value }]
}
export const useRef = current => ({ current })
export const useEffect = () => {}
export const useMemo = fn => fn()
