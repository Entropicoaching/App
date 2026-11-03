import test from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'
import { fixture, today } from '../planlaegning/syntheticFixture.mjs'
register('../planlaegning/syntheticReactLoader.mjs', import.meta.url)
const { default: View } = await import('./BlockPlanView.mjs')
const nodes = n => Array.isArray(n) ? n.flatMap(nodes) : n && typeof n === 'object'
  ? [n, ...nodes(n.props?.children)] : []
const content = n => Array.isArray(n) ? n.map(content).join(' ') : n && typeof n === 'object'
  ? content(n.props?.children) : n == null || typeof n === 'boolean' ? '' : String(n)

test('OFF reads no data, clock, options or callback', () => {
  const p = Object.fromEntries(['snapshot', 'today', 'weekCount', 'edits', 'onChange'].map(k =>
    [k, { get() { throw Error('OFF access') } }]))
  const props = Object.defineProperties({}, p)
  assert.equal(View(props), null); assert.equal(View({ enabled: false }), null)
})
test('view has labelled controlled fields, week legends and clear draft status', () => {
  const tree = View({ enabled: true, snapshot: fixture(), today, onChange() {} }), ns = nodes(tree)
  assert.equal(ns.filter(n => n.type === 'fieldset').length, 4)
  assert.equal(ns.filter(n => n.type === 'legend').length, 4)
  assert.equal(ns.filter(n => n.type === 'input').length, 12)
  assert.equal(ns.filter(n => n.type === 'label').length, 12)
  assert.match(content(tree), /Ingen plan er gemt eller sendt/)
  assert.ok(ns.filter(n => n.type === 'input').every(n => !n.props.disabled))
  assert.equal(ns.some(n => n.props.dangerouslySetInnerHTML), false)
})
test('real input callbacks produce immutable controlled edits, including blank and deload', () => {
  const edits = {}, outputs = []
  const ns = nodes(View({ enabled: true, snapshot: fixture(), today, edits, onChange: x => outputs.push(x) }))
  const inputs = ns.filter(n => n.type === 'input')
  inputs[1].props.onChange({ target: { value: '12' } })
  assert.equal(outputs[0][1].lifts.Squat.sets, 12)
  inputs[1].props.onChange({ target: { value: '' } })
  assert.equal(outputs[1][1].lifts.Squat.sets, '')
  inputs[0].props.onChange({ target: { checked: true } })
  assert.equal(outputs[2][1].deload, true); assert.deepEqual(edits, {})
})
test('invalid edits stay visible for correction with an alert; missing basis has no inputs', () => {
  const tree = View({ enabled: true, snapshot: fixture(), today,
    edits: { 1: { lifts: { Squat: { sets: '' } } } }, onChange() {} })
  assert.ok(nodes(tree).some(n => n.props.role === 'alert'))
  assert.ok(nodes(tree).some(n => n.type === 'input' && n.props.value === ''))
  assert.equal(nodes(View({ enabled: true, snapshot: {}, today })).filter(n => n.type === 'input').length, 0)
})
test('preview disables controls when no local adapter is supplied', () => {
  const ns = nodes(View({ enabled: true, snapshot: fixture(), today }))
  assert.ok(ns.filter(n => n.type === 'input').every(n => n.props.disabled))
})
