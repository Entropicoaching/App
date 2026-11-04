import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { evaluateAdjustment, decideAdjustment } from './model.mjs'
import { actor, on, setup } from './fixture.mjs'

// Explicit element fixture only, scoped to this one view in this test worker.
// Does not validate React reconciliation/DOM and never replaces real-React tests.
const hook = registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === 'react' && context.parentURL === new URL('./KostJustering.mjs', import.meta.url).href) {
    return { url: new URL('../atlet/syntheticReact.mjs', import.meta.url).href, shortCircuit: true }
  }
  return nextResolve(specifier, context)
} })
const { default: View } = await import('./KostJustering.mjs')
hook.deregister()
const nodes = n => !n || typeof n !== 'object' ? [] : [n, ...[n.props.children].flat(Infinity).flatMap(nodes)]
const text = n => n == null || typeof n === 'boolean' ? '' : typeof n !== 'object' ? String(n)
  : [n.props.children].flat(Infinity).map(text).join(' ')
const view = (snapshot, props = {}) => View({ enabled: true, snapshot, ...props })

test('synthetic: strict OFF never reads snapshot or handlers', () => {
  for (const enabled of [undefined, false, null, 1, 'true']) assert.equal(View({ enabled,
    get snapshot() { throw Error('OFF snapshot') }, get onDecision() { throw Error('OFF callback') } }), null)
})

test('synthetic: summary first, evidence collapsed, unknown intake honest and mobile controls', () => {
  const tree = view(evaluateAdjustment(setup()), { onDecision() {} }), s = text(tree)
  for (const expected of ['−140', '2.800 → 2.660', '28 gyldige dage', '2.800 kcal/dag', '-0,5 %/uge', 'moderat']) assert.ok(s.includes(expected), expected)
  const disclosure = nodes(tree).find(n => n.type === 'details')
  assert.equal(disclosure.props.open, undefined)
  assert.ok(nodes(tree).filter(n => ['button', 'summary'].includes(n.type)).every(n => n.props.style.minHeight >= 44))
  assert.doesNotMatch(s, /NaN|Infinity|undefined/)
  const empty = text(view(evaluateAdjustment(setup({}, { weights: [], dietDays: [], training: undefined }))))
  assert.match(empty, /Observeret trend: ukendt/); assert.match(empty, /Faktisk gennemsnit: ukendt/)
  assert.match(empty, /Træningsvolumen: ukendt/)
})

test('synthetic: actual click handlers accept/reject through the actual model and remove decision buttons', () => {
  for (const decision of ['accept', 'reject']) {
    const input = setup(), s = evaluateAdjustment(input)
    let result
    const tree = view(s, { onDecision(choice, proposal) {
      result = decideAdjustment(proposal, { ...input, actor, decision: choice, on })
    } })
    const buttons = nodes(tree).filter(n => n.type === 'button')
    buttons[decision === 'accept' ? 0 : 1].props.onClick()
    assert.equal(result.record.decision, decision)
    assert.equal(nodes(view(result.snapshot)).filter(n => n.type === 'button').length, 0)
    assert.match(text(view(result.snapshot)), /kladden/)
  }
})

test('synthetic: pending/missing adapter block callbacks and errors hide stale proposals', () => {
  const s = evaluateAdjustment(setup())
  let calls = 0
  const pending = view(s, { pending: true, onDecision() { calls++ } })
  for (const button of nodes(pending).filter(n => n.type === 'button')) {
    assert.equal(button.props.disabled, true); button.props.onClick()
  }
  assert.equal(calls, 0)
  const absent = view(s)
  assert.match(text(absent), /Beslutninger er ikke tilsluttet/)
  assert.ok(nodes(absent).filter(n => n.type === 'button').every(n => n.props.disabled))
  const error = view(s, { error: true, onDecision() { calls++ } })
  assert.ok(nodes(error).some(n => n.props.role === 'alert'))
  assert.equal(nodes(error).filter(n => n.type === 'button').length, 0)
})

test('synthetic: no active plan, floor review and data hold expose no decision buttons', () => {
  for (const input of [setup({ kcal: 1500 }), setup({}, { weights: [] }), { enabled: true, plan: null }]) {
    assert.equal(nodes(view(evaluateAdjustment(input))).filter(n => n.type === 'button').length, 0)
  }
  assert.match(text(view(evaluateAdjustment({ enabled: true, plan: null }))), /ingen aktiv kostplan/)
})
