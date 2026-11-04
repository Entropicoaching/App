// Synthetic element probe only; not React, effects or a DOM implementation.
export function createElement(type, props, ...children) {
  return { type, props: { ...props }, children: children.flat(Infinity).filter(x => x != null && typeof x !== 'boolean') }
}
export function expand(tree) {
  if (!tree || typeof tree !== 'object') return tree
  if (typeof tree.type === 'function') return expand(tree.type({ ...tree.props, children: tree.children }))
  return { ...tree, children: tree.children.map(expand) }
}
export const nodes = tree => !tree || typeof tree !== 'object' ? [] : [tree, ...tree.children.flatMap(nodes)]
export const text = tree => !tree ? '' : typeof tree !== 'object' ? String(tree) : tree.children.map(text).join(' ')
export const s = {}
export const readinessSignal = () => ({})
export const dataEnoughEnabled = () => false
export const dataAllowed = () => false
export const dataMessage = () => ''
export const BlokFremgang = () => null
export const LazyBoundary = () => null
let flag = true
export const setFlag = value => { flag = value }
export const entropi2Enabled = () => flag
