// Opt-in presentation only. Receives the athlete's existing scoped reads.
export const CONTACT_LATEST_DEFAULT = false
export const CONTACT_LATEST_FLAG = 'app-kontakt2-latest'
export function contactLatestEnabled(storage) {
  try { return (storage === undefined ? globalThis.localStorage : storage)?.getItem(CONTACT_LATEST_FLAG) === '1' } catch { return false }
}

function timestamp(value) {
  if (typeof value !== 'string') return null
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.exec(value)
  if (!match) return null
  const [, y, m, d] = match
  const date = new Date(`${y}-${m}-${d}T00:00:00Z`)
  if (date.getUTCFullYear() !== +y || date.getUTCMonth() + 1 !== +m || date.getUTCDate() !== +d) return null
  const time = Date.parse(value)
  return Number.isFinite(time) ? time : null
}
export function formatContactDate(value) {
  const time = timestamp(value)
  return time === null ? 'Dato ukendt' : new Intl.DateTimeFormat('da-DK', {
    timeZone: 'Europe/Copenhagen', day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date(time))
}
export function latestContactFeedback(messages = [], analyses = []) {
  const candidates = [
    ...messages.filter(m => m?.sender_role === 'coach' && typeof m.content === 'string' && m.content.trim())
      .map(value => ({ kind: 'message', value, date: value.created_at })),
    ...analyses.filter(a => a && a.id).map(value => ({ kind: 'video', value, date: value.analyzed_at })),
  ]
  // Unknown dates follow dated feedback; ties keep the supplied order.
  candidates.sort((a, b) => (timestamp(b.date) ?? -Infinity) - (timestamp(a.date) ?? -Infinity))
  return candidates[0] || null
}

// Used by the actual contact effect; no acknowledgement in the opt-in view.
export function enterContact({ enabled = false, fetchMessages, markRead, fetchVideos, track }) {
  fetchMessages()
  if (!enabled) markRead(track)
  if (enabled || track === 'teknik') fetchVideos()
}
export function scrollContactEnd(enabled, ref) {
  if (!enabled) ref.current?.scrollIntoView({ block: 'end' })
}
