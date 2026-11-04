// This is explicitly NOT React. Only structure/text and callback contracts are
// tested here. Real React is tested separately without this loader.
export function createElement(type, config, ...children) {
  const { key = null, ...props } = config || {}
  return { type, key, props: { ...props, children } }
}

export function expand(node) {
  if (node === null || node === undefined || typeof node !== 'object') return node
  if (typeof node.type === 'function') return expand(node.type(node.props))
  return { ...node, props: { ...node.props, children: node.props.children.flat(Infinity).map(expand) } }
}
export const nodes = tree => !tree || typeof tree !== 'object' ? []
  : [tree, ...tree.props.children.flat(Infinity).flatMap(nodes)]
export const text = tree => tree == null || typeof tree === 'boolean' ? ''
  : typeof tree !== 'object' ? String(tree) : tree.props.children.flat(Infinity).map(text).join(' ')
