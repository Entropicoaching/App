import test from 'node:test'
import assert from 'node:assert/strict'

import { defaultExerciseFor, exerciseForRolePreference, EXERCISE_CATALOGUE, EXERCISE_CATALOGUE_VERSION, findExercise, SUBSTITUTION_MODE } from '../exerciseCatalogue.js'
import { findPolicyPack } from '../programPolicyPacks.js'

test('reviewkataloget har ét miljøbundet canonical valg for hver rolle i to-dagespakken', () => {
  assert.equal(EXERCISE_CATALOGUE_VERSION, 2)
  const pack = findPolicyPack('general-strength-2', 'general-strength')
  for (const equipment of ['gym', 'home']) {
    for (const policy of pack.movementPolicies) {
      const exercise = defaultExerciseFor(policy.role, equipment)
      assert.ok(exercise, `${equipment}/${policy.role} mangler canonical øvelse`)
      assert.equal(exercise.status, 'review')
      assert.ok(exercise.equipment.includes(equipment))
      assert.equal(exercise.roleClass, policy.role === 'squat-pattern' || policy.role === 'bench-pattern' || policy.role === 'hinge-pattern' ? 'main' : 'assistance')
    }
  }
})

test('home-varianter følger hvert eksplicit squat- og dødløftvalg', () => {
  assert.equal(exerciseForRolePreference('squat-pattern', 'high-bar', 'home').id, 'home-goblet-squat')
  assert.equal(exerciseForRolePreference('squat-pattern', 'low-bar', 'home').id, 'home-box-squat')
  assert.equal(exerciseForRolePreference('hinge-pattern', 'conventional', 'home').id, 'home-dumbbell-deadlift')
  assert.equal(exerciseForRolePreference('hinge-pattern', 'sumo', 'home').id, 'home-dumbbell-sumo-deadlift')
})

test('substitutioner bliver inden for familie og kan ikke vælges automatisk', () => {
  assert.equal(SUBSTITUTION_MODE, 'manual-only')
  for (const exercise of EXERCISE_CATALOGUE) {
    for (const substituteId of exercise.manualSubstitutionIds) {
      const substitute = findExercise(substituteId)
      assert.ok(substitute, `${exercise.id} refererer til ukendt substitution`)
      assert.equal(substitute.family, exercise.family)
      assert.equal(substitute.roleClass, exercise.roleClass)
      assert.ok(exercise.equipment.some(value => substitute.equipment.includes(value)))
    }
  }
})
