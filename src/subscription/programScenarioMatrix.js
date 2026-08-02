// Regression matrix for the subscription-program engine.  This is deliberately
// a read-only description of the current engine surface: it does not add a
// template, exercise, prescription, or assignment path.

import { resolveProgramDraft } from './programResolver.js'
import { PROGRAM_TEMPLATES } from './programTemplates.js'

export const SCENARIO_MATRIX_VERSION = 3

export const MATRIX_DIMENSIONS = Object.freeze({
  goals: ['general-strength', 'powerlifting-foundation'],
  daysPerWeek: [2, 3, 4],
  levels: ['begynder', 'oevet'],
  equipment: ['gym', 'home'],
  squatStyles: ['', 'high-bar', 'low-bar', 'not-sure'],
  deadliftStyles: ['', 'conventional', 'sumo', 'not-sure'],
})

function scenarioId(input) {
  return [input.goal, `${input.daysPerWeek}d`, input.level, input.equipment, input.squatStyle || 'canonical-squat', input.deadliftStyle || 'canonical-deadlift'].join('__')
}

function programSummary(result) {
  if (result.outcome !== 'review-ready') return null
  const movements = result.program.sessions.flatMap(session => session.movements)
  const squat = movements.find(movement => movement.role === 'squat-pattern')
  const deadlift = movements.find(movement => movement.role === 'hinge-pattern')
  return {
    templateId: result.template.id,
    policyLaneId: result.policyLane.id,
    sessions: result.program.sessions.length,
    equipment: movements.every(movement => movement.equipment === result.selection.matchInput.equipment)
      ? result.selection.matchInput.equipment
      : 'mixed-or-wrong',
    squat: squat ? { exerciseId: squat.exerciseId, selection: squat.selection, stylePreference: squat.stylePreference } : null,
    deadlift: deadlift ? { exerciseId: deadlift.exerciseId, selection: deadlift.selection, stylePreference: deadlift.stylePreference } : null,
  }
}

export function evaluateProgramScenario(input) {
  const result = resolveProgramDraft(input)
  return {
    id: scenarioId(input),
    input: { ...input },
    outcome: result.outcome,
    reason: result.outcome === 'review-ready' ? 'review-ready' : result.reason,
    program: programSummary(result),
  }
}

export function buildProgramScenarioMatrix(dimensions = MATRIX_DIMENSIONS) {
  const scenarios = []
  for (const goal of dimensions.goals) {
    for (const daysPerWeek of dimensions.daysPerWeek) {
      for (const level of dimensions.levels) {
        for (const equipment of dimensions.equipment) {
          for (const squatStyle of dimensions.squatStyles) {
            for (const deadliftStyle of dimensions.deadliftStyles) {
              scenarios.push(evaluateProgramScenario({ goal, daysPerWeek, level, equipment, squatStyle, deadliftStyle }))
            }
          }
        }
      }
    }
  }
  return scenarios
}

export function scenarioMatrixSummary(scenarios = buildProgramScenarioMatrix()) {
  const outcomes = scenarios.reduce((counts, scenario) => {
    counts[scenario.outcome] = (counts[scenario.outcome] || 0) + 1
    return counts
  }, {})
  return {
    version: SCENARIO_MATRIX_VERSION,
    total: scenarios.length,
    outcomes,
    reviewedTemplates: PROGRAM_TEMPLATES.map(template => template.id),
  }
}

// This validator is intentionally strict.  A review-ready result may only
// originate from a reviewed canonical template.  Powerlifting never silently
// turns an unresolved style into a default exercise.
export function validateProgramScenarioMatrix(scenarios = buildProgramScenarioMatrix()) {
  const errors = []
  const knownTemplates = new Set(PROGRAM_TEMPLATES.filter(template => template.status === 'review').map(template => template.id))
  const ids = new Set()
  for (const scenario of scenarios) {
    if (ids.has(scenario.id)) errors.push(`duplicate-scenario:${scenario.id}`)
    ids.add(scenario.id)
    if (scenario.outcome !== 'review-ready') continue
    if (!scenario.program || !knownTemplates.has(scenario.program.templateId)) errors.push(`unknown-template:${scenario.id}`)
    if (scenario.program?.sessions !== scenario.input.daysPerWeek) errors.push(`wrong-session-count:${scenario.id}`)
    if (scenario.program?.equipment !== scenario.input.equipment) errors.push(`wrong-equipment:${scenario.id}`)
    if (scenario.input.goal === 'powerlifting-foundation') {
      if (!['high-bar', 'low-bar'].includes(scenario.input.squatStyle) || !['conventional', 'sumo'].includes(scenario.input.deadliftStyle)) {
        errors.push(`powerlifting-style-not-explicit:${scenario.id}`)
      }
      if (scenario.program?.squat?.selection !== 'athlete-style-preference' || scenario.program?.deadlift?.selection !== 'athlete-style-preference') {
        errors.push(`powerlifting-style-was-not-respected:${scenario.id}`)
      }
    }
    if (scenario.input.goal === 'general-strength') {
      const explicitSquat = ['high-bar', 'low-bar'].includes(scenario.input.squatStyle)
      const explicitDeadlift = ['conventional', 'sumo'].includes(scenario.input.deadliftStyle)
      if (explicitSquat && (scenario.program?.squat?.selection !== 'athlete-style-preference' || scenario.program?.squat?.stylePreference !== scenario.input.squatStyle)) {
        errors.push(`general-squat-style-was-not-respected:${scenario.id}`)
      }
      if (explicitDeadlift && (scenario.program?.deadlift?.selection !== 'athlete-style-preference' || scenario.program?.deadlift?.stylePreference !== scenario.input.deadliftStyle)) {
        errors.push(`general-deadlift-style-was-not-respected:${scenario.id}`)
      }
    }
  }
  return { ok: errors.length === 0, errors, summary: scenarioMatrixSummary(scenarios) }
}
