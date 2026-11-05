// Test fixture: a synthetic host tree with clickable handlers, never React or layout.
export const h = (tag, props, ...children) => ({ tag, props: props ?? {},
  children: children.flat(Infinity).filter(c => c != null && typeof c !== 'boolean') })
export const nodes = tree => tree && typeof tree === 'object' ? [tree, ...tree.children.flatMap(nodes)] : []
export const text = tree => tree == null || typeof tree === 'boolean' ? ''
  : typeof tree === 'object' ? tree.children.map(text).join(' ') : String(tree)
export const buttons = tree => nodes(tree).filter(n => n.tag === 'button')
export function click(tree, label) {
  const node = buttons(tree).find(n => text(n) === label)
  if (!node) throw Error(`Missing button: ${label}`)
  if (node.props.disabled) return false
  return node.props.onClick()
}
export const options = [
  { key: 'synthetic-squat-1', exercise_id: 'synthetic-squat', exercise_name: 'Squat', set_number: 1, reps: 3, load_kg: 80 },
  { key: 'synthetic-bench-2', exercise_id: 'synthetic-bench', exercise_name: 'Bænkpres', set_number: 2, reps: 2, load_kg: 50 },
  { key: 'synthetic-deadlift-3', exercise_id: 'synthetic-deadlift', exercise_name: 'Dødløft', set_number: 3, reps: 1, load_kg: 100 },
]
export function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
export function fakeClock() {
  let id = 0
  const timers = new Map()
  return { timers, set(fn) { timers.set(++id, fn); return id }, clear(key) { timers.delete(key) },
    expire() { for (const fn of [...timers.values()]) fn() } }
}
