// Eager synthetic elements reproduce the two reported hook-forbidden trees.
export const calls = { hooks: 0, filterMounts: 0 }
export function createElement(type, props, ...children) {
  children = children.flat(Infinity).filter(c => c !== false && c != null)
  if (typeof type === 'function') {
    if (type.name === 'CoachInactiveFilter') calls.filterMounts++
    return type({ ...props, children })
  }
  return { type, props: props || {}, children }
}
const forbidden = name => () => { calls.hooks++; throw Error('Unexpected ' + name + ' in OFF tree') }
export const useState = forbidden('useState')
export const useEffect = forbidden('useEffect')
export const useRef = forbidden('useRef')
export const nodes = tree => !tree || typeof tree !== 'object' ? [] : [tree, ...(tree.children || []).flatMap(nodes)]
export const text = tree => typeof tree === 'string' || typeof tree === 'number' ? String(tree) : (tree?.children || []).map(text).join(' ')
export function reset() { calls.hooks = 0; calls.filterMounts = 0 }
