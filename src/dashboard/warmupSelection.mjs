import { WARMUP_TEMPLATES } from '../entropi2/session/opvarmning/warmupTemplates.mjs'

// Match only categories already supported by the coach editor. No Overkrop alias.
export function warmupCatalogueFor(category) {
  if (!['Squat', 'Bænkpres', 'Dødløft'].includes(category)) return []
  return WARMUP_TEMPLATES.filter(template => template.exercise_category === category)
}

// Catalogue metadata is not a stored identity. Keep the caller's exact context.
export function warmupCatalogueDraft(templateId, category, athleteId) {
  const template = warmupCatalogueFor(category).find(item => item.id === templateId)
  if (!template || athleteId === undefined) return null
  return { category, athleteId, steps: [...template.steps] }
}
