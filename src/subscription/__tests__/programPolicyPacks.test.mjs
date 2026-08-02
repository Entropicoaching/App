import test from 'node:test'
import assert from 'node:assert/strict'

import { findTemplate } from '../programTemplates.js'
import { findPolicyPack, POLICY_PACK_SCHEMA_VERSION, PROGRAM_POLICY_PACKS } from '../programPolicyPacks.js'

test('to-dages policy-pakken dækker alle template-roller uden færdige recepter', () => {
  assert.equal(POLICY_PACK_SCHEMA_VERSION, 1)
  const template = findTemplate('general-strength-2')
  const pack = findPolicyPack(template.id, 'general-strength')
  const expectedRoles = new Set(template.week.flatMap(session => session.roles))
  const actualRoles = new Set(pack.movementPolicies.map(policy => policy.role))
  assert.deepEqual(actualRoles, expectedRoles)
  assert.ok(pack.movementPolicies.every(policy => policy.required && policy.requiresMarcReview))

  const serialized = JSON.stringify(pack).toLowerCase()
  for (const forbidden of ['sets', 'reps', 'weight', 'rpe', 'exercise_name']) {
    assert.equal(serialized.includes(forbidden), false, `${forbidden} må ikke ligge i en review-policy`)
  }
})

test('den adaptive policy er begrænset til samme øvelses næste eksponering', () => {
  const policy = PROGRAM_POLICY_PACKS[0].progressionPolicy
  assert.equal(policy.appliesOnlyTo, 'same-exercise-next-exposure')
  assert.equal(policy.requiresUserChoice, true)
  assert.ok(policy.prohibitedActions.includes('combined-load-and-volume-increase'))
  assert.ok(policy.requiresManualReviewWhen.includes('health-signal'))
  assert.ok(policy.auditFields.includes('user-decision'))
  assert.equal(PROGRAM_POLICY_PACKS[0].substitutionRules.noEligibleCandidateOutcome, 'manual-review')
})

test('to-dagespakken har særskilte, reviewbare mål-lanes', () => {
  const general = findPolicyPack('general-strength-2', 'general-strength')
  const powerlifting = findPolicyPack('powerlifting-foundation-2', 'powerlifting-foundation')
  assert.equal(general.lane.styleBehavior, 'athlete-preference-optional')
  assert.equal(powerlifting.lane.styleBehavior, 'athlete-preference-required')
  assert.equal(findPolicyPack('general-strength-2', 'ukendt'), null)
})
