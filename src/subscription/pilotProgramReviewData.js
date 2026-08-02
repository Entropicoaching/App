// Den lokale Marc-reviewflade bruger nøjagtigt samme deterministic generator
// som kunderejsen. Den udsteder ikke et program, skriver intet og indeholder
// bevidst ingen authorisation eller shadow-kobling.

import { applyBaselineLoadsToProgram, validateBaselineLoads } from './baselineLoads.js'
import { createCustomerProgram, createProgramReviewPackage } from './programReviewPackage.js'

export const FIRST_PILOT_INPUT = Object.freeze({
  schemaVersion: 4,
  goal: 'powerlifting-foundation',
  level: 'oevet',
  daysPerWeek: 2,
  equipment: 'gym',
  squatStyle: 'low-bar',
  deadliftStyle: 'sumo',
})

export const FIRST_PILOT_BASELINES = Object.freeze({ squat: 120, bench: 80, deadlift: 160 })

export function createFirstPilotReview(baselines = FIRST_PILOT_BASELINES) {
  const reviewPackage = createProgramReviewPackage(FIRST_PILOT_INPUT)
  if (reviewPackage.outcome !== 'review-ready') return { status: 'manual-review', reviewPackage, validation: null, program: null }

  const validation = validateBaselineLoads(baselines)
  const baseProgram = createCustomerProgram(reviewPackage)
  const applied = applyBaselineLoadsToProgram(baseProgram, baselines)

  return {
    status: applied.program ? 'review-ready' : 'baseline-incomplete',
    reviewPackage,
    validation,
    program: applied.program,
  }
}
