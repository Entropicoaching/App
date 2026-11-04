// Separate counterexample checks against actual modules, with fixed data.
// These are producer checks, not the fresh external K-TRACK-PLAN2 review.
import test from 'node:test'
import assert from 'node:assert/strict'
import { composeWeeklyReview } from './weeklyReview.mjs'
import { summarizeWellbeing } from './wellbeing.mjs'
import { mayReadCycle, projectCycle } from './cyclePrivacy.mjs'

const athlete = { id: 'profile', user_id: 'owner', coach_id: 'coach' }
const weekEnd = '2026-11-01'

test('counterexample: many observed days for one metric do not fill another missing metric', () => {
  const rows = Array.from({ length: 7 }, (_, i) => ({ athlete_id: athlete.id, logged_date: `2026-${i < 6 ? `10-${26 + i}` : '11-01'}`, energy: 2, sleep_hours: i < 3 ? 5 : null }))
  const result = summarizeWellbeing({ athleteId: athlete.id, weekEnd, readiness: rows })
  assert.equal(result.metrics.sleep_hours.status, 'insufficient')
  assert.equal(result.metrics.sleep_hours.mean, null)
  assert.deepEqual(result.signals.map(signal => signal.id), ['energy'])
})

test('counterexample: private cycle changes never alter ordinary weekly review or its counts', () => {
  const ordinary = { enabled: true, athleteId: athlete.id, weekEnd }
  const expected = composeWeeklyReview(ordinary)
  for (const cycle of [[], [{ cycle_day: 1 }], [{ cycle_day: 15 }, { cycle_day: 30 }]]) {
    assert.deepEqual(composeWeeklyReview({ ...ordinary, cycle }), expected)
    assert.deepEqual(composeWeeklyReview({ ...ordinary, blocks: { cycle } }), expected)
  }
})

test('counterexample: a grant from another athlete cannot disclose rows even to a current coach', () => {
  const consents = [{ athlete_id: 'someone-else', coach_id: 'coach', sharing_enabled: true }]
  assert.equal(mayReadCycle({ viewerId: 'coach', athlete, consents }), false)
  const denied = projectCycle({ viewerId: 'coach', athlete, consents, rows: [{ secret: true }] })
  assert.equal(denied, null)
  assert.equal(JSON.stringify(denied), 'null')
})

test('counterexample: one completed strength week cannot become a safe all-clear', () => {
  const result = composeWeeklyReview({ enabled: true, athleteId: athlete.id, weekEnd,
    exerciseLogs: [{ athlete_id: athlete.id, logged_at: '2026-10-26', weight: 150,
      reps_completed: 3, exercises: { name: 'Squat' } }],
  })
  assert.equal(result.status, 'insufficient')
  assert.equal(result.sections.strength.status, 'insufficient')
  assert.ok(result.sections.strength.data.lifts.every(lift => lift.drop === null))
  assert.deepEqual(result.signals, [])
  assert.equal(result.planning.automaticChanges, false)
})
