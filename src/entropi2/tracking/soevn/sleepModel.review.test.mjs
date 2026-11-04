// Separate deterministic counterexamples, not the external K-TRACK-SOEVN1 review.
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSleepOverview } from './sleepModel.mjs'

const base = () => ({ status: 'ready', complete: true, athleteId: 'synthetic-review',
  endDate: '2026-11-01', readinessRows: [], qualityRows: [], exerciseLogs: [] })
const build = data => buildSleepOverview(data, { enabled: true, weeks: 4 })
const row = (logged_date, sleep_hours) => ({ athlete_id: 'synthetic-review', logged_date, sleep_hours })

test('counterexample: independently specified window edges, means and missing quality', () => {
  const input = base()
  input.readinessRows = [row('2026-10-04', 24), row('2026-10-05', 6),
    row('2026-10-06', 7), row('2026-10-07', 8), row('2026-10-08', 9),
    row('2026-11-02', 24)]
  const result = build(input)
  assert.equal(result.from, '2026-10-05')
  assert.equal(result.days.length, 28)
  assert.deepEqual(result.weeks[0].hours, { count: 4, average: 7.5 })
  assert.ok(result.weeks.every(w => w.quality.count === 0 && w.quality.average === null))
  assert.equal(result.days.at(-1).date, '2026-11-01')
  assert.deepEqual(build({ ...input, readinessRows: [...input.readinessRows].reverse() }), result)
})

test('counterexample: quality alone is real data, never invented sleep hours', () => {
  const input = base()
  input.qualityRows = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08']
    .map(logged_date => ({ athlete_id: input.athleteId, logged_date, sleep_quality: 1 }))
  const result = build(input)
  assert.equal(result.status, 'ready')
  assert.equal(result.weeks[0].quality.average, 1)
  assert.equal(result.weeks[0].hours.average, null)
  assert.equal(result.pairedRpeDays, 0)
})

test('counterexample: same calendar date in Copenhagen, not raw UTC or previous check-in', () => {
  const input = base()
  input.readinessRows = [row('2026-10-24', 5), row('2026-10-25', 9)]
  input.exerciseLogs = [{ athlete_id: input.athleteId, id: 'synthetic-one',
    exercise_id: 'synthetic-exercise', session_id: 'synthetic-session', set_number: 1,
    logged_at: '2026-10-24T23:30:00Z', weight: 100, reps_completed: 3,
    rpe_actual: 5, rpe_planned: 9, rpe_source: 'plan', exercises: { name: 'Squat' } }]
  const result = build(input)
  assert.equal(result.sessions[0].date, '2026-10-25')
  assert.equal(result.sessions[0].hours, 9)
  assert.equal(result.sessions[0].rpe, null)
  assert.equal(result.pairedRpeDays, 0)
  assert.equal(result.pairedPerformanceDays, 1)
})

test('counterexample: foreign or failed source cannot silently produce a partial valid chart', () => {
  const input = base(); input.readinessRows = [row('2026-10-05', 8)]
  input.qualityRows = [{ athlete_id: 'synthetic-foreign', logged_date: '2026-10-05', sleep_quality: 4 }]
  assert.deepEqual(build(input), { status: 'error' })
  input.qualityRows = []; input.complete = false
  assert.deepEqual(build(input), { status: 'error' })
})
