import test from 'node:test'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { verifyBarPathView, verifyOff } from './barPathViewCases.mjs'
import { CoachVideoCoach, AthleteVideoCoach } from './VideoCoach.mjs'
import { createReviewController } from './reviewController.mjs'
import { syntheticLift } from './barPathFixtures.mjs'
import assert from 'node:assert/strict'

test('real React: actual review renders synthetic path, empty, error and calibration states', () => verifyBarPathView(h, renderToStaticMarkup))
test('real React: default and explicit OFF never read analysis inputs', () => verifyOff(h))
test('real React: actual native wrapper renders controller analysis and both OFF wrappers stay empty', () => {
  const controller = createReviewController({ enabled: true, analysisId: 'synthetic-review', duration: 5 })
  controller.syntheticBarPath(syntheticLift().samples, { plateDiameterCm: 45 })
  assert.match(renderToStaticMarkup(h(CoachVideoCoach, { controller })), /114 målte · 7 estimerede/)
  controller.dispose()
  const off = createReviewController()
  assert.equal(renderToStaticMarkup(h(CoachVideoCoach, { controller: off })), '')
  assert.equal(renderToStaticMarkup(h(AthleteVideoCoach, { controller: off })), '')
  off.dispose()
})
