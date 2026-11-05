// Required real React boundary test, also discovered by the app's npm test.
// Synthetic receipts only; no dependency substitutes and no skipped failures.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import CoachKostMaal from '../../kostMaalKobling.mjs'
import PortalPlan, { PortalNutritionReport } from './PortalPlan.mjs'
import { input, coach, athleteId } from '../rapport/reportFixture.mjs'

const props = { enabled: true, athlete: { id: athleteId }, today: '2026-11-08',
  session: { user: { id: coach.id } }, weightStatus: { athleteId, state: 'ready', rows: [] } }
const receipt = () => ({ ...input(), coachId: coach.id, state: 'ready', complete: true })

test('real React host and portal preserve receipt identity through the actual component boundary', () => {
  const nutritionRead = receipt(), before = structuredClone(nutritionRead)
  const host = CoachKostMaal({ ...props, nutritionRead })
  const portal = host.props.children.find(child => child.type === PortalPlan)
  assert.equal(portal.props.nutritionRead, nutritionRead)
  const scoped = PortalPlan(portal.props)
  assert.equal(scoped.props.nutritionRead, nutritionRead)
  // SSR starts with the plan folded. Render the actual report with precisely
  // the props delivered to that scope; opening/re-rendering is tested separately.
  const html = renderToStaticMarkup(h(PortalNutritionReport, { ...scoped.props, enabled: true }))
  assert.match(html, /Plan og registreret kost/)
  assert.match(html, /3.500 kcal/)
  assert.match(html, /4.000 kcal plan for loggede dage/)
  assert.doesNotMatch(html, /<details[^>]* open/)
  const folded = renderToStaticMarkup(h(CoachKostMaal, { ...props, nutritionRead }))
  assert.match(folded, /Kostplan/)
  assert.doesNotMatch(folded, /Plan og registreret kost/)
  assert.deepEqual(nutritionRead, before)
})

test('real React host OFF reads no nutrition receipt', () => {
  for (const enabled of [undefined, false, 'true', 1]) {
    assert.equal(CoachKostMaal({ enabled, get nutritionRead() { throw Error('OFF receipt') } }), null)
    assert.equal(renderToStaticMarkup(h(CoachKostMaal, { enabled })), '')
  }
})
