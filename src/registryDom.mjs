// Stateless fallback for newly registered JSX. Stateful tests set runtime in their one module row.
export const Fragment = Symbol.for('registry.synthetic.fragment')
export function h(type, props, _unused, ...children) {
  children = children.flat(Infinity).filter(child => child != null && child !== false && child !== true)
  return typeof type === 'function' ? type({ ...props, children }) : { type, props: props || {}, children }
}
export const createElement = (type, props, ...children) => h(type, props, null, ...children)
export const useMemo = fn => fn()
export const useRef = current => ({ current })
