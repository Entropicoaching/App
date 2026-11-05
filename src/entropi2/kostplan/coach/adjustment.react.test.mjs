// Required real React gate in the app's own npm test. No substitute or skip.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import Host from '../../kostMaalKobling.mjs'
import { PortalKostJustering } from './PortalPlan.mjs'
import KostJustering from '../justering/KostJustering.mjs'
import { portalAdjustment, choosePortalAdjustment } from './adjustment.mjs'
import { adjustmentFixture, hostProps, ago } from './adjustment.fixture.mjs'

test('real React host shows a scoped proposal with trend, adherence and readiness, ahead of the folded editor', () => {
  const f = adjustmentFixture(), props = hostProps(f), before = structuredClone(props)
  const html = renderToStaticMarkup(h(Host, props))
  assert.match(html, /Kostmål[\s\S]*Ugens kostjustering[\s\S]*Kostplan/)
  for (const value of ['−140', '2.660', 'Vægttrend', '27 bekræftede kostdage', 'energi 3/5, sult 3/5', 'Acceptér forslag', 'min-height:44px']) assert.ok(html.includes(value), value)
  assert.doesNotMatch(html, /<details[^>]* open|NaN|undefined|Infinity/)
  assert.deepEqual(props, before)
  const child = Host(props).props.children.find(n => n.type === PortalKostJustering)
  assert.equal(child.props.nutritionRead, f.receipt)
})

test('real React hides unavailable evidence and supports explicit unknown readiness without inventing data', () => {
  for (const change of [f => { delete f.receipt.adjustmentBasis }, f => { f.receipt.from = ago(6) },
    f => { f.receipt.complete = false }, f => { f.receipt.coachId = 'foreign' },
    f => { f.receipt.weightLogs = [] }, f => { f.receipt.mealLogs = [] }]) {
    const f = adjustmentFixture(); change(f)
    assert.doesNotMatch(renderToStaticMarkup(h(Host, hostProps(f))), /Ugens kostjustering|Acceptér forslag|Ugevurderingen/)
  }
  const f = adjustmentFixture(); delete f.receipt.adjustmentBasis.readiness
  assert.match(renderToStaticMarkup(h(Host, hostProps(f))), /Dagsform: ikke registreret/)
  for (const Component of [Host, PortalKostJustering]) {
    assert.equal(Component({ enabled: false, get nutritionRead() { throw Error('OFF') } }), null)
  }
})

test('real React proposal action delegates to the actual decision model and produces only a local candidate', () => {
  const f = adjustmentFixture(), before = structuredClone(f), s = portalAdjustment(f).snapshot
  let result
  const tree = KostJustering({ enabled: true, snapshot: s,
    onDecision: (decision, shown) => { result = choosePortalAdjustment(f, shown, decision) } })
  const walk = n => !n || typeof n !== 'object' ? [] : [n, ...[n.props.children].flat(Infinity).flatMap(walk)]
  walk(tree).find(n => n.type === 'button' && n.props.children === 'Acceptér forslag').props.onClick()
  assert.equal(result.plan.kcal, 2660); assert.equal(result.record.decision, 'accept')
  const html = renderToStaticMarkup(h(KostJustering, { enabled: true, snapshot: result.snapshot }))
  assert.match(html, /Accepteret i kladden/); assert.doesNotMatch(html, /<button/)
  assert.deepEqual(f, before)
})
