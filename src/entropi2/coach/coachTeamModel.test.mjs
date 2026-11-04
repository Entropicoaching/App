import test from 'node:test'
import assert from 'node:assert/strict'
import { coachTeamModel } from './coachTeamModel.mjs'
import { coachHomeModel } from './coachModel.mjs'
import { productionFixture, day, athleteId } from './coachProductionFixture.mjs'
import { addCalendarDays } from '../../calendarDate.js'

const model = p => coachTeamModel({ enabled: true, props: p, context: coachHomeModel(p, p.today) })
const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }
  return value
}
const withoutCallbacks = p => ({ ...p, openProfile: null, openCoachPriorityItem: null,
  setView: null, setSelectedAthlete: null })

test('OFF never reads props or context', () => {
  for (const enabled of [undefined, false, null, 1, 'true']) assert.equal(coachTeamModel({ enabled,
    get props() { throw Error('OFF props') }, get context() { throw Error('OFF context') } }), null)
})

test('Dashboard-shaped data without coachAnalysis produce real counts and the existing nutrition signal', () => {
  const p = withoutCallbacks(productionFixture()), before = structuredClone(p)
  assert.equal('coachAnalysis' in p, false)
  assert.deepEqual(model(freeze(p)), { asOf: day, trainingFrom: '2026-10-07', nutritionFrom: '2026-10-28',
    athletes: [{ athleteId, name: 'Syntetisk atlet', signalCount: 1, trainingDays: 1, nutritionDays: 7 }] })
  assert.deepEqual(p, before)
})

test('timestamp-only production activity projection needs no weight, reps, session id or analysis snapshot', () => {
  const p = productionFixture(); delete p.coachNutrition
  p.coachActionsStatus.activity.rows = [{ athlete_id: athleteId, logged_at: day + 'T10:00:00Z' }]
  Object.defineProperty(p, 'coachAnalysis', { get() { throw Error('dead snapshot read') } })
  const a = model(p).athletes[0]
  assert.equal(a.trainingDays, 1); assert.equal(a.nutritionDays, null); assert.equal(a.signalCount, 0)
})

test('distinct Danish days, rolling bounds, skipped and optimistic rows do not inflate coverage', () => {
  const p = productionFixture(); delete p.coachNutrition
  p.coachActionsStatus.activity.rows = [
    { logged_at: '2026-10-06T23:30:00Z' }, // Oct 7 in Denmark; inclusive oldest day.
    { logged_at: '2026-10-06T10:00:00Z' }, // Outside the displayed interval.
    { logged_at: day + 'T10:00:00Z' }, { logged_at: day + 'T11:00:00Z' },
    { logged_at: '2026-11-02', skipped: true }, { logged_at: '2026-11-01', _optimistic: true },
  ].map(row => ({ athlete_id: athleteId, ...row }))
  assert.equal(model(p).athletes[0].trainingDays, 2)
})

test('only actual observations show a row; successful empty reads and dead team snapshots show nothing', () => {
  const p = productionFixture(); p.coachActionsStatus.activity.rows = []; p.coachNutrition.rows = []
  assert.equal(model(p), null)
  p.coachAnalysis = { get byAthlete() { throw Error('obsolete team snapshot read') } }
  assert.equal(model(p), null)
  delete p.coachNutrition; delete p.coachActionsStatus.activity
  assert.equal(model(p), null)
})

test('missing, failed, partial, stale, foreign and capped activity leave no fabricated training days', () => {
  for (const change of [p => { delete p.coachActionsStatus.activity },
    p => { p.coachActionsStatus.activity.state = 'error' },
    p => { p.coachActionsStatus.activity.state = 'partial' },
    p => { p.coachActionsStatus.activity.day = '2026-11-02' },
    p => { p.coachActionsStatus.activity.ids = ['foreign'] },
    p => { p.coachActionsStatus.activity.rows[0].logged_at = '2026-11-04' },
    p => { p.coachActionsStatus.activity.rows[0].logged_at = '2026-10-32' },
    p => { p.coachActionsStatus.activity.rows = Array(1000).fill(p.coachActionsStatus.activity.rows[0]) },
  ]) {
    const p = productionFixture(); change(p)
    assert.equal(model(p).athletes[0].trainingDays, null)
    assert.equal(model(p).athletes[0].nutritionDays, 7)
    delete p.coachNutrition; assert.equal(model(p), null)
  }
})

test('invalid nutrition receipts disappear while independent training facts survive', () => {
  for (const change of [p => { delete p.coachNutrition }, p => { p.coachNutrition.state = 'partial' },
    p => { p.coachNutrition.state = 'error' }, p => { p.coachNutrition.complete = false },
    p => { p.coachNutrition.coachId = 'foreign' }, p => { p.coachNutrition.day = '2026-11-02' },
    p => { p.coachNutrition.from = '2026-10-27' }, p => { p.coachNutrition.through = '2026-11-04' },
    p => { p.coachNutrition.athleteIds = ['foreign'] }, p => { p.coachNutrition.rows[0].athlete_id = 'foreign' },
    p => { p.coachNutrition.rows[0].date = '2026-11-04' },
    p => { p.coachNutrition.rows[0].protein = null },
    p => { p.coachNutrition.rows.push(p.coachNutrition.rows[0]) },
  ]) {
    const p = productionFixture(); change(p)
    const a = model(p).athletes[0]
    assert.equal(a.trainingDays, 1); assert.equal(a.nutritionDays, null); assert.equal(a.signalCount, 0)
  }
})

test('no target or inadequate evidence never invents a signal but observed days remain useful', () => {
  const p = productionFixture(); p.coachNutrition.targets = []
  assert.equal(model(p).athletes[0].nutritionDays, 7); assert.equal(model(p).athletes[0].signalCount, 0)
  p.coachNutrition.rows.pop()
  assert.equal(model(p).athletes[0].nutritionDays, 6); assert.equal(model(p).athletes[0].signalCount, 0)
  p.coachNutrition.rows = [{ id: 'confirmation', athlete_id: athleteId, date: day,
    meal: '[appData2-day-v1] synthetic' }]
  assert.equal(model(p).athletes[0].nutritionDays, 0)
  p.coachActionsStatus.activity.rows = []; assert.equal(model(p), null)
})

test('real load and nutrition modules contribute two deduplicated signals when both have evidence', () => {
  const p = productionFixture()
  p.coachActionsStatus.activity.rows = [0, 7, 14, 21].map((offset, i) => ({
    id: `synthetic-${i}`, athlete_id: athleteId, logged_at: addCalendarDays(day, -offset) + 'T10:00:00Z',
    weight: i === 0 ? 100 : 10, reps_completed: 5 }))
  const a = model(p).athletes[0]
  assert.equal(a.signalCount, 2); assert.equal(a.trainingDays, 4)
  p.coachActionsStatus.activity.rows.pop()
  assert.equal(model(p).athletes[0].signalCount, 1)
})

test('wrong owner, day, roster, duplicate ids, load states and hidden athletes cannot retain output', () => {
  for (const change of [p => { p.session.user.id = 'foreign' }, p => { p.readContext.day = '2026-11-02' },
    p => { p.readContext.athleteIds.push('missing') }, p => { p.athletes.push(p.athletes[0]) },
    p => { p.loading = true }, p => { p.loadError = true }, p => { p.athletes[0].hidden = true },
    p => { p.hiddenAthleteIds = new Set([athleteId]) }]) {
    const p = productionFixture(); change(p); assert.equal(model(p), null)
  }
})

test('user_id aliases, open-profile logs, private analysis and cycle fields are never sources', () => {
  const p = productionFixture(); delete p.coachNutrition
  p.athletes[0].user_id = 'synthetic-user'
  p.coachActionsStatus.activity.rows[0].athlete_id = 'synthetic-user'
  for (const key of ['athleteLogs', 'coachAnalysis', 'cycle']) Object.defineProperty(p, key, {
    get() { throw Error('private or profile source read') } })
  assert.equal(model(p), null)
})
