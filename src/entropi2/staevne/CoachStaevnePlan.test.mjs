import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import CoachStaevnePlan from './CoachStaevnePlan.mjs'
import StaevneView from './StaevneView.mjs'

const render = (Component, props) => renderToStaticMarkup(h(Component, props))

test('coach panel is strict OFF without reading evidence or callbacks', () => {
  for (const enabled of [undefined, false, 0, 1, 'true', null]) {
    assert.equal(CoachStaevnePlan({ enabled, get meetType() { throw Error('OFF read') } }), null)
  }
})

test('coach panel starts folded, with honest empty basis and no save side effects', () => {
  const html = render(CoachStaevnePlan, { enabled: true, setMeetPlanForm() { assert.fail('render wrote plan') } })
  assert.match(html, /Forsøgsvalg og opvarmning/)
  assert.doesNotMatch(html, /<details open/)
  assert.equal((html.match(/Ingen e1RM/g) || []).length, 3)
  assert.match(html, /Gem plan/)
  assert.match(html, /midlertidige noter og gemmes ikke/)
  assert.doesNotMatch(html, /Brug squat-forslag|åbner 0|NaN/)
})

test('bench-only panel excludes squat and deadlift references and actual inputs', () => {
  const html = render(CoachStaevnePlan, { enabled: true, meetType: 'bench' })
  assert.match(html, /Bænkpres/)
  assert.doesNotMatch(html, /Squat|Dødløft/)
  assert.equal((html.match(/Faktisk vægt/g) || []).length, 3)
})

test('ready attempts offer an explicit transfer; errors offer no transfer', () => {
  const props = { enabled: true, activeLifts: ['bench'], lifts: { bench: { e1RM: 100 } }, onApplyPlan() { assert.fail('render applied') } }
  const html = render(StaevneView, props)
  assert.match(html, /åbner 90 kg · andet 95 kg · tredje 100 kg/)
  assert.match(html, /Brug bænkpres-forslag i planen/)
  assert.match(html, /Opvarmning og grundlag/)
  assert.doesNotMatch(html, /Squat|Dødløft/)
  assert.match(render(StaevneView, { ...props, applyingDisabled: true }), /disabled=""/)
  const invalid = render(StaevneView, { ...props, lifts: { bench: { e1RM: -2 } } })
  assert.match(invalid, /role="alert"/)
  assert.doesNotMatch(invalid, /Brug bænkpres-forslag/)
})
