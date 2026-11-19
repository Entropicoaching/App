// Ordre 1884: minimal hook-koerer til proever, saa ProfilHoved.jsx's effekt og tilstand koeres uden DOM.
import { createElement, Fragment } from 'react'
export { createElement, Fragment }
const rt = () => globalThis[Symbol.for('PROFIL-STYRKE-1884.runtime')]
const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]))
export function useState(initial) {
  const r = rt(), i = r.idx++
  if (!(i in r.slots)) r.slots[i] = { value: typeof initial === 'function' ? initial() : initial }
  const slot = r.slots[i]
  return [slot.value, next => { slot.value = typeof next === 'function' ? next(slot.value) : next; r.dirty = true }]
}
export function useRef(current) {
  const r = rt(), i = r.idx++
  if (!(i in r.slots)) r.slots[i] = { current }
  return r.slots[i]
}
export function useMemo(fn, deps) {
  const r = rt(), i = r.idx++, slot = r.slots[i]
  if (slot && same(slot.deps, deps)) return slot.value
  r.slots[i] = { deps, value: fn() }
  return r.slots[i].value
}
export function useEffect(fn, deps) {
  const r = rt(), i = r.idx++
  const slot = r.slots[i] || (r.slots[i] = { deps: null, cleanup: null })
  if (slot.deps && same(slot.deps, deps)) return
  r.effects.push(() => { slot.cleanup?.(); slot.deps = deps; slot.cleanup = fn() })
}
export const useCallback = fn => fn
