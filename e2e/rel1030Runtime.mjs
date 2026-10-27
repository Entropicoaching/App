export const Fragment = Symbol.for('fragment')
export function createElement(type, props, ...children) { return { type, props: { ...props, children } } }
let states = [], cursor = 0
export function reset(role = 'athlete', preview = false) {
  states = [{user:{id:'synthetic-user'}}, role, false, false, preview, 'synthetic-athlete', false]; cursor = 0
}
export function useState(initial) { const i = cursor++; return [i < states.length ? states[i] : typeof initial === 'function' ? initial() : initial, () => {}] }
export const useEffect = () => {}
export const useRef = current => ({current})
export const supabase = new Proxy({}, {get() { throw Error('Backend forbidden') }})
export const withRetry = () => { throw Error('Backend forbidden') }
export const isPasswordRecoveryUrl = () => false
export const purgeVideoCoachDraftQueues = () => { throw Error('Storage mutation forbidden') }
export const readCachedRole = () => null
export const writeCachedRole = () => { throw Error('Storage mutation forbidden') }
export const offlineAthleteSession = () => null
export const seemsOffline = () => false
export default function Boundary() {}
