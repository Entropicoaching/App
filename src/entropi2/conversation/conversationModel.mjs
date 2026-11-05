import { conversationThread, athleteUnread } from '../../indbakke2.mjs'

export const DEFAULT_ENTROPI2 = false
export function entropi2Enabled(search = '') {
  const values = new URLSearchParams(search).getAll('entropi2')
  return values.length === 1 && values[0] === '1'
}
export const validId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,120}$/.test(value)
// Presentation only: keep the stored reference and all ordinary message text intact.
// Use the producer's ID contract; tolerate CRLF and trailing whitespace in old data.
export function messageText(row) {
  const content = row?.content
  if (row?.sender_role !== 'coach' || row.category !== 'teknik' || typeof content !== 'string') return content
  const marker = /\r?\nVideo-id: ([^\r\n]*)\s*$/.exec(content)
  return marker && validId(marker[1].trimEnd()) ? content.slice(0, marker.index) : content
}
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
const videoDate = new Intl.DateTimeFormat('da-DK', {
  timeZone: 'Europe/Copenhagen', day: 'numeric', month: 'short',
})
// A missing or ambiguous wire timestamp must never acquire the device's timezone.
export function conversationDate(value) {
  const match = typeof value === 'string' && /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})$/.exec(value)
  if (!match) return null
  const [, year, month, day, hour, minute, second = '0', zone] = match
  const days = new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate()
  if (Number(month) < 1 || Number(month) > 12 || Number(day) < 1 || Number(day) > days
    || Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59
    || zone !== 'Z' && (Number(zone.slice(1, 3)) > 23 || Number(zone.slice(4)) > 59)) return null
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date : null
}
export function videoLabel(row) {
  const lift = typeof row?.lift === 'string' && row.lift.trim() ? row.lift.trim() : ''
  const title = lift ? `${lift[0].toLocaleUpperCase('da-DK')}${lift.slice(1)}-video` : 'Video'
  const date = conversationDate(row?.created_at)
  return date ? `${title} ${videoDate.format(date)}` : title
}
const videoSeconds = new Intl.NumberFormat('da-DK', { maximumFractionDigits: 2 })

// A technique message with a human-readable reference, using only messages.content.
// No new wire protocol or claim that a local playback document was shared.
// The last line keeps the selected analysis.id, so two videos of the same lift on the same
// day never produce the same stored reference (INTEGRATION contract: analysis.id, lift, time).
export function timestampContent(row, seconds, text) {
  if (!row || !validId(row.id) || typeof seconds !== 'number' || !Number.isFinite(seconds)
    || seconds < 0 || seconds >= 7200 || typeof text !== 'string' || !text.trim() || text.trim().length > 600)
    throw Error('Vælg video, tidspunkt og en tekst på højst 600 tegn.')
  return `${videoLabel(row)} ved ${videoSeconds.format(seconds)} s\n${text.trim()}\nVideo-id: ${row.id}`
}
