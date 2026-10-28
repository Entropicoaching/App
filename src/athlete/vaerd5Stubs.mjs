import { h } from './vaerd5Dom.mjs'
export const createElement = (type, props, ...children) => h(type, props, null, ...children)
export { useState, s } from './vaerd5Dom.mjs'
export const SMERTE_LINJE = 'synthetic pain notice'
export function useRef(value) { return { current: value } }
export function useEffect(run, deps) {
  // APP-PROG3 adds an effect with an OFF guard; exercise that guard here.
  if (deps?.length === 6 && deps[0] !== true && Array.isArray(deps[1])) { run(); return }
  throw new Error('Timer effects outside this synthetic scope')
}
export default function CountdownRing() { throw new Error('Timer outside this synthetic scope') }
