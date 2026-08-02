// Reviewede regler til programmotoren. De er bevidst ikke en øvelsesdatabase
// eller et færdigt program: konkrete øvelser og recepter tilføjes kun efter
// Marc-review i en særskilt, versionsstyret policy-version.

import { findTemplate } from './programTemplates.js'

export const POLICY_PACK_SCHEMA_VERSION = 1

export const PROGRAM_POLICY_PACKS = [
  {
    id: 'strength-base-2-policy-v1',
    templateId: 'general-strength-2',
    status: 'review',
    audience: ['general-strength', 'powerlifting-foundation'],
    lanes: [
      {
        id: 'general-strength-v1',
        goal: 'general-strength',
        label: 'Generel styrke',
        styleBehavior: 'athlete-preference-optional',
        requires: ['goal', 'level', 'daysPerWeek', 'equipment'],
        rationale: 'En enkel styrkebase med standardvarianter som udgangspunkt. Hvis brugeren aktivt vælger squat- eller dødløftstil, bruges det valg.',
      },
      {
        id: 'powerlifting-foundation-v1',
        goal: 'powerlifting-foundation',
        label: 'Styrkeløftfundament',
        styleBehavior: 'athlete-preference-required',
        requires: ['goal', 'level', 'daysPerWeek', 'equipment', 'squatStyle', 'deadliftStyle'],
        rationale: 'Hovedløftene følger brugerens eksplicitte squat- og dødløftstil; appen gætter ikke på dem.',
      },
    ],
    selection: {
      requires: ['goal', 'level', 'daysPerWeek', 'equipment'],
      requiresManualReviewWhen: ['no-eligible-exercise', 'pain-or-health-signal', 'changed-training-context'],
    },
    substitutionRules: {
      mode: 'deterministic-approved-family-only',
      prohibits: ['main-to-assistance-change', 'health-signal-inference', 'free-text-inference'],
      noEligibleCandidateOutcome: 'manual-review',
    },
    movementPolicies: [
      {
        role: 'squat-pattern',
        required: true,
        exercisePolicyId: 'lower-squat-primary-v1',
        substitutionFamily: 'squat-pattern',
        requiresMarcReview: true,
      },
      {
        role: 'bench-pattern',
        required: true,
        exercisePolicyId: 'upper-horizontal-press-primary-v1',
        substitutionFamily: 'horizontal-press-pattern',
        requiresMarcReview: true,
      },
      {
        role: 'hinge-pattern',
        required: true,
        exercisePolicyId: 'lower-hinge-primary-v1',
        substitutionFamily: 'hinge-pattern',
        requiresMarcReview: true,
      },
      {
        role: 'hinge-assistance',
        required: true,
        exercisePolicyId: 'lower-hinge-assistance-v1',
        substitutionFamily: 'hinge-assistance-pattern',
        requiresMarcReview: true,
      },
      {
        role: 'squat-assistance',
        required: true,
        exercisePolicyId: 'lower-squat-assistance-v1',
        substitutionFamily: 'squat-assistance-pattern',
        requiresMarcReview: true,
      },
      {
        role: 'pull',
        required: true,
        exercisePolicyId: 'upper-pull-v1',
        substitutionFamily: 'upper-pull-pattern',
        requiresMarcReview: true,
      },
    ],
    progressionPolicy: {
      id: 'same-exercise-next-exposure-v1',
      status: 'review',
      appliesOnlyTo: 'same-exercise-next-exposure',
      minimumComparableCompletedExposures: 2,
      allowedActions: ['keep-preset', 'one-preset-load-step', 'one-preset-volume-step', 'one-preset-regression-step'],
      prohibitedActions: ['combined-load-and-volume-increase', 'exercise-swap', 'frequency-change', 'programme-structure-change'],
      requiresUserChoice: true,
      requiresManualReviewWhen: ['missing-or-conflicting-log-data', 'health-signal', 'unplanned-interruption', 'repeated-marked-performance-drop'],
      auditFields: ['policy-version', 'trigger', 'previous-plan', 'proposed-plan', 'user-decision', 'undo-reference'],
    },
  },
]

export function findPolicyPack(templateId, goal = null) {
  const pack = createFallbackPolicyPack(templateId, goal) || PROGRAM_POLICY_PACKS.find(item => item.templateId === templateId)
  if (!pack) return null
  const lane = goal ? pack.lanes.find(item => item.goal === goal) : null
  return goal && !lane ? null : { ...pack, lane }
}

function createFallbackPolicyPack(templateId, goal) {
  if (!['general-strength', 'powerlifting-foundation'].includes(goal)) return null
  const template = findTemplate(templateId)
  if (!template || !template.focus.includes(goal)) return null
  const roles = [
    ['squat-pattern', 'squat-pattern'], ['bench-pattern', 'horizontal-press-pattern'], ['hinge-pattern', 'hinge-pattern'],
    ['hinge-assistance', 'hinge-assistance-pattern'], ['squat-assistance', 'squat-assistance-pattern'], ['squat-variation', 'squat-assistance-pattern'],
    ['bench-variation', 'horizontal-press-pattern'], ['upper-press-variation', 'horizontal-press-pattern'], ['upper-press-assistance', 'vertical-press-pattern'],
    ['lower-assistance', 'lower-assistance-pattern'], ['pull', 'upper-pull-pattern'], ['vertical-pull', 'vertical-pull-pattern'], ['upper-assistance', 'upper-assistance-pattern'], ['core', 'core-pattern'],
  ]
  return {
    id: `${templateId}-policy-v1`, templateId, status: 'review', audience: [goal],
    lanes: [{
      id: `${goal}-v1`, goal,
      label: goal === 'powerlifting-foundation' ? 'Styrkeloeftfundament' : 'Generel styrke',
      styleBehavior: goal === 'powerlifting-foundation' ? 'athlete-preference-required' : 'athlete-preference-optional',
      requires: goal === 'powerlifting-foundation'
        ? ['goal', 'level', 'daysPerWeek', 'equipment', 'squatStyle', 'deadliftStyle']
        : ['goal', 'level', 'daysPerWeek', 'equipment'],
      rationale: goal === 'powerlifting-foundation'
        ? 'Hovedloeftene foelger brugerens eksplicitte squat- og doedloeftstil; appen gaetter ikke paa dem.'
        : 'En styrkebase med standardvarianter som udgangspunkt. Aktive valg af squat- og doedloeftstil respekteres.',
    }],
    selection: { requires: ['goal', 'level', 'daysPerWeek', 'equipment'], requiresManualReviewWhen: ['no-eligible-exercise', 'pain-or-health-signal', 'changed-training-context'] },
    substitutionRules: { mode: 'deterministic-approved-family-only', prohibits: ['main-to-assistance-change', 'health-signal-inference', 'free-text-inference'], noEligibleCandidateOutcome: 'manual-review' },
    movementPolicies: roles.filter(([role]) => template.week.some(session => session.roles.includes(role))).map(([role, substitutionFamily]) => ({ role, required: true, exercisePolicyId: `${role}-v1`, substitutionFamily, requiresMarcReview: true })),
    progressionPolicy: {
      id: 'same-exercise-next-exposure-v1', status: 'review', appliesOnlyTo: 'same-exercise-next-exposure', minimumComparableCompletedExposures: 2,
      allowedActions: ['keep-preset', 'one-preset-load-step', 'one-preset-volume-step', 'one-preset-regression-step'],
      prohibitedActions: ['combined-load-and-volume-increase', 'exercise-swap', 'frequency-change', 'programme-structure-change'], requiresUserChoice: true,
      requiresManualReviewWhen: ['missing-or-conflicting-log-data', 'health-signal', 'unplanned-interruption', 'repeated-marked-performance-drop'],
      auditFields: ['policy-version', 'trigger', 'previous-plan', 'proposed-plan', 'user-decision', 'undo-reference'],
    },
  }
}
