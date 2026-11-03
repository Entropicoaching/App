// Minimal synthetic React host-element fixture; no hooks or side effects.
export function createElement(type, config, ...children) {
  const { key = null, ...props } = config ?? {}
  return { type, key, props, children: children.flat(Infinity).filter(c => c != null && typeof c !== 'boolean') }
}
