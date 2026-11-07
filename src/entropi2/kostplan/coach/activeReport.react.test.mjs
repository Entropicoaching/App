// REQUIRED app npm test gate. Real React only; missing packages are a failure.
// All data and table clients are synthetic. No browser, server or session reads.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import PortalPlan, { ActiveReport } from './PortalPlan.mjs'
import CoachKostMaal from '../../kostMaalKobling.mjs'
import { startActiveReport, activeReportView } from './activeReport.mjs'
import { createPlanAdapter } from '../planAdapter.mjs'
import { createCoachPlan } from './controller.mjs'
import { syntheticInput } from './syntheticFixture.mjs'
import { syntheticTables } from './activation.fixture.mjs'
import { meal } from '../rapport/reportFixture.mjs'

const scope = { coachId: 'synthetic-coach', athleteId: 'synthetic-athlete', date: '2026-11-05' }
const receipt = () => ({ ...scope, state: 'ready', complete: true, planHistory: 'unavailable',
  mealLogs: [meal('2026-10-30', 'first', { athlete_id: scope.athleteId, carb: undefined, fat: undefined }),
    meal(scope.date, 'last', { athlete_id: scope.athleteId, kcal: 2500, carb: undefined, fat: undefined })] })
const props = () => ({ enabled: true, coachId: scope.coachId, athlete: { id: scope.athleteId }, today: scope.date,
  date: scope.date, session: { user: { id: scope.coachId } }, nutritionRead: receipt() })
const read = options => new Promise(resolve => { startActiveReport(options, resolve) })

test('real React renders the actual approved adapter plan against seven-day production-shaped logs', async () => {
  const f = syntheticTables(), c = createCoachPlan(syntheticInput().options)
  assert.equal(c.generate(), true)
  await createPlanAdapter({ enabled: true, ...scope, client: f.client }).activate({ ...scope,
    goal: 'maintain', intensity: 10, meals: c.snapshot().meals })
  const writes = f.writes().length
  const result = await read({ enabled: true, ...scope, receipt: receipt(), client: f.client })
  const html = renderToStaticMarkup(activeReportView(h, result))
  assert.match(html, /Plan og registreret kost|Periodens kost|Seneste 7 dage/)
  assert.match(html, /3.500 kcal registreret/)
  assert.match(html, /2 af 7 dage med kostlog/)
  assert.match(html, /bekræftede godkendte planportioner/)
  assert.match(html, /Ukendt registreret/)
  assert.equal((html.match(/<time /g) ?? []).length, 7)
  assert.doesNotMatch(html, /<details[^>]* open|Vægttrend|NaN|Infinity|undefined|dage med entydig aktiveret plan/)
  assert.equal(f.writes().length, writes)
})

test('real React host and portal mount the optional report independently of opening the editor; SSR performs no reads', () => {
  const p = props(), host = CoachKostMaal(p)
  const portal = host.props.children.find(child => child.type === PortalPlan)
  assert.equal(portal.props.nutritionRead, p.nutritionRead)
  const html = renderToStaticMarkup(h(PortalPlan, { ...portal.props,
    loadClient() { assert.fail('SSR cannot load a session client') } }))
  assert.match(html, /Kostplan/)
  assert.doesNotMatch(html, /Periodens kost|Vælg måltider|<details[^>]* open/)
  for (const enabled of [undefined, false, 1, 'true']) {
    assert.equal(ActiveReport({ enabled, get nutritionRead() { assert.fail('OFF read') } }), null)
    assert.equal(renderToStaticMarkup(h(ActiveReport, { enabled })), '')
  }
})

test('real React absent plan/table preserves actuals with unknown references; failed history exposes retry', async () => {
  for (const f of [syntheticTables(), syntheticTables({ missing: true })]) {
    const result = await read({ enabled: true, ...scope, receipt: receipt(), client: f.client })
    const html = renderToStaticMarkup(activeReportView(h, result))
    assert.match(html, /3.500 kcal registreret/)
    assert.match(html, /Historisk planreference ukendt/)
    assert.doesNotMatch(html, /% af planindhold/)
  }
  const f = syntheticTables({ error: '42501' })
  const result = await read({ enabled: true, ...scope, receipt: receipt(), client: f.client })
  const html = renderToStaticMarkup(activeReportView(h, result, () => {}))
  assert.match(html, /role="alert"/); assert.match(html, /<button type="button"/)
  assert.match(html, /3.500 kcal registreret|Plan og registreret kost/)
  assert.match(html, /Historisk planreference kunne ikke bekræftes/)
  assert.doesNotMatch(html, /% af planindhold/)
})
