// Separate review assertions: derive expectations without the producer fixture.
import test from 'node:test'
import assert from 'node:assert/strict'
import { weekEvaluation } from './evaluationModel.mjs'

const athleteId = 'review-synthetic'
const start = '2026-12-28', end = '2027-01-03'
const receipt = rows => ({ athleteId, from: start, through: end, state: 'ready', complete: true, rows })

test('independent: year boundary, all-skipped session, no synthetic e1RM or RPE', () => {
  const m = weekEvaluation({ athleteId, today: '2027-01-04', training: {
    ...receipt([{ id: 'r', athlete_id: athleteId, exercise_id: 'e', set_number: 1,
      logged_at: end, skipped: true, weight: 200, reps_completed: 1, rpe_actual: 10, rpe_source: 'athlete' }]),
    week: { start_date: start, block_name: 'Styrke', sessions: [{ id: 's', exercises: [{ id: 'e', name: 'Dødløft', sets: 1 }] }] },
  } })
  assert.deepEqual([m.start, m.end, m.training.done, m.training.sets, m.training.skipped], [start, end, 1, 0, 1])
  assert.equal(m.training.rpe, null)
  assert.ok(m.training.lifts.every(l => l.value === null))
})

test('independent: per-day nutrition average uses logged days and preserves genuine zero', () => {
  const rows = [
    { id: 'n1', athlete_id: athleteId, date: start, meal: 'Syntetisk A', kcal: '400,5', protein: '10,5' },
    { id: 'n2', athlete_id: athleteId, date: start, meal: 'Syntetisk B', kcal: 200, protein: 20 },
    { id: 'n3', athlete_id: athleteId, date: end, meal: 'Syntetisk C', kcal: 0, protein: 0 },
  ]
  const m = weekEvaluation({ athleteId, today: '2027-01-04', nutrition: receipt(rows) })
  assert.equal(m.nutrition.days, 2)
  assert.ok(Math.abs(m.nutrition.kcal - 300.25) < 1e-9)
  assert.ok(Math.abs(m.nutrition.protein - 15.25) < 1e-9)
  assert.equal(m.nutrition.kcalTarget, null)
})

test('independent: foreign note and malformed timestamp do not reach rendered content model', () => {
  const foreign = weekEvaluation({ athleteId, today: '2027-01-04', messages: receipt([
    { id: 'm', athlete_id: 'foreign-synthetic', content: 'FOREIGN-SENTINEL', sender_role: 'athlete', created_at: end },
  ]) })
  assert.equal(foreign.notes.messageState, 'unknown')
  assert.equal(JSON.stringify(foreign).includes('FOREIGN-SENTINEL'), false)
  const bad = weekEvaluation({ athleteId, today: '2027-01-04', messages: receipt([
    { id: 'm', athlete_id: athleteId, content: 'BAD-DATE-SENTINEL', sender_role: 'athlete', created_at: '2027-01-03T12:00:00' },
  ]) })
  assert.equal(bad.notes.messageState, 'partial')
  assert.equal(JSON.stringify(bad).includes('BAD-DATE-SENTINEL'), false)
})
