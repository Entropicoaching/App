// Ordre 1669: antal ulæste coachbeskeder til linjen på Hjem. Samme regel som fanens prik
// (coach, ingen read_at), minus de beskeder, samtalen har meldt som set via unreadHost.
const seenByConversation = new Map()

export function noteReadMessages(athleteId, ids) {
  if (athleteId && Array.isArray(ids)) seenByConversation.set(athleteId, new Set(ids))
}

export function unreadCoachCount(messages, athleteId) {
  if (!Array.isArray(messages)) return 0
  const seen = seenByConversation.get(athleteId)
  return messages.filter(m => m?.sender_role === 'coach' && !m.read_at && !seen?.has(m.id)).length
}
