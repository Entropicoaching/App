import { FIELDS, draftKey, loadDraft } from './weeklyDraft.mjs'

// Only the immediately preceding Monday, in the same athlete's local namespace.
export function previousDraftKey(athleteId, weekStart) {
  if (!draftKey(athleteId, weekStart)) return null
  const date = new Date(`${weekStart}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() - 7)
  return draftKey(athleteId, date.toISOString().slice(0, 10))
}

export function loadSuggestedDraft(athleteId, weekStart, storage) {
  const current = loadDraft(draftKey(athleteId, weekStart), storage)
  // An unreadable current draft must never be replaced by a historical guess.
  const last = current.status === 'unavailable' ? null
    : loadDraft(previousDraftKey(athleteId, weekStart), storage)
  const previous = last?.status === 'saved' ? last.draft : null
  const suggested = current.status === 'empty' && previous
    ? FIELDS.filter(field => previous[field] !== '') : []
  return { ...current, draft: suggested.length ? { ...previous } : current.draft,
    previous, suggested }
}
