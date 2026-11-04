// Test fixture only, NOT React. Hooks deliberately fail: this fixture exercises
// the pure view handlers, never pretends to validate hooks or reconciliation.
export function createElement(type, config, ...children) {
  const { key = null, ...props } = config || {}
  return { type, key, props: { ...props, children } }
}
const unsupported = () => { throw Error('Real React required for hooks') }
export const useEffect = unsupported, useRef = unsupported, useState = unsupported, useSyncExternalStore = unsupported
