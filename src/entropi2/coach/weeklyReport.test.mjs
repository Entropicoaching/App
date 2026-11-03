import test from 'node:test'
import assert from 'node:assert/strict'
import CoachScreen, { CoachView } from './CoachScreen.mjs'
import WeeklyReport from './WeeklyReport.mjs'
import { weeklyReportModel } from './weeklyReportModel.mjs'

const today = '2026-11-03'
function fixture() {
  return { session: { user: { id: 'synthetic-owner' } },
    readContext: { coachId: 'synthetic-owner', day: today, athleteIds: ['a'] },
    athletes: [{ id: 'a', name: 'Syntetisk atlet' }], loading: false, loadError: false,
    calendarWeeks: { a: [{ start_date: '2026-11-02', session_count: 3, exercise_count: 2 }] },
    coachActionsStatus: { calendar: 'ready', activity: { state: 'ready', day: today, ids: ['a'], rows: [
      { athlete_id: 'a', logged_at: '2026-11-02T10:00:00Z', rpe_actual: 7, exercises: { sessions: { id: 's1' } } },
      { athlete_id: 'a', logged_at: '2026-11-02T10:01:00Z', rpe_actual: '8,5', exercises: { sessions: { id: 's1' } } },
      { athlete_id: 'a', logged_at: '2026-11-03T10:00:00Z', rpe_actual: 9, exercises: { sessions: { id: 's2' } } },
      { athlete_id: 'a', logged_at: '2026-11-03T10:01:00Z', rpe_actual: 10, skipped: true, exercises: { sessions: { id: 'skip' } } },
    ] } },
    coachNutrition: { coachId: 'synthetic-owner', day: today, athleteIds: ['a'], state: 'ready', complete: true,
      from: '2026-10-28', through: today,
      rows: [
        { id: 'm1', athlete_id: 'a', date: '2026-10-28', meal: 'Test', kcal: 500, protein: '10,1' },
        { id: 'm2', athlete_id: 'a', date: '2026-10-28', meal: 'Test', kcal: 500, protein: '20,2' },
        { id: 'm3', athlete_id: 'a', date: '2026-10-28', meal: 'Test', kcal: 500, protein: '30,3' },
        { id: 'm4', athlete_id: 'a', date: today, meal: 'Test', kcal: 500, protein: 60.59 },
        { id: 'meta', athlete_id: 'a', date: '2026-10-29', meal: ' [appData2-day-v1][]', kcal: 9999, protein: 9999 },
      ], targets: [{ athlete_id: 'a', protein_target: '60,6' }] } }
}
const report = p => weeklyReportModel(p, today)
const row = p => report(p).rows[0]
const nodes = n => Array.isArray(n) ? n.flatMap(nodes) : !n || typeof n !== 'object' ? [] :
  n.type === WeeklyReport ? nodes(n.type(n.props)) : [n, ...nodes(n.props?.children ?? n.children)]
const text = n => Array.isArray(n) ? n.map(text).join(' ') : !n || typeof n === 'boolean' ? '' :
  typeof n !== 'object' ? String(n) : n.type === WeeklyReport ? text(n.type(n.props)) : text(n.props?.children ?? n.children)
const view = p => CoachView({ ...p, enabled: true, today })

test('counts sessions once, skips omitted sets and averages latest session only', () => {
  const p = fixture(), before = structuredClone(p), r = row(p)
  assert.deepEqual(r.training, { start: '2026-11-02', planned: 3, completed: 2, rpe: 9, rpeCount: 1 })
  assert.deepEqual(r.nutrition, { logged: 2, proteinGoal: 60.6, reached: 1 })
  assert.deepEqual(p, before)
})
test('actual overview renders report and inbox stays unchanged', () => {
  const p = fixture(), tree = view(p)
  assert.equal(nodes(tree).filter(n => n.props?.['data-coach-weekly-report']).length, 1)
  for (const expected of ['Pas logget: 2 af 3 planlagte', 'RPE-snit: 9,0', 'Kostdage logget: 2/7', 'Proteinmål nået: 1 af 2'])
    assert.ok(text(tree).includes(expected), expected)
  assert.equal(nodes(CoachView({ ...p, enabled: true, today, tab: 'inbox' })).filter(n => n.props?.['data-coach-weekly-report']).length, 0)
})
test('OFF returns before reading sensitive getters or starting clock hooks', () => {
  const p = { get coachNutrition() { throw Error('unexpected read') } }
  assert.equal(CoachScreen(p), null); assert.equal(CoachView(fixture()), null)
})
test('zero is proven only for ready empty batches; absent batches stay unknown', () => {
  const p = fixture(); p.coachActionsStatus.activity.rows = []; p.coachNutrition.rows = []
  assert.equal(row(p).training.completed, 0); assert.equal(row(p).nutrition.logged, 0)
  assert.equal(row(p).nutrition.reached, 0)
  delete p.coachNutrition; delete p.coachActionsStatus.activity
  assert.equal(row(p).training.completed, null); assert.equal(row(p).nutrition, null)
})
test('hidden, wrong-owner, stale, loading and failed roster never appear', () => {
  for (const change of [p => { p.athletes[0].hidden = true }, p => { p.hiddenAthleteIds = new Set(['a']) },
    p => { p.readContext.coachId = 'other' }, p => { p.readContext.day = '2026-11-02' },
    p => { p.loading = true }, p => { p.loadError = true }]) {
    const p = fixture(); change(p); assert.equal(report(p).rows.length, 0)
    assert.equal(nodes(view(p)).filter(n => n.props?.['data-coach-weekly-report']).length, 0)
  }
})
test('malformed, partial, stale and capped log receipts stay unknown', () => {
  for (const change of [p => { p.coachActionsStatus.activity.state = 'partial' },
    p => { p.coachActionsStatus.activity.day = '2026-11-02' },
    p => { p.coachActionsStatus.activity.ids = [] },
    p => { p.coachActionsStatus.activity.rows[0].logged_at = '2026-02-30' },
    p => { p.coachActionsStatus.activity.rows[0].logged_at = '2026-11-04' },
    p => { delete p.coachActionsStatus.activity.rows[0].exercises },
    p => { p.coachActionsStatus.activity.rows = Array(1000).fill(p.coachActionsStatus.activity.rows[0]) }]) {
    const p = fixture(); change(p); assert.equal(row(p).training.completed, null); assert.equal(row(p).training.rpe, null)
  }
})
test('unknown, overlapping and incomplete calendar never invents a plan', () => {
  for (const change of [p => { p.calendarWeeks.a[0].start_date = null },
    p => { p.calendarWeeks.a.push({ ...p.calendarWeeks.a[0] }) },
    p => { p.calendarWeeks.a[0].readEvidence = { complete: false } },
    p => { p.coachActionsStatus.calendar = 'loading' }, p => { p.calendarWeeks.a = [] }]) {
    const p = fixture(); change(p); assert.equal(row(p).training.planned, null); assert.equal(row(p).training.completed, null)
  }
})
test('invalid plan count and missing RPE are explicit unknowns', () => {
  const p = fixture(); p.calendarWeeks.a[0].session_count = undefined
  p.coachActionsStatus.activity.rows.forEach(r => { r.rpe_actual = '' })
  assert.equal(row(p).training.planned, null); assert.equal(row(p).training.rpe, null)
  assert.match(text(view(p)), /RPE-snit: ukendt/)
})
test('nutrition rejects stale, malformed, foreign and duplicate data', () => {
  for (const change of [p => { p.coachNutrition.complete = false }, p => { p.coachNutrition.state = 'partial' },
    p => { p.coachNutrition.coachId = 'other' }, p => { p.coachNutrition.day = '2026-11-02' },
    p => { p.coachNutrition.from = '2026-10-27' }, p => { p.coachNutrition.through = '2026-11-02' },
    p => { p.coachNutrition.athleteIds.push('a') }, p => { p.coachNutrition.rows[0].athlete_id = 'other' },
    p => { p.coachNutrition.rows[0].date = '2026-11-04' }, p => { p.coachNutrition.rows[0].protein = -1 },
    p => { p.coachNutrition.rows.push(p.coachNutrition.rows[0]) },
    p => { p.coachNutrition.targets.push(p.coachNutrition.targets[0]) }]) {
    const p = fixture(); change(p); assert.equal(row(p).nutrition, null)
    assert.match(text(view(p)), /Kostdage logget: ukendt/)
  }
})
test('missing protein target preserves known logged day count', () => {
  const p = fixture(); p.coachNutrition.targets = []
  assert.equal(row(p).nutrition.logged, 2); assert.equal(row(p).nutrition.reached, null)
  assert.match(text(view(p)), /Proteinmål: ikke angivet/)
})
test('Danish midnight and week start exclude prior days', () => {
  const p = fixture()
  p.coachActionsStatus.activity.rows = [
    { athlete_id: 'a', logged_at: '2026-11-01T22:30:00Z', exercises: { sessions: { id: 'old' } } },
    { athlete_id: 'a', logged_at: '2026-11-01T23:30:00Z', exercises: { sessions: { id: 'current' } }, rpe_actual: 8 },
  ]
  assert.equal(row(p).training.completed, 1)
  assert.equal(weeklyReportModel(p, '2026-11-02T23:30:00Z').rows.length, 1)
  assert.equal(weeklyReportModel(p, '2026-11-02T22:30:00Z').rows.length, 0)
})
test('multiple athletes stay separate and unscoped profile logs are ignored', () => {
  const p = fixture(); p.athletes.push({ id: 'b', name: 'Test B' }); p.readContext.athleteIds.push('b')
  p.coachNutrition.athleteIds.push('b'); p.coachActionsStatus.activity.ids.push('b')
  p.calendarWeeks.b = [{ ...p.calendarWeeks.a[0], session_count: 4 }]
  p.athleteLogs = [{ athlete_id: 'b', rpe_actual: 10 }]
  const rows = report(p).rows
  assert.equal(rows[0].training.completed, 2); assert.equal(rows[1].training.completed, 0)
  assert.equal(rows[1].training.rpe, null); assert.equal(rows[1].nutrition.logged, 0)
})
