import test from 'node:test'
import assert from 'node:assert/strict'

import { EXERCISE_CATALOGUE } from '../exerciseCatalogue.js'
import { memberExerciseGuidance } from '../memberExerciseGuidance.js'
import { resolveProgramDraft } from '../programResolver.js'

function currentlyGeneratedExerciseIds() {
  const ids = new Set()
  for (const goal of ['general-strength', 'powerlifting-foundation']) {
    for (const level of ['begynder', 'oevet']) {
      for (const daysPerWeek of [2, 3, 4]) {
        for (const equipment of ['gym', 'home']) {
          for (const squatStyle of ['high-bar', 'low-bar']) {
            for (const deadliftStyle of ['conventional', 'sumo']) {
              const draft = resolveProgramDraft({ goal, level, daysPerWeek, equipment, squatStyle, deadliftStyle })
              assert.equal(draft.outcome, 'review-ready')
              for (const movement of draft.program.sessions.flatMap(session => session.movements)) {
                ids.add(movement.exerciseId)
              }
            }
          }
        }
      }
    }
  }
  return ids
}

test('alle øvelser som programmotoren kan generere har korte danske fokuspunkter', () => {
  for (const exerciseId of currentlyGeneratedExerciseIds()) {
    const guidance = memberExerciseGuidance(exerciseId)
    assert.ok(guidance, `${exerciseId} mangler guidance`)
    assert.equal(guidance.exerciseId, exerciseId)
    assert.ok(guidance.cues.length >= 1 && guidance.cues.length <= 2)
    assert.ok(guidance.cues.every(cue => typeof cue === 'string' && cue.trim().length > 0))
  }
})

test('hele reviewkataloget er dækket, også øvelser der kun kan vælges manuelt', () => {
  for (const exercise of EXERCISE_CATALOGUE) {
    assert.ok(memberExerciseGuidance(exercise.id), `${exercise.id} mangler guidance`)
  }
})

test('substitutioner er en direkte manuel projektion af kataloget', () => {
  for (const exercise of EXERCISE_CATALOGUE) {
    const guidance = memberExerciseGuidance(exercise.id)
    assert.equal(guidance.substitutionMode, 'manual-only')
    assert.equal(guidance.autoSelectSubstitution, false)
    assert.deepEqual(
      guidance.manualSubstitutions.map(item => item.exerciseId),
      exercise.manualSubstitutionIds,
    )
  }
})

test('kropsvægt, ekstern belastning og eksplicit tid holdes adskilt', () => {
  const bodyweight = memberExerciseGuidance('ab-wheel')
  assert.equal(bodyweight.measurement.load, 'bodyweight')
  assert.equal(bodyweight.measurement.target, 'repetitions')
  assert.equal(bodyweight.measurement.timedPrescription, null)

  const externalLoad = memberExerciseGuidance('barbell-bench-press')
  assert.equal(externalLoad.measurement.load, 'external-load')
  assert.equal(externalLoad.measurement.target, 'repetitions')

  const timedBodyweight = memberExerciseGuidance({
    exerciseId: 'home-dead-bug',
    prescription: { durationSeconds: 45 },
  })
  assert.equal(timedBodyweight.measurement.load, 'bodyweight')
  assert.equal(timedBodyweight.measurement.target, 'time')
  assert.deepEqual(timedBodyweight.measurement.timedPrescription, {
    minSeconds: 45,
    maxSeconds: 45,
    countdownSeconds: 45,
    source: 'duration-seconds',
  })
})

test('ukendte eller ufuldstændige øvelser fejler lukket', () => {
  assert.equal(memberExerciseGuidance('ukendt-øvelse'), null)
  assert.equal(memberExerciseGuidance({ exerciseId: '' }), null)
  assert.equal(memberExerciseGuidance(null), null)
})
