export { useState, s } from './vaerd5Dom.mjs'
export const SMERTE_LINJE = 'synthetic pain notice'
export function useRef(value) { return { current: value } }
export function useEffect() { throw new Error('Timer effects outside this synthetic scope') }
export default function CountdownRing() { throw new Error('Timer outside this synthetic scope') }
