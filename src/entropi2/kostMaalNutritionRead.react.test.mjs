// Required real React gate, discovered by npm test. No substitutes or skips.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import CoachKostMaal, { kostMaalNutritionRead } from './kostMaalKobling.mjs'
import PortalPlan, { PortalNutritionReport } from './kostplan/coach/PortalPlan.mjs'
import { input, coach, athleteId } from './kostplan/rapport/reportFixture.mjs'

test('real React consumes the host receipt but cannot display a report without saved history', () => {
  const data = input()
  const props = { enabled: true, athlete: { id: athleteId }, today: data.date,
    session: { user: { id: coach.id } },
    readContext: { coachId: coach.id, day: data.date, athleteIds: [athleteId] },
    coachNutrition: { coachId: coach.id, day: data.date, athleteIds: [athleteId],
      from: '2026-11-02', through: data.date, state: 'ready', complete: true, targets: [], rows: data.mealLogs },
    weightStatus: { athleteId, state: 'ready', rows: [...data.weightLogs].reverse() } }
  const host = CoachKostMaal(props)
  const portal = host.props.children.find(child => child.type === PortalPlan)
  assert.deepEqual(portal.props.nutritionRead, kostMaalNutritionRead(props))
  const scoped = PortalPlan(portal.props)
  assert.equal(renderToStaticMarkup(h(PortalNutritionReport, { ...scoped.props, enabled: true })), '')
  assert.match(renderToStaticMarkup(h(CoachKostMaal, props)), /Kostplan/)
  const nutritionRead = { ...data, coachId: coach.id, state: 'ready', complete: true }
  const supplied = CoachKostMaal({ ...props, nutritionRead }).props.children.find(child => child.type === PortalPlan)
  assert.equal(supplied.props.nutritionRead, nutritionRead)
  const html = renderToStaticMarkup(h(PortalNutritionReport, { ...PortalPlan(supplied.props).props, enabled: true }))
  assert.match(html, /3.500 kcal registreret/)
  assert.match(html, /4.000 kcal plan for loggede dage/)
})
