const MAX_TITLE_LENGTH = 160
const MAX_DETAIL_LENGTH = 500
const MAX_EVIDENCE_LENGTH = 300
const MAX_VERSION_LENGTH = 80

function cleanText(value, maxLength) {
  if (typeof value !== 'string') return ''
  return value.replace(/\s+/g, ' ').trim().slice(0, maxLength)
}

export function sanitizeVideoCoachFeedbackEvidence(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null

  const version = cleanText(value.version, MAX_VERSION_LENGTH)
  const prioritySource = value.priority && typeof value.priority === 'object' && !Array.isArray(value.priority)
    ? value.priority : null
  const strengthSource = value.strength && typeof value.strength === 'object' && !Array.isArray(value.strength)
    ? value.strength : null

  const priority = prioritySource ? {
    title: cleanText(prioritySource.title, MAX_TITLE_LENGTH),
    why: cleanText(prioritySource.why, MAX_DETAIL_LENGTH),
    evidence: cleanText(prioritySource.evidence, MAX_EVIDENCE_LENGTH),
  } : null
  const strength = strengthSource ? {
    title: cleanText(strengthSource.title, MAX_TITLE_LENGTH),
    evidence: cleanText(strengthSource.evidence, MAX_EVIDENCE_LENGTH),
  } : null

  const safePriority = priority && priority.title && priority.evidence ? priority : null
  const safeStrength = strength && strength.title && strength.evidence ? strength : null
  if (!safePriority && !safeStrength) return null

  return {
    version: version.startsWith('coach-feedback-') ? version : 'coach-feedback-unknown',
    priority: safePriority,
    strength: safeStrength,
  }
}
