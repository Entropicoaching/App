export const input = (overrides = {}) => ({
  asOf: '2026-11-01', competitionDate: '2026-11-30', weighInHours: 24,
  weightKg: 80, weightClassKg: 78, adult: true, healthReviewed: true, ...overrides,
})

// Small inspectable element fixture for hermetic view-contract checks only.
// The separate *.react.test.mjs imports real React and is never skipped.
export function element(type, props, ...children) {
  return { type, props: props ?? {}, children: children.flat(Infinity).filter(value => value !== false && value != null) }
}
export function nodes(tree) {
  if (!tree || typeof tree !== 'object') return []
  return [tree, ...tree.children.flatMap(nodes)]
}
export function text(tree) {
  if (tree == null || tree === false) return ''
  return typeof tree === 'object' ? tree.children.map(text).join(' ') : String(tree)
}
