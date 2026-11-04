import test from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'
import { fixture, freeze, today } from './syntheticFixture.mjs'
register('./syntheticReactLoader.mjs', import.meta.url)
const { default: View } = await import('./CompareWeeksView.mjs')
const nodes = n => Array.isArray(n) ? n.flatMap(nodes) : n && typeof n === 'object'
  ? [n, ...nodes(n.props?.children)] : []
const content = n => Array.isArray(n) ? n.map(content).join(' ') : n && typeof n === 'object'
  ? content(n.props?.children) : n == null || typeof n === 'boolean' ? '' : String(n)

test('OFF returns before reading any snapshot or clock', () => {
  const props = { get snapshot() { throw Error('OFF snapshot read') }, get today() { throw Error('OFF date read') } }
  for (const enabled of [undefined, false, 0, 'true']) assert.equal(View({ ...{ enabled },
    get snapshot() { return props.snapshot }, get today() { return props.today } }), null)
  assert.equal(View(), null)
})

test('actual view renders semantic tables, units, periods, neutral deltas and coverage without side effects', () => {
  const snapshot = freeze(fixture()), tree = View({ enabled: true, snapshot, today }), ns = nodes(tree), text = content(tree)
  assert.equal(ns.filter(n => n.type === 'table').length, 2)
  assert.equal(ns.filter(n => n.type === 'caption').length, 2)
  assert.equal(ns.filter(n => n.type === 'th' && n.props.scope === 'col').length, 8)
  assert.equal(ns.filter(n => n.type === 'th' && n.props.scope === 'row').length, 9)
  for (const expected of ['2026-10-26', '2026-11-01', 'foreløbig, til 2026-11-04',
    'anden minus første', '+80', 'RPE', 'kcal', 'kg', 'Protein', 'e1RM', 'entydige vejedage']) assert.ok(text.includes(expected), expected)
  assert.equal(ns.filter(n => ['input', 'button', 'a', 'form'].includes(n.type)).length, 0)
  assert.ok(ns.every(n => !n.props.dangerouslySetInnerHTML && !Object.keys(n.props).some(k => /^on[A-Z]/.test(k))))
})

test('unknown source is visibly different from empty source and invalid selection is explained', () => {
  const snapshot = fixture(); delete snapshot.first.training
  assert.match(content(View({ enabled: true, snapshot, today })), /Ukendt.*Kan ikke sammenlignes/)
  snapshot.first.training = { ...fixture().first.training, rows: [] }
  const text = content(View({ enabled: true, snapshot, today }))
  assert.match(text, /Pas med log \(pas\) 0 1 \+1/)
  assert.match(content(View({ enabled: true, snapshot: {}, today })), /Vælg to adskilte uger/)
})

test('lift names stay literal React text and inputs are never echoed as HTML or identifiers', () => {
  const snapshot = fixture(); snapshot.first.training.rows[0].exercises.name = '<script>synthetic</script>'
  const tree = View({ enabled: true, snapshot, today })
  assert.ok(content(tree).includes('<script>synthetic</script>'))
  assert.ok(!content(tree).includes(snapshot.athleteId))
  assert.ok(nodes(tree).every(n => !n.props.dangerouslySetInnerHTML))
})
