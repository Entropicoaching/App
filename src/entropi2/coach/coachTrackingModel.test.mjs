import test from 'node:test'
import assert from 'node:assert/strict'
import { coachHomeModel } from './coachModel.mjs'
import { coachAthleteWorkspace } from './coachWorkspaceModel.mjs'
import { coachTrackingModel, hasReportValues } from './coachTrackingModel.mjs'
import { productionFixture, day, athleteId } from './coachProductionFixture.mjs'
import { addCalendarDays } from '../../calendarDate.js'
const workspace = p => {
  const context = coachHomeModel(p, day)
  return coachAthleteWorkspace(p, context, p.athletes[0])
}

test('production props without coachAnalysis derive supported nutrition signal and hide absent weight', () => {
  const p = productionFixture(), before = structuredClone({ ...p, openProfile: null, openCoachPriorityItem: null, setView: null, setSelectedAthlete: null })
  const result = workspace(p)
  assert.deepEqual(result.compact.signals, ['Lavt protein i de seneste 7 loggede dage'])
  assert.equal(result.signals[0].sources[0], 'kost')
  assert.match(result.signals[0].dataBasis[0].summary, /7\/7/)
  assert.equal(result.facts.weight, undefined)
  assert.equal(result.facts.session.lastDay, day)
  assert.deepEqual({ ...p, openProfile: null, openCoachPriorityItem: null, setView: null, setSelectedAthlete: null }, before)
})

test('missing, partial, stale, foreign and malformed nutrition cannot produce a signal', () => {
  for (const mutate of [p => { delete p.coachNutrition }, p => { p.coachNutrition.state = 'partial' },
    p => { p.coachNutrition.complete = false }, p => { p.coachNutrition.day = '2026-11-02' },
    p => { p.coachNutrition.coachId = 'foreign' }, p => { p.coachNutrition.athleteIds = ['foreign'] },
    p => { p.coachNutrition.rows[0].athlete_id = 'foreign' }, p => { p.coachNutrition.rows[0].date = '2026-11-04' },
    p => { p.coachNutrition.rows[0].protein = null }, p => { p.coachNutrition.rows.pop() },
    p => { p.coachNutrition.targets = [] }]) {
    const p = productionFixture(); mutate(p)
    assert.deepEqual(workspace(p).compact.signals, [])
  }
})

test('real tracking load computation requires measurable observations in all four weeks', () => {
  const p = productionFixture(); delete p.coachNutrition
  p.coachActionsStatus.activity.rows = [0, 7, 14, 21].map((offset, i) => ({
    id: `synthetic-${i}`, athlete_id: athleteId, logged_at: `${addCalendarDays(day, -offset)}T10:00:00Z`,
    weight: i === 0 ? 100 : 10, reps_completed: 5 }))
  const result = workspace(p)
  assert.equal(result.signals.length, 1)
  assert.equal(result.signals[0].sources[0], 'belastning')
  assert.match(result.compact.signals[0], /belastning/)
  p.coachActionsStatus.activity.state = 'partial'
  assert.deepEqual(workspace(p).compact.signals, [])
  p.coachActionsStatus.activity.state = 'ready'
  p.coachActionsStatus.activity.rows.pop()
  assert.deepEqual(workspace(p).compact.signals, [])
})

test('real weightTrend uses three distinct measured days per week; absent/foreign/invalid points stay silent', () => {
  const p = productionFixture(), context = coachHomeModel(p, day)
  const weight = { athleteId, day, state: 'ready', complete: true, from: '2026-10-21', through: day,
    points: [0, 1, 2, 7, 8, 9].map(offset => ({ day: addCalendarDays(day, -offset), kg: offset < 7 ? 81 : 80 })) }
  const run = w => coachTrackingModel(p, context, p.athletes[0], null, w)
  assert.equal(run(weight).weight.text, 'Vægttrend +1,0 kg · ugesnit')
  for (const patch of [{ athleteId: 'foreign' }, { day: '2026-11-02' }, { complete: false },
    { state: 'partial' }, { from: '2026-10-20' }, { through: '2026-11-04' },
    { points: weight.points.slice(1) }, { points: [...weight.points, weight.points[0]] },
    { points: [{ day: '2026-11-04', kg: 80 }] }, { points: [{ day, kg: '80' }] },
    { points: [{ day: '2026-10-32', kg: 80 }] }]) assert.equal(run({ ...weight, ...patch }).weight, undefined)
  assert.equal(run(undefined).weight, undefined)
})

test('all missing report facts hide draft; documented zero and planned values are real facts', () => {
  const row = { athlete: { id: athleteId }, training: { completed: null, planned: null }, nutrition: null }
  const report = { ready: true, rows: [row] }
  assert.equal(hasReportValues(report, athleteId), false)
  row.training.completed = 0; assert.equal(hasReportValues(report, athleteId), true)
  row.training.completed = null; row.nutrition = { logged: 0 }; assert.equal(hasReportValues(report, athleteId), true)
  row.nutrition.logged = 8; assert.equal(hasReportValues(report, athleteId), false)
  report.rows.push(row); assert.equal(hasReportValues(report, athleteId), false)
  assert.equal(hasReportValues({ ready: false, get rows() { throw Error('read') } }, athleteId), false)
})

test('owner, hidden roster and read errors cannot reuse computed output', () => {
  for (const mutate of [p => { p.session.user.id = 'foreign' }, p => { p.athletes[0].hidden = true },
    p => { p.loading = true }, p => { p.loadError = true }]) {
    const p = productionFixture(); mutate(p); assert.equal(workspace(p), null)
  }
})
