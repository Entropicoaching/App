import { h } from './vaerd5Dom.mjs'
export const createElement = (type, props, ...children) => h(type, props, null, ...children)
export { useState, s } from './vaerd5Dom.mjs'
export const SMERTE_LINJE = 'synthetic pain notice'
export function useRef(value) { return { current: value } }
export function useEffect(run, deps) {
  // Exercise only the program's guarded OFF effects; timers remain forbidden.
  const legacyReadOff = deps?.length === 6 && deps[0] !== true && Array.isArray(deps[1])
  const readOff = deps?.length === 7 && deps[0] !== true && Array.isArray(deps[2])
  const restoreOff = deps?.length === 4 && deps[0] === null && Array.isArray(deps[2])
  const jumpOff = deps?.length === 7 && deps[0] !== true && deps[1] === null
  if (legacyReadOff || readOff || restoreOff || jumpOff) { run(); return }
  throw new Error('Timer effects outside this synthetic scope')
}
export default function CountdownRing() { throw new Error('Timer outside this synthetic scope') }
