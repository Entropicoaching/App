// Lokalt feedbackformat for shadow-piloten. Dette modul kender ingen konto,
// netværk eller database: JSON-filen er det eneste output.
export const PILOT_FEEDBACK_SCHEMA_VERSION = 'entropi-pilot-feedback/v1'

export const feedbackSteps = [
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'program', label: 'Program' },
  { value: 'set-logging', label: 'Sættelogning' },
  { value: 'week-two', label: 'Uge 2' },
]

export const feedbackSeverities = [
  { value: 'blocking', label: 'Blokering' },
  { value: 'friction', label: 'Friktion' },
  { value: 'idea', label: 'Idé' },
]

const clean = value => typeof value === 'string' ? value.trim() : ''

export function validatePilotFeedback(input) {
  const errors = []
  const step = clean(input?.step)
  const severity = clean(input?.severity)
  const note = clean(input?.note)

  if (!feedbackSteps.some(option => option.value === step)) errors.push({ field: 'step', code: 'step-required' })
  if (!feedbackSeverities.some(option => option.value === severity)) errors.push({ field: 'severity', code: 'severity-required' })
  if (note.length < 8) errors.push({ field: 'note', code: 'note-minimum-8-characters' })
  if (note.length > 2000) errors.push({ field: 'note', code: 'note-max-2000-characters' })

  if (errors.length) return { ok: false, errors }
  return {
    ok: true,
    value: {
      schemaVersion: PILOT_FEEDBACK_SCHEMA_VERSION,
      kind: 'subscription-pilot-product-feedback',
      createdAt: new Date().toISOString(),
      step,
      severity,
      note,
      localOnly: true,
    },
  }
}

export function createPilotFeedbackExport(items) {
  const validItems = []
  const errors = []
  for (const item of items || []) {
    const result = validatePilotFeedback(item)
    if (result.ok) validItems.push(result.value)
    else errors.push(...result.errors)
  }
  if (!validItems.length) return { ok: false, errors: errors.length ? errors : [{ field: 'items', code: 'at-least-one-item-required' }] }
  return {
    ok: true,
    value: {
      schemaVersion: PILOT_FEEDBACK_SCHEMA_VERSION,
      kind: 'subscription-pilot-feedback-export',
      exportedAt: new Date().toISOString(),
      localOnly: true,
      items: validItems,
    },
  }
}
