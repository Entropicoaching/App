// Explicit synthetic import fixture, NOT React or a reconciler. Only verifies
// the actual component's key, scope checks and snapshot/action routing.
export function createElement(type, config, ...children) {
  const { key = null, ...props } = config ?? {}
  return { type, key, props: { ...props, children: children.flat(Infinity).filter(x => x != null && x !== false) } }
}
export function useSyncExternalStore(subscribe, snapshot, serverSnapshot) {
  if (typeof subscribe !== 'function' || snapshot !== serverSnapshot) throw Error('Invalid store binding')
  return snapshot()
}
