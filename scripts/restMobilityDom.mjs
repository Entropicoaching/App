export function createElement(type, props, ...children) { return { type, props: { ...props, children: children.flat(Infinity) } } }
export function h(type, props, unused, ...children) { return createElement(type, props, ...children) }
export function useState(value) { return [typeof value === 'function' ? value() : value, () => {}] }
export const useEffect = () => {}
export const useRef = value => ({ current: value })
export function expand(node) {
  if (node == null || typeof node === 'boolean') return null
  if (typeof node !== 'object') return String(node)
  if (typeof node.type === 'function') return expand(node.type(node.props))
  return { ...node, props: { ...node.props, children: node.props.children.map(expand).filter(x => x !== null) } }
}
export const nodes = (tree, predicate) => tree && typeof tree === 'object' ? [...(predicate(tree) ? [tree] : []), ...tree.props.children.flatMap(n => nodes(n, predicate))] : []
export const text = tree => tree == null ? '' : typeof tree !== 'object' ? String(tree) : tree.props.children.map(text).join(' ')
const weekdays = ['Mandag','Tirsdag','Onsdag','Torsdag','Fredag','Lørdag','Søndag']
export function stub(name) {
  if (name === 's') return new Proxy({}, { get: () => ({}) })
  if (name === 'WEEKDAYS_LONG') return weekdays
  if (name === 'WEEKDAYS_SHORT') return weekdays.map(s => s.slice(0,3))
  if (name === 'blockWeeks' || name === 'exerciseViewRows' || name === 'exerciseViewGroups') return () => []
  if (name === 'weekStartDate') return () => new Date('2026-10-26T12:00:00')
  if (name === 'exerciseSetView') return name => ({ name })
  if (name === 'dinUge') return () => ({})
  if (name === 'isMainLift' || name === 'dataEnoughEnabled' || name === 'shouldNudgeCheckin') return () => false
  if (name === 'today') return () => '2026-10-29'
  return () => null
}
