import test from 'node:test'
import assert from 'node:assert/strict'
import { readCoachRestitution, hasRestitutionData, startCoachRestitution } from './coachRestitutionData.mjs'
import { buildRestitution } from './restitutionModel.mjs'

// Separate literal counterexamples: no producer fixtures or copied calculations.
const scope = { coachId: 'review-coach', athleteId: 'review-athlete', asOf: '2026-03-31' }
const literal = () => ({ readinessRows: ['2026-03-24', '2026-03-26', '2026-03-28', '2026-03-30'].map(logged_date => ({
  athlete_id: 'review-athlete', logged_date, sleep_hours: 7.5, energy: 4, stress: 2, soreness_level: 1,
})), exerciseLogs: ['2026-03-17', '2026-03-23', '2026-03-24', '2026-03-30'].map((logged_at, i) => ({
  athlete_id: 'review-athlete', id: `review-${i}`, exercise_id: `review-exercise-${i}`,
  set_number: 1, logged_at, weight: [100, 150, 120, 180][i], reps_completed: 4, skipped: false,
})) })
function source(data, done = response => Promise.resolve(response)) {
  const calls = []
  return { calls, client: { from(table) {
    calls.push([table])
    const q = {}
    for (const method of ['select', 'eq', 'gte', 'lte', 'lt', 'order']) q[method] = (...args) => {
      calls.push([table, method, ...args]); return q
    }
    q.limit = () => done({ data: table === 'readiness_logs' ? data.readinessRows : data.exerciseLogs })
    return q
  } } }
}

test('independent final adapter: literal 1000/1200 across spring DST; exact Copenhagen cutoff', async () => {
  const data = literal()
  // March 30 22:00 UTC is March 31 locally, so this valid row is outside the period.
  data.exerciseLogs.push({ ...data.exerciseLogs[3], id: 'review-extra', exercise_id: 'review-extra-exercise',
    logged_at: '2026-03-30T22:00:00Z', weight: 900 })
  const mock = source(data), snapshot = await readCoachRestitution(mock.client, scope)
  const result = buildRestitution(snapshot, { enabled: true })
  assert.deepEqual([result.from, result.recentFrom, result.to], ['2026-03-17', '2026-03-24', '2026-03-30'])
  assert.deepEqual([result.load.previous.tonnage, result.load.recent.tonnage, result.load.ratio, result.level], [1000, 1200, 1.2, 'god'])
  assert.ok(mock.calls.some(c => JSON.stringify(c) === JSON.stringify(['exercise_logs', 'gte', 'logged_at', '2026-03-16T00:00:00Z'])))
  assert.ok(mock.calls.some(c => JSON.stringify(c) === JSON.stringify(['exercise_logs', 'lt', 'logged_at', '2026-03-31T00:00:00Z'])))
  assert.doesNotMatch(JSON.stringify(result), /review-|athlete_id|exercise_id/)
})

test('independent final gate: legacy arrays do not establish completeness or missing-source presence', async () => {
  const data = literal()
  assert.equal(hasRestitutionData({ ...scope, ...data, enabled: true }), true)
  assert.equal(hasRestitutionData({ ...scope, ...data, exerciseLogs: [], enabled: true }), false)
  const snapshot = await readCoachRestitution(source({ readinessRows: [data.readinessRows[3]], exerciseLogs: data.exerciseLogs }).client, scope)
  const result = buildRestitution(snapshot, { enabled: true })
  assert.equal(result.status, 'insufficient'); assert.equal(result.level, null)
  assert.deepEqual(result.metrics.sleep_hours, { count: 1, average: null })
})

test('independent final read: wrong athlete in either source prevents all status output', async () => {
  for (const rows of ['readinessRows', 'exerciseLogs']) {
    const data = literal(); data[rows][0].athlete_id = 'review-other'
    assert.deepEqual(await readCoachRestitution(source(data).client, scope), { status: 'error' })
  }
})

test('independent cancellation: rejected pending queries after disposal never publish raw error or result', async () => {
  const reject = [], updates = []
  const client = source(literal(), () => new Promise((resolve, fail) => reject.push(fail))).client
  const stop = startCoachRestitution({ enabled: true, client, scope, attempt: 0 }, result => updates.push(result))
  stop()
  reject.forEach(fail => fail(Error('review-hidden-error')))
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(updates, [])
})
