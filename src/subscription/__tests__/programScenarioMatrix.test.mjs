import test from 'node:test'
import assert from 'node:assert/strict'

import { buildProgramScenarioMatrix, evaluateProgramScenario, scenarioMatrixSummary, validateProgramScenarioMatrix } from '../programScenarioMatrix.js'

test('scenario-matrixen dækker hele den nuværende inputflade deterministisk', () => {
  const first = buildProgramScenarioMatrix()
  const second = buildProgramScenarioMatrix()
  assert.deepEqual(first, second)
  assert.equal(first.length, 384)
  assert.equal(new Set(first.map(scenario => scenario.id)).size, first.length)
  assert.deepEqual(scenarioMatrixSummary(first), scenarioMatrixSummary(second))
})

test('matrixvalidatoren accepterer kun reviewede templates og ingen gættede styrkeløftvarianter', () => {
  const validation = validateProgramScenarioMatrix()
  assert.equal(validation.ok, true, validation.errors.join('\n'))
  assert.ok(validation.summary.outcomes['review-ready'] > 0)
  assert.ok(validation.summary.outcomes['manual-review'] > 0)
})

test('v3-matrixen dækker begge niveauer, miljøer og alle tre frekvenser', () => {
  const scenarios = buildProgramScenarioMatrix()
  for (const goal of ['general-strength', 'powerlifting-foundation']) {
    for (const level of ['begynder', 'oevet']) {
      for (const daysPerWeek of [2, 3, 4]) {
        for (const equipment of ['gym', 'home']) {
          const scenario = scenarios.find(item => item.input.goal === goal && item.input.level === level && item.input.daysPerWeek === daysPerWeek && item.input.equipment === equipment && item.input.squatStyle === 'high-bar' && item.input.deadliftStyle === 'conventional')
          assert.equal(scenario?.outcome, 'review-ready', `${goal}/${level}/${daysPerWeek}d/${equipment} skal kunne reviewes`)
          assert.equal(scenario?.program.sessions, daysPerWeek)
        }
      }
    }
  }
})

test('samme input viser altid samme konkrete variant, og uklare styrkeløftvalg stopper', () => {
  const sumo = evaluateProgramScenario({ goal: 'powerlifting-foundation', daysPerWeek: 3, level: 'oevet', equipment: 'gym', squatStyle: 'low-bar', deadliftStyle: 'sumo' })
  assert.equal(sumo.outcome, 'review-ready')
  assert.equal(sumo.program.squat.exerciseId, 'low-bar-squat')
  assert.equal(sumo.program.deadlift.exerciseId, 'sumo-deadlift')

  const unclear = evaluateProgramScenario({ goal: 'powerlifting-foundation', daysPerWeek: 3, level: 'oevet', equipment: 'gym', squatStyle: 'not-sure', deadliftStyle: 'sumo' })
  assert.equal(unclear.outcome, 'manual-review')
  assert.equal(unclear.reason, 'styrkeløftvariant-mangler')
  assert.equal(unclear.program, null)
})

test('generel styrke bevarer ét eksplicit variantvalg uden at kræve det andet', () => {
  const onlySumo = evaluateProgramScenario({ goal: 'general-strength', daysPerWeek: 4, level: 'begynder', equipment: 'home', squatStyle: '', deadliftStyle: 'sumo' })
  assert.equal(onlySumo.outcome, 'review-ready')
  assert.equal(onlySumo.program.squat.selection, 'canonical-review-choice')
  assert.equal(onlySumo.program.deadlift.exerciseId, 'home-dumbbell-sumo-deadlift')
  assert.equal(onlySumo.program.deadlift.stylePreference, 'sumo')
})
