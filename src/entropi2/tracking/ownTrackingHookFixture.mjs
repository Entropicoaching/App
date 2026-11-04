// Explicit synthetic hook boundary, NOT React or a reconciler. Test use only.
let slots = [], cursor = 0, pending = []
const same = (a, b) => a?.length === b?.length && a.every((v, i) => Object.is(v, b[i]))
export function begin() { cursor = 0 }
export function reset() { cleanup(); slots = []; cursor = 0; pending = [] }
export function cleanup() { for (const slot of slots) slot?.cleanup?.() }
export function flush() { for (const callback of pending.splice(0)) callback() }
export function useState(initial) {
  const i = cursor++
  if (!slots[i]) slots[i] = { value: typeof initial === 'function' ? initial() : initial }
  return [slots[i].value, value => { slots[i].value = typeof value === 'function' ? value(slots[i].value) : value }]
}
export function useMemo(factory, deps) {
  const i = cursor++
  if (!slots[i] || !same(slots[i].deps, deps)) slots[i] = { value: factory(), deps }
  return slots[i].value
}
export function useCallback(callback, deps) { return useMemo(() => callback, deps) }
export function useEffect(effect, deps) {
  const i = cursor++
  if (!slots[i] || !same(slots[i].deps, deps)) {
    const old = slots[i]
    slots[i] = { deps }
    pending.push(() => { old?.cleanup?.(); slots[i].cleanup = effect() })
  }
}
