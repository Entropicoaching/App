// Synthetic element/hook runner, not a browser or React DOM renderer.
import assert from 'node:assert/strict'
let current
export const createElement = (type, props, ...children) => ({ type, props: { ...props, children: children.flat(Infinity).filter(x => x !== false && x != null) } })
export function useState(initial) {
  const owner = current, index = owner.cursor++
  if (!(index in owner.values)) owner.values[index] = typeof initial === 'function' ? initial() : initial
  return [owner.values[index], value => { owner.values[index] = typeof value === 'function' ? value(owner.values[index]) : value }]
}
export function useRef(initial) { return useState(() => ({ current: initial }))[0] }
// Linking the collapsed coach portal must support activation's named imports.
// Effects still fail loudly: lifecycle bodies are tested explicitly, not faked.
export const useEffect = () => { throw Error('Unexpected effect in kostMaal fixture') }
export const useSyncExternalStore = (_subscribe, snapshot, serverSnapshot) => {
  assert.equal(serverSnapshot, snapshot, 'Matching server snapshot required')
  return snapshot()
}
export function mount(Component, initialProps) {
  let props = initialProps, key = props.athlete?.id
  const owner = { values: [], cursor: 0 }
  const expand = node => {
    if (!node || typeof node !== 'object') return node
    if (typeof node.type === 'function') return expand(node.type(node.props))
    return { ...node, props: { ...node.props, children: node.props.children.map(expand) } }
  }
  return { render(next) {
    if (next) props = { ...props, ...next }
    if (key !== props.athlete?.id) { owner.values = []; key = props.athlete?.id }
    owner.cursor = 0; current = owner
    try { return expand(Component(props)) } finally { current = null }
  } }
}
export function nodes(tree, predicate) {
  if (!tree || typeof tree !== 'object') return []
  return [...(predicate(tree) ? [tree] : []), ...tree.props.children.flatMap(child => nodes(child, predicate))]
}
export function one(tree, type, name) {
  const found = nodes(tree, n => n.type === type && (name === undefined || n.props.name === name || text(n) === name))
  assert.equal(found.length, 1, `${type}: ${name ?? ''}`)
  return found[0]
}
export function text(tree) {
  if (tree == null || tree === false) return ''
  if (typeof tree !== 'object') return String(tree)
  return tree.props.children.map(text).join(' ')
}
