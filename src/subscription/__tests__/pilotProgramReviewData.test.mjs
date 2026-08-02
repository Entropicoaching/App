import test from 'node:test'
import assert from 'node:assert/strict'

import { FIRST_PILOT_BASELINES, FIRST_PILOT_INPUT, createFirstPilotReview } from '../pilotProgramReviewData.js'

test('fÃ¸rste 2-dages pilotreview er generatorafledt og fastholder eksplicitte varianter', () => {
  const review = createFirstPilotReview()
  assert.equal(review.status, 'review-ready')
  assert.equal(review.reviewPackage.decisionTrail.matchInput.goal, 'powerlifting-foundation')
  assert.equal(review.reviewPackage.decisionTrail.matchInput.daysPerWeek, 2)
  assert.equal(review.reviewPackage.decisionTrail.matchInput.squatStyle, 'low-bar')
  assert.equal(review.reviewPackage.decisionTrail.matchInput.deadliftStyle, 'sumo')
  assert.deepEqual(Object.fromEntries(Object.entries(review.program.baselineLoads).map(([lift, value]) => [lift, value.estimatedOneRepMaxKg])), FIRST_PILOT_BASELINES)
  assert.equal(review.program.sessions[0].movements.find(item => item.role === 'squat-pattern').exerciseId, 'low-bar-squat')
  assert.equal(review.program.sessions[1].movements.find(item => item.role === 'hinge-pattern').exerciseId, 'sumo-deadlift')
  assert.equal(review.reviewPackage.assignment, null)
})

test('pilotreview afviser ufuldstÃ¦ndige startbelastninger uden at gÃ¦tte', () => {
  const review = createFirstPilotReview({ ...FIRST_PILOT_BASELINES, bench: null })
  assert.equal(review.status, 'baseline-incomplete')
  assert.equal(review.program, null)
  assert.equal(review.validation.ok, false)
})
