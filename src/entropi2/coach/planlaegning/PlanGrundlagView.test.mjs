import test from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'
import { fixture, today } from './syntheticFixture.mjs'
register('./syntheticReactLoader.mjs', import.meta.url)
const { default: View } = await import('./PlanGrundlagView.mjs')
const nodes = n => Array.isArray(n) ? n.flatMap(nodes) : n && typeof n === 'object'
  ? [n, ...nodes(n.props?.children)] : []
const content = n => Array.isArray(n) ? n.map(content).join(' ') : n && typeof n === 'object'
  ? content(n.props?.children) : n == null || typeof n === 'boolean' ? '' : String(n)

test('OFF returns before reading snapshot or clock', () => {
  const props = { get snapshot() { throw Error('OFF snapshot read') }, get today() { throw Error('OFF clock read') } }
  assert.equal(View(props), null); assert.equal(View({ ...{ enabled: false }, get snapshot() { throw Error('read') } }), null)
})

test('enabled view exposes all requested data through semantic read-only elements', () => {
  const p = fixture(), before = structuredClone(p), tree = View({ enabled: true, snapshot: p, today })
  const ns = nodes(tree), t = content(tree)
  for (const label of ['Observationer', 'Registreret gennemførelse', 'Kropsvægt', 'Smerte- og stopnoter', 'e1RM', 'RPE']) assert.ok(t.includes(label))
  assert.equal(ns.filter(n => n.type === 'table').length, 4)
  assert.equal(ns.filter(n => n.type === 'caption').length, 4)
  assert.equal(ns.filter(n => n.type === 'th' && n.props.scope === 'col').length, 20)
  assert.equal(ns.filter(n => n.type === 'button' || n.type === 'input').length, 0)
  assert.deepEqual(p, before)
})

test('missing and empty bases render different messages; no strength zero invented', () => {
  const p = fixture(); p.logs.rows = []
  const empty = content(View({ enabled: true, snapshot: p, today }))
  assert.match(empty, /Ingen noter i det komplette loggrundlag/)
  assert.match(empty, /Data mangler/); assert.doesNotMatch(empty, /0 kg e1RM/)
  delete p.logs
  const missing = content(View({ enabled: true, snapshot: p, today }))
  assert.match(missing, /Notegrundlaget er ikke klar/)
  assert.doesNotMatch(missing, /Ingen noter i det komplette/)
  assert.match(content(View({ enabled: true, snapshot: {}, today })), /ikke dokumenteret/)
})

test('notes render literal content with no HTML injection; unlogged session comments survive', () => {
  const p = fixture(); p.logs.rows = []
  p.plan.rows[0].sessions[0].athlete_comment = '<script>Syntetisk smerte</script>'
  const tree = View({ enabled: true, snapshot: p, today }), ns = nodes(tree)
  assert.match(content(tree), /<script>Syntetisk smerte<\/script>/)
  assert.match(content(tree), /Blokuge fra 2026-09-28/)
  assert.equal(ns.some(n => n.props.dangerouslySetInnerHTML || n.type === 'script'), false)
})

test('horizontal tables are keyboard reachable and note text wraps', () => {
  const p = fixture(); p.logs.rows[0].note = 'Syntetisk note'
  const ns = nodes(View({ enabled: true, snapshot: p, today }))
  assert.equal(ns.filter(n => n.props.role === 'region' && n.props.tabIndex === 0).length, 4)
  assert.ok(ns.some(n => n.props.style?.overflowWrap === 'anywhere'))
})
