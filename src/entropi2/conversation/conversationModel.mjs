import { conversationThread, athleteUnread } from '../../indbakke2.mjs'

export const DEFAULT_ENTROPI2 = false
export function entropi2Enabled(search = '') {
  const values = new URLSearchParams(search).getAll('entropi2')
  return values.length === 1 && values[0] === '1'
}
export const validId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,120}$/.test(value)
const validRole = role => role === 'athlete' || role === 'coach'
export function threadFor(athleteId, messages = [], analyses = []) {
  if (!validId(athleteId)) return []
  const unique = rows => [...new Map(rows.filter(row => row && validId(row.id)
    && row.athlete_id === athleteId).map(row => [row.id, row])).values()]
  const videos = unique(analyses).filter(row => row.status === 'shared'
    || row.source_mode === 'athlete_submission' && row.status === 'draft')
  return conversationThread(unique(messages).filter(row => validRole(row.sender_role)
    && typeof row.content === 'string'), videos).map(item => ({ ...item,
      unreadAthlete: item.kind === 'video' ? item.value.status === 'shared' && athleteUnread(item) : athleteUnread(item),
      unreadCoach: item.kind === 'video' ? item.value.source_mode === 'athlete_submission' && !item.value.conversationCoachSeenAt
        : item.value.sender_role === 'athlete' && !item.value.read_by_coach,
    }))
}
export function feedbackText(row) {
  if (row.status !== 'shared') return row.session_context?.athlete_note || 'Video sendt til coach. Afventer feedback.'
  const feedback = row.athlete_feedback || {}
  return ['works', 'focus', 'next_set'].flatMap(key => (Array.isArray(feedback[key]) ? feedback[key] : [])
    .filter(item => typeof item?.text === 'string').map(item => item.text)).join('\n') || 'Videofeedback uden tekst.'
}
// A technique message with a human-readable reference, using only messages.content.
// No new wire protocol or claim that a local playback document was shared.
export function timestampContent(row, seconds, text) {
  if (!row || !validId(row.id) || typeof seconds !== 'number' || !Number.isFinite(seconds)
    || seconds < 0 || seconds >= 7200 || typeof text !== 'string' || !text.trim() || text.trim().length > 600)
    throw Error('Vælg video, tidspunkt og en tekst på højst 600 tegn.')
  return `Video ${row.id} (${row.lift || 'løft'}) ved ${seconds.toFixed(2)} s\n${text.trim()}`
}
