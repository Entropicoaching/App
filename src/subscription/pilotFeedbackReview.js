// Local-only triage for pilot feedback exports. This deliberately produces
// decisions, not athlete data or coach instructions: it helps Marc see where
// a pilot is blocked before expanding the test group.

import { PILOT_FEEDBACK_SCHEMA_VERSION, feedbackSeverities, feedbackSteps, validatePilotFeedback } from './pilotFeedback.js'

const stepLabel = Object.fromEntries(feedbackSteps.map(item => [item.value, item.label]))
const severityLabel = Object.fromEntries(feedbackSeverities.map(item => [item.value, item.label]))

export function validatePilotFeedbackExport(input) {
  const errors = []
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, errors: [{ field: 'export', code: 'object-required' }] }
  if (input.schemaVersion !== PILOT_FEEDBACK_SCHEMA_VERSION) errors.push({ field: 'schemaVersion', code: 'unsupported-schema' })
  if (input.kind !== 'subscription-pilot-feedback-export') errors.push({ field: 'kind', code: 'unexpected-export-kind' })
  if (!Array.isArray(input.items) || !input.items.length) errors.push({ field: 'items', code: 'at-least-one-item-required' })

  const items = []
  for (const [index, item] of (input.items || []).entries()) {
    const checked = validatePilotFeedback(item)
    if (!checked.ok) errors.push(...checked.errors.map(error => ({ ...error, index })))
    else items.push({ ...item, step: checked.value.step, severity: checked.value.severity, note: checked.value.note })
  }
  return errors.length ? { ok: false, errors } : { ok: true, value: { ...input, items } }
}

export function triagePilotFeedbackExport(input) {
  const checked = validatePilotFeedbackExport(input)
  if (!checked.ok) return { ok: false, errors: checked.errors }

  const items = checked.value.items
  const byStep = feedbackSteps.map(({ value }) => ({
    step: value,
    label: stepLabel[value],
    total: items.filter(item => item.step === value).length,
    blockers: items.filter(item => item.step === value && item.severity === 'blocking').length,
    friction: items.filter(item => item.step === value && item.severity === 'friction').length,
    ideas: items.filter(item => item.step === value && item.severity === 'idea').length,
  }))
  const blockers = items.filter(item => item.severity === 'blocking')
  const friction = items.filter(item => item.severity === 'friction')
  const mostAffected = [...byStep].sort((a, b) => b.blockers - a.blockers || b.friction - a.friction || b.total - a.total)[0]
  let recommendation
  if (blockers.length) recommendation = { status: 'hold-pilot', label: 'Stop udvidelse', rationale: `${blockers.length} blokering${blockers.length === 1 ? '' : 'er'} skal reproduceres og løses før næste tester.` }
  else if (items.length < 3) recommendation = { status: 'collect-more-feedback', label: 'Indsaml mere feedback', rationale: 'Mindre end tre konkrete observationer er for lidt til at prioritere et produktindgreb.' }
  else if (friction.length) recommendation = { status: 'fix-friction-before-expansion', label: 'Løs friktion før udvidelse', rationale: `${friction.length} friktionspunkt${friction.length === 1 ? '' : 'er'} bør vurderes mod den mest berørte del af rejsen.` }
  else recommendation = { status: 'ready-for-next-small-cohort', label: 'Klar til næste lille testgruppe', rationale: 'Ingen blokeringer eller friktioner er registreret i dette eksportudsnit. Hold stadig testgruppen lille.' }

  return { ok: true, value: {
    itemCount: items.length,
    blockerCount: blockers.length,
    frictionCount: friction.length,
    ideaCount: items.filter(item => item.severity === 'idea').length,
    byStep,
    blockers: blockers.map(item => ({ ...item, stepLabel: stepLabel[item.step], severityLabel: severityLabel[item.severity] })),
    mostAffected,
    recommendation,
  } }
}
