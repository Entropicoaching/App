// Required real React gate, automatically discovered by the app's npm test.
// No fixture substitution or skip when the packages are unavailable.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import PortalPlan from './PortalPlan.mjs'
import CoachPlan from './CoachPlan.mjs'
import { createCoachPlan } from './controller.mjs'
import { syntheticInput } from './syntheticFixture.mjs'
import { s } from '../../../dashboardShared.js'

test('real React emits dark labelled fields, scoped focus CSS and primary/disabled buttons before and after generation', () => {
  const f = syntheticInput(), controller = createCoachPlan(f.options)
  const render = () => renderToStaticMarkup(h(CoachPlan, { enabled: true, controller }))
  const before = render()
  assert.match(before, /<select\b[^>]*\bname="goal"/)
  assert.match(before, /<input\b[^>]*\bname="maintenanceKcal"/)
  assert.ok(before.includes(`background:${s.fieldInput.background}`))
  assert.ok(before.includes(`color:${s.fieldInput.color}`))
  assert.match(before, /color-scheme:dark/)
  assert.match(before, /min-height:44px/)
  assert.match(before, /outline: 3px solid #c8923a/)
  assert.doesNotMatch(before, /outline:none/)
  assert.ok(before.includes(`background:${s.btnPrimary.background}`))
  controller.generate()
  const after = render()
  assert.match(after, /name="grams-0-0"/)
  assert.match(after, /name="food-0-0"/)
  assert.match(after, /disabled=""[^>]*>Aktivér for atleten/)
  assert.match(after, /:disabled[\s\S]*opacity: \.65/)
  assert.match(after, /Gram af Havre \(syntetisk\) i Morgenmad/)
  assert.equal(f.calls.length, 0)
})

test('real React preserves the collapsed portal and emits no style or markup when OFF', () => {
  const props = { enabled: true, athlete: { id: 'synthetic-a' }, today: '2026-11-05',
    session: { user: { id: 'synthetic-coach' } } }
  const html = renderToStaticMarkup(h(PortalPlan, props))
  assert.match(html, /<details\b[^>]*\bclass="e2-portal-plan"/)
  assert.match(html, /<summary[^>]*>Kostplan<\/summary><style>/)
  assert.match(html, /\.e2-portal-plan/)
  assert.doesNotMatch(html, /<form|<input|<select|<details[^>]* open/)
  assert.equal(renderToStaticMarkup(h(PortalPlan, { enabled: false })), '')
  assert.equal(renderToStaticMarkup(h(CoachPlan, { enabled: false })), '')
})
