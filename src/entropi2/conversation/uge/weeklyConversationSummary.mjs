import { threadFor, validId } from '../conversationModel.mjs'

// Require an explicit offset: neither the host timezone nor its clock is consulted.
function instant(value) {
  if (typeof value !== 'string') return NaN
  const match = /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.exec(value)
  if (!match) return NaN
  const [, year, month, day] = match.map(Number)
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate()
  if (month < 1 || month > 12 || day < 1 || day > days) return NaN
  return Date.parse(value)
}

/**
 * Coach-only aggregate of one athlete's supplied conversation snapshot.
 * start/end are explicit instants for [start, end), e.g. local Mondays with
 * Copenhagen offsets. The caller owns calendar/DST selection and complete reads.
 * Unanswered = this week's athlete messages without a strictly later coach
 * message before end. Read receipts are separate; equal timestamps do not prove
 * an answer. Shared video feedback counts separately and never answers text.
 * No content, identities, storage, reads or writes leave this pure function.
 */
export function weeklyConversationSummary(options = {}) {
  if (options.enabled !== true) return null
  const { athleteId, start, end, messages = [], analyses = [] } = options
  const from = instant(start), until = instant(end)
  if (!validId(athleteId) || !Number.isFinite(from) || !Number.isFinite(until) || from >= until)
    throw new TypeError('Vælg atlet og en gyldig ugeperiode med tidszone.')
  if (!Array.isArray(messages) || !Array.isArray(analyses))
    throw new TypeError('Samtalen skal leveres som besked- og videolister.')

  // Reuse existing scoping, role, visibility and last-row-wins ID deduplication.
  const thread = threadFor(athleteId, messages, analyses)
  const dated = thread.map(item => ({ item, at: instant(item.at) }))
    .filter(({ at }) => Number.isFinite(at) && at < until)
  const week = dated.filter(({ at }) => at >= from)
  const text = week.filter(({ item }) => item.kind === 'message')
  const incoming = text.filter(({ item }) => item.value.sender_role === 'athlete')
  const latestReply = dated.reduce((latest, { item, at }) => item.kind === 'message'
    && item.value.sender_role === 'coach' ? Math.max(latest, at) : latest, -Infinity)
  return {
    totalMessages: text.length,
    athleteMessages: incoming.length,
    coachMessages: text.length - incoming.length,
    unansweredMessages: incoming.filter(({ at }) => at >= latestReply).length,
    unreadMessages: incoming.filter(({ item }) => item.unreadCoach).length,
    videoFeedback: week.filter(({ item }) => item.kind === 'video' && item.value.status === 'shared').length,
  }
}
