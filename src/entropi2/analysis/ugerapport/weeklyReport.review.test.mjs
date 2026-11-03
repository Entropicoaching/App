import test from 'node:test'
import assert from 'node:assert/strict'
import WeeklyReport from './WeeklyReport.mjs'
import { weeklyReportModel } from './weeklyReportModel.mjs'
import { renderTree } from '../testDom.mjs'

// Separate fixtures and explicit expected output; no producer fixture helpers.
const clock = '2026-11-08T12:00:00Z'
const input = () => ({ entropi2: true, now: clock, athlete: { id: 'review-only' },
  currentWeek: { start_date: '2026-11-02', block_name: 'Styrke', sessions: [
    { exercises: [{ id: 1, name: 'Bench top set', sets: 2 }] }] },
  exerciseLogs: [
    { exercise_id: 1, set_number: 1, logged_at: '2026-11-02', weight: 60, reps_completed: 5 },
    { exercise_id: 1, set_number: 2, logged_at: '2026-11-08', skipped: true }],
  fremgangLogs: [], historicalMealLogs: [{ date: '2026-11-08', kcal: 0 }],
  weightLogs: [
    { athlete_id: 'review-only', logged_at: '2026-11-02', weight: 72 },
    { athlete_id: 'review-only', logged_at: '2026-11-08', weight: 71.5 }] })

test('independent Sunday oracle: alias, skipped completion, source and neutral negative change', () => {
  const m = weeklyReportModel(input(), clock)
  assert.equal(m.sessions, 'Pas gennemført: 1 af 1 planlagt.')
  assert.equal(m.lifts.find(x => x.lift === 'Bænkpres').value, 70)
  assert.equal(m.lifts.filter(x => x.value !== null).length, 1)
  assert.equal(m.mealDays, 1); assert.equal(m.weight.delta, -0.5)
  const text = renderTree(WeeklyReport(input())).textContent
  assert.match(text, /Vægtændring: -0,5 kg/)
  assert.match(text, /60 kg × 5 den 02.11.2026/)
  assert.doesNotMatch(text, /fedt|parathed|forbedret|forværret/)
})

test('independent bounds: malformed plans and extreme finite weight never fabricate text', () => {
  for (const currentWeek of [null, {}, { start_date: '2026-11-02', sessions: [null] },
    { start_date: '2026-11-02', sessions: [{ exercises: [null] }] }]) {
    const p = { ...input(), currentWeek }
    assert.doesNotThrow(() => WeeklyReport(p))
    assert.match(weeklyReportModel(p, clock).sessions, /mangler/)
  }
  const p = input(); p.weightLogs[0].weight = Number.MAX_VALUE; p.weightLogs[1].weight = 1
  const text = renderTree(WeeklyReport(p)).textContent
  assert.doesNotMatch(text, /Infinity|NaN|undefined/)
})

test('independent OFF proxy: only the flag is accessed, no data or dependencies called', () => {
  const reads = []
  const p = new Proxy({}, { get(_, key) { reads.push(key); if (key === 'entropi2') return false; throw Error('read') } })
  assert.equal(WeeklyReport(p), null); assert.deepEqual(reads, ['entropi2'])
})

test('independent injection probe stays text and has no active control', () => {
  const p = input(); p.historicalMealLogs[0].meal = '<img src=x onerror=alert(1)>'
  const dom = renderTree(WeeklyReport(p))
  assert.equal(dom.querySelectorAll('img').length, 0)
  assert.equal(dom.querySelectorAll('script').length, 0)
  assert.equal(dom.querySelectorAll('button').length, 0)
  assert.equal(dom.querySelectorAll('a').length, 0)
})
