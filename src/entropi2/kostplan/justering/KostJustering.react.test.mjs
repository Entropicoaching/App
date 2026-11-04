// App npm test discovers this file. No fake React, loader, conditional skip or
// swallowed dependency failure: real React is an explicit integration gate.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h, isValidElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import View from './KostJustering.mjs'
import { evaluateAdjustment, decideAdjustment } from './model.mjs'
import { actor, on, setup } from './fixture.mjs'

const nodes = n => !isValidElement(n) ? [] : [n, ...[n.props.children].flat(Infinity).flatMap(nodes)]
const render = (snapshot, props = {}) => renderToStaticMarkup(h(View, { enabled: true, snapshot, ...props }))

test('real React: strict OFF never reads poisoned dependencies', () => {
  for (const enabled of [false, undefined, null, 1, 'true']) {
    assert.equal(renderToStaticMarkup(h(View, { enabled,
      snapshot: new Proxy({}, { get() { throw Error('OFF read') } }) })), '')
  }
})

test('real React: mobile controls, collapsed details, escaped text and explicit unknowns', () => {
  const s = evaluateAdjustment(setup()); s.reason += ' <synthetic>'
  const html = render(s, { onDecision() {} })
  for (const text of ['−140', '2.660', 'Acceptér forslag', 'Afvis forslag', 'min-height:44px', '&lt;synthetic&gt;']) assert.ok(html.includes(text), text)
  assert.match(html, /<details><summary/); assert.doesNotMatch(html, /<details open/)
  assert.doesNotMatch(html, /NaN|Infinity|undefined|<synthetic>/)
  assert.match(render(evaluateAdjustment(setup({}, { dietDays: [] }))), /Faktisk gennemsnit: ukendt/)
})

test('real React: actual handlers produce accepted/rejected candidates, rerender with no further actions', () => {
  for (const decision of ['accept', 'reject']) {
    const input = setup(), snapshot = evaluateAdjustment(input)
    let result
    const tree = View({ enabled: true, snapshot, onDecision(choice, proposal) {
      result = decideAdjustment(proposal, { ...input, actor, decision: choice, on })
    } })
    nodes(tree).filter(n => n.type === 'button')[decision === 'accept' ? 0 : 1].props.onClick()
    assert.equal(result.record.decision, decision)
    const html = render(result.snapshot)
    assert.match(html, /kladden/); assert.doesNotMatch(html, /<button/)
  }
})

test('real React: pending, unavailable adapter, missing plan and save error cannot expose enabled actions', () => {
  const s = evaluateAdjustment(setup())
  const pending = render(s, { pending: true, onDecision() { throw Error('must not call while rendering') } })
  assert.match(pending, /aria-busy="true"/); assert.equal((pending.match(/disabled=""/g) || []).length, 2)
  assert.match(render(s), /Beslutninger er ikke tilsluttet/)
  assert.doesNotMatch(render(s, { error: true }), /<button/)
  assert.match(render(s, { error: true }), /role="alert"/)
  assert.match(render(evaluateAdjustment({ enabled: true, plan: null })), /ingen aktiv kostplan/)
})
