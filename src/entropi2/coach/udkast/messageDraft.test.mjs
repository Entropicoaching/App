import test from 'node:test'
import assert from 'node:assert/strict'
import { createCoachMessageDraft } from './messageDraft.mjs'
import { weeklyReportModel } from '../weeklyReportModel.mjs'

const day = '2026-11-03'
function props() {
  return {
    session: { user: { id: 'synthetic-owner' } },
    readContext: { coachId: 'synthetic-owner', day, athleteIds: ['synthetic-a'] },
    athletes: [{ id: 'synthetic-a', name: 'Syntetisk atlet' }],
    calendarWeeks: { 'synthetic-a': [{ start_date: '2026-11-02', session_count: 3, exercise_count: 1 }] },
    coachActionsStatus: { calendar: 'ready', activity: { state: 'ready', day, ids: ['synthetic-a'], rows: [
      { athlete_id: 'synthetic-a', logged_at: '2026-11-02T12:00:00Z', rpe_actual: '8,5', exercises: { sessions: { id: 'synthetic-session' } } },
    ] } },
    coachNutrition: { coachId: 'synthetic-owner', day, from: '2026-10-28', through: day,
      athleteIds: ['synthetic-a'], state: 'ready', complete: true,
      rows: [{ id: 'synthetic-meal', athlete_id: 'synthetic-a', date: day, meal: 'Syntetisk måltid', kcal: 500, protein: 100 }],
      targets: [{ athlete_id: 'synthetic-a', protein_target: 100 }] },
  }
}
const draft = p => createCoachMessageDraft(weeklyReportModel(p, day), 'synthetic-a')

test('actual week evaluation produces a short editable, factual Danish suggestion', () => {
  const p = props(), before = structuredClone(p), result = draft(p)
  assert.equal(result.requiresCoachReview, true)
  for (const s of ['1 pas logget mod 3 planlagte', 'mindst ét sæt', 'RPE) 8,5',
    '1 af de seneste 7 dage', 'nået på 1 af 1 logget dag', 'Hvordan har ugen føltes']) assert.ok(result.text.includes(s), s)
  assert.ok(result.text.length < 750)
  assert.deepEqual(p, before)
  assert.deepEqual(draft(p), result)
})

test('unknown batches never turn into zero or invented protein success', () => {
  const p = props(); delete p.coachActionsStatus.activity; delete p.coachNutrition
  const text = draft(p).text
  assert.match(text, /mangler et sikkert overblik over ugens/)
  assert.match(text, /mangler et sikkert overblik over de seneste/)
  assert.doesNotMatch(text, /0 pas|RPE|Proteinmålet/)
})

test('proven empty receipts preserve zero without judging missing logs', () => {
  const p = props(); p.coachActionsStatus.activity.rows = []; p.coachNutrition.rows = []
  const text = draft(p).text
  assert.match(text, /0 pas logget mod 3 planlagte/)
  assert.match(text, /kost på 0 af de seneste 7 dage/)
  assert.doesNotMatch(text, /sprunget|gennemført|mislykket|RPE/)
})

test('not-ready, hidden, wrong-owner, stale and missing athletes produce no draft', () => {
  for (const change of [p => { p.loading = true }, p => { p.athletes[0].hidden = true },
    p => { p.readContext.coachId = 'synthetic-other' }, p => { p.readContext.day = '2026-11-02' }]) {
    const p = props(); change(p); assert.equal(draft(p), null)
  }
  for (const report of [null, {}, { ready: true }, { ready: false, rows: [] }, { ready: true, rows: [] }]) {
    assert.equal(createCoachMessageDraft(report, 'synthetic-a'), null)
  }
})

test('selection isolates athletes and rejects duplicate identity', () => {
  const report = weeklyReportModel(props(), day), a = structuredClone(report.rows[0])
  report.rows.unshift({ athlete: { id: 'synthetic-other' }, training: { completed: 999 } })
  assert.doesNotMatch(createCoachMessageDraft(report, 'synthetic-a').text, /999/)
  assert.equal(createCoachMessageDraft(report, 'missing'), null)
  report.rows.push(a)
  assert.equal(createCoachMessageDraft(report, 'synthetic-a'), null)
  for (const id of ['', ' ', null, 0]) assert.equal(createCoachMessageDraft(report, id), null)
})

test('malformed aggregates stay unknown and free text is never copied', () => {
  const report = { ready: true, rows: [{ athlete: { id: 'synthetic-a', name: '<name>' },
    training: { completed: -1, planned: Infinity, rpe: NaN, rpeCount: 1 },
    nutrition: { logged: 8, reached: 8, proteinGoal: 100 }, note: '<private-note>' }] }
  const before = structuredClone(report)
  assert.doesNotMatch(createCoachMessageDraft(report, 'synthetic-a').text, /NaN|Infinity|<|RPE|Proteinmålet/)
  assert.deepEqual(report, before)
})

test('missing target, invalid RPE and inconsistent protein counts are omitted', () => {
  for (const value of [null, 0, -1, Infinity, '100']) {
    const report = weeklyReportModel(props(), day)
    report.rows[0].nutrition.proteinGoal = value
    report.rows[0].training.rpe = 11
    assert.doesNotMatch(createCoachMessageDraft(report, 'synthetic-a').text, /Proteinmålet|RPE/)
  }
  const report = weeklyReportModel(props(), day); report.rows[0].nutrition.reached = 2
  assert.doesNotMatch(createCoachMessageDraft(report, 'synthetic-a').text, /Proteinmålet/)
})
