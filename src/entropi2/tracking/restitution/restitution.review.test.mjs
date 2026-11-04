import test from 'node:test'
import assert from 'node:assert/strict'
import { buildRestitution } from './restitutionModel.mjs'

// Independently specified literal cases: no producer fixtures, no copied
// implementation/threshold functions. These import the exact final module.
const snapshot = () => ({ status: 'ready', complete: true, dailySource: 'readiness_logs',
  athleteId: 'synthetic-independent', endDate: '2026-11-04',
  readinessRows: ['2026-10-29', '2026-10-30', '2026-11-01', '2026-11-04'].map(logged_date => ({
    athlete_id: 'synthetic-independent', logged_date, sleep_hours: 7, energy: 4, stress: 1, soreness_level: 2,
  })),
  exerciseLogs: ['2026-10-22', '2026-10-28', '2026-10-29', '2026-11-04'].map((logged_at, index) => ({
    athlete_id: 'synthetic-independent', id: `synthetic-row-${index}`, exercise_id: `synthetic-lift-${index}`,
    set_number: 1, logged_at, weight: [50, 75, 60, 90][index], reps_completed: [4, 8, 4, 8][index],
  })) })
const evaluate = data => buildRestitution(data, { enabled: true })

test('independent arithmetic: previous 800, recent 960, exact 1.2 is God', () => {
  const result = evaluate(snapshot())
  assert.equal(result.from, '2026-10-22'); assert.equal(result.recentFrom, '2026-10-29')
  assert.equal(result.load.previous.tonnage, 800); assert.equal(result.load.recent.tonnage, 960)
  assert.equal(result.load.ratio, 1.2); assert.equal(result.level, 'god')
})

test('independent thresholds: above 1.2 caps God, high load alone never means Low', () => {
  for (const kg of [90.01, 900]) {
    const data = snapshot(); data.exerciseLogs[3].weight = kg
    assert.equal(evaluate(data).level, 'ok')
  }
  const data = snapshot(); data.readinessRows.forEach(row => { row.sleep_hours = 5.5 })
  assert.equal(evaluate(data).level, 'lav')
})

test('independent partial identity conflict across dates poisons comparison', () => {
  for (const changes of [{ logged_at: '2026-10-21', exercise_id: null },
    { logged_at: '2026-11-05', id: null }]) {
    const data = snapshot(); data.exerciseLogs.push({ ...data.exerciseLogs[0], ...changes })
    const result = evaluate(data)
    assert.equal(result.level, null); assert.equal(result.status, 'insufficient')
    assert.equal(result.load.ratio, null)
  }
})

test('independent missing day/metric does not become zero or a claimed rest day', () => {
  const data = snapshot(); data.readinessRows[0].energy = null
  let result = evaluate(data)
  assert.equal(result.metrics.energy.count, 3); assert.equal(result.metrics.energy.average, null)
  assert.equal(result.status, 'insufficient')
  data.readinessRows[0].energy = 4; data.exerciseLogs = []
  result = evaluate(data)
  assert.equal(result.load.recent.tonnage, null); assert.equal(result.load.previous.tonnage, null)
  assert.equal(result.level, null)
})

test('independent mixed-precision permutation is deterministic and does not mutate', () => {
  const data = snapshot(); data.readinessRows.forEach((row, index) => { row.sleep_hours = [6.1, 7.2, 8.4, 6.3][index] })
  data.exerciseLogs.forEach((row, index) => { row.weight = [12.35, 14.1, 16.7, 11.55][index] })
  const before = JSON.stringify(data), expected = evaluate(data)
  assert.deepEqual(evaluate({ ...data, readinessRows: [...data.readinessRows].reverse(), exerciseLogs: [...data.exerciseLogs].reverse() }), expected)
  assert.equal(JSON.stringify(data), before)
})

test('independent privacy and OFF: no identity output or unrelated property reads', () => {
  const poison = new Proxy({}, { get() { throw Error('unexpected read') } })
  assert.equal(buildRestitution(poison, { enabled: false }), null)
  const data = snapshot()
  Object.defineProperty(data.readinessRows[0], 'menstruation', { get() { throw Error('unrelated property') } })
  Object.defineProperty(data.exerciseLogs[0], 'note', { get() { throw Error('unrelated property') } })
  const result = evaluate(data)
  assert.equal(result.status, 'ready')
  assert.doesNotMatch(JSON.stringify(result), /synthetic-|athleteId|menstruation|note|exercise_id/)
})
