import test from 'node:test'
import assert from 'node:assert/strict'
import { weeklyReportModel } from './weeklyReportModel.mjs'

// Separate probes with independent synthetic data; no producer fixture imports.
function input() {
  const day = '2026-10-26'
  return { session: { user: { id: 'review-owner' } },
    readContext: { coachId: 'review-owner', day, athleteIds: ['review-a'] },
    athletes: [{ id: 'review-a', name: 'Kontrolatlet' }],
    calendarWeeks: { 'review-a': [{ start_date: '2026-10-20', session_count: 2, exercise_count: 1 }] },
    coachActionsStatus: { calendar: 'ready', activity: { state: 'ready', day, ids: ['review-a'], rows: [
      { athlete_id: 'review-a', logged_at: '2026-10-25T23:30:00Z', rpe_actual: 8, exercises: { sessions: { id: 'review-s' } } },
      { athlete_id: 'review-a', logged_at: '2026-10-25T23:31:00Z', rpe_actual: 6, exercises: { sessions: { id: 'review-s' } } },
    ] } },
    coachNutrition: { coachId: 'review-owner', day, from: '2026-10-20', through: day,
      athleteIds: ['review-a'], state: 'ready', complete: true,
      rows: [{ id: 'review-meal', athlete_id: 'review-a', date: '2026-10-20', meal: 'Test', kcal: 0, protein: 0 }],
      targets: [{ athlete_id: 'review-a', protein_target: 100 }] } }
}
const row = p => weeklyReportModel(p, '2026-10-25T23:35:00Z').rows[0]
test('review: DST window is seven civil days, latest session uses all valid sets', () => {
  const p = input(), before = structuredClone(p), r = row(p)
  assert.equal(r.training.completed, 1); assert.equal(r.training.rpe, 7); assert.equal(r.training.rpeCount, 2)
  assert.equal(r.nutrition.logged, 1); assert.equal(r.nutrition.reached, 0)
  assert.deepEqual(p, before)
})
test('review: sparse activity query cannot establish session count or RPE', () => {
  const p = input(); p.coachActionsStatus.activity.rows = [{ athlete_id: 'review-a', logged_at: '2026-10-26' }]
  assert.equal(row(p).training.completed, null); assert.equal(row(p).training.rpe, null)
})
test('review: boundary meals, overflow and duplicate targets invalidate whole receipt', () => {
  for (const change of [p => { p.coachNutrition.rows[0].date = '2026-10-19' },
    p => { p.coachNutrition.targets.push({ athlete_id: 'review-a', protein_target: 10 }) },
    p => { p.coachNutrition.rows[0].protein = Number.MAX_VALUE; p.coachNutrition.rows.push({ ...p.coachNutrition.rows[0], id: 'overflow' }) }]) {
    const p = input(); change(p); assert.equal(row(p).nutrition, null)
  }
})
test('review: no date, stale scope, invalid RPE and absent goal stay explicit', () => {
  const p = input()
  assert.equal(weeklyReportModel(p, '2026-02-30').rows.length, 0)
  p.coachActionsStatus.activity.rows.forEach(r => { r.rpe_actual = 11 })
  p.coachNutrition.targets = []
  assert.equal(row(p).training.rpe, null); assert.equal(row(p).nutrition.reached, null)
  p.readContext.coachId = 'another-owner'
  assert.equal(weeklyReportModel(p, '2026-10-26').rows.length, 0)
})
