// Resolver v1 omsætter et entydigt template-match til et reviewklart programudkast.
// Udkastet er ikke træningsbart endnu: det mangler Marc-godkendte recepter og kan
// hverken tildeles eller skrives til shadow-projektet.

import { EXERCISE_CATALOGUE_VERSION, defaultExerciseFor, exerciseForRolePreference } from './exerciseCatalogue.js'
import { findPolicyPack } from './programPolicyPacks.js'
import { findTemplate } from './programTemplates.js'
import { prescriptionFor, PRESCRIPTION_LIBRARY_VERSION } from './programPrescriptions.js'
import { selectTemplate } from './templateMatcher.js'

function explicitPreferenceForRole(role, preferences) {
  const value = role === 'squat-pattern'
    ? preferences.squatStyle
    : role === 'hinge-pattern'
      ? preferences.deadliftStyle
      : null
  return value && value !== 'not-sure' ? value : null
}

function resolveSession(session, policyByRole, preferences, goal, level, equipment) {
  const movements = []
  for (const role of session.roles) {
    const policy = policyByRole.get(role)
    // General-strength preferences are independent. Choosing sumo must not be
    // discarded merely because squat style was left blank (and vice versa).
    const preference = explicitPreferenceForRole(role, preferences)
    const exercise = preference
      ? exerciseForRolePreference(role, preference, equipment)
      : defaultExerciseFor(role, equipment)
    const prescription = prescriptionFor(goal, role, level, equipment)
    if (!policy || !exercise || !prescription) return null
    movements.push({
      role,
      roleClass: exercise.roleClass,
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      selection: preference ? 'athlete-style-preference' : 'canonical-review-choice',
      stylePreference: preference,
      equipment,
      substitutionMode: 'manual-only',
      prescription,
    })
  }
  return { id: session.id, label: session.label, movements }
}

export function resolveProgramDraft(input) {
  const selection = selectTemplate(input)
  if (selection.outcome !== 'matched') {
    return { outcome: 'manual-review', selection, reason: selection.reason }
  }

  const template = findTemplate(selection.templateId)
  const policyPack = findPolicyPack(template.id, selection.matchInput.goal)
  if (!policyPack || policyPack.status !== 'review' || policyPack.lane.status === 'blocked') {
    return { outcome: 'manual-review', selection, reason: 'policy-pack-mangler-eller-er-ikke-reviewet' }
  }

  const policyByRole = new Map(policyPack.movementPolicies.map(policy => [policy.role, policy]))
  const preferences = { squatStyle: selection.matchInput.squatStyle, deadliftStyle: selection.matchInput.deadliftStyle }
  if (policyPack.lane.styleBehavior === 'athlete-preference-required'
      && (!preferences.squatStyle || !preferences.deadliftStyle || preferences.squatStyle === 'not-sure' || preferences.deadliftStyle === 'not-sure')) {
    return { outcome: 'manual-review', selection, reason: 'styrkeløftvariant-mangler' }
  }
  const sessions = template.week.map(session => resolveSession(
    session,
    policyByRole,
    preferences,
    selection.matchInput.goal,
    selection.matchInput.level,
    selection.matchInput.equipment,
  ))
  if (sessions.some(session => session === null)) {
    return { outcome: 'manual-review', selection, reason: 'canonical-øvelse-mangler' }
  }

  return {
    outcome: 'review-ready',
    selection,
    engineVersion: 3,
    catalogueVersion: EXERCISE_CATALOGUE_VERSION,
    prescriptionLibraryVersion: PRESCRIPTION_LIBRARY_VERSION,
    policyPackId: policyPack.id,
    policyLane: { id: policyPack.lane.id, label: policyPack.lane.label, rationale: policyPack.lane.rationale },
    template: { id: template.id, version: template.version, label: template.label },
    program: {
      status: 'review',
      days: template.days,
      sessions,
      missingBeforeAssignment: ['marc-program-version-approval', 'approved-progression-thresholds', 'approved-catalogue-status'],
    },
  }
}
