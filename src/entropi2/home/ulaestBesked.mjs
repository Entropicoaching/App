// Ordre 1669: antal ulæste coachbeskeder til linjen på Hjem. Samme regel som fanens prik
// (coach, ingen read_at), minus de beskeder, samtalen har meldt som set via unreadHost.
const seenByConversation = new Map()

// Ordre 1677: et id, der er meldt læst i denne session, forbliver læst; en senere opgørelse fjerner det ikke igen.
export function noteReadMessages(athleteId, ids) {
  if (!athleteId || !Array.isArray(ids)) return
  const seen = seenByConversation.get(athleteId) ?? new Set()
  for (const id of ids) seen.add(id)
  seenByConversation.set(athleteId, seen)
}

export function unreadCoachCount(messages, athleteId) {
  if (!Array.isArray(messages)) return 0
  const seen = seenByConversation.get(athleteId)
  return messages.filter(m => m?.sender_role === 'coach' && !m.read_at && !seen?.has(m.id)).length
}

// Ordre 1671: coachens svar på en video er en delt video_analyses-række uden athlete_seen_at, ikke en besked.
// Hjem får ikke rækkerne som prop (AthleteView er hash-låst), så den eksisterende hentning melder dem hertil.
const sharedVideos = new Map()
// Ordre 1677: en video, samtalen har meldt læst, forbliver læst, selv om en senere hentning endnu mangler athlete_seen_at.
const readVideos = new Map()

export function noteSharedVideos(athleteId, rows) {
  if (!athleteId || !Array.isArray(rows)) return
  const read = readVideos.get(athleteId)
  sharedVideos.set(athleteId, new Map(rows.filter(r => r?.id).map(r => [r.id, !!r.athlete_seen_at || !!read?.has(r.id)])))
}

export function noteReadVideos(athleteId, ids) {
  if (!athleteId || !Array.isArray(ids)) return
  const read = readVideos.get(athleteId) ?? new Set()
  for (const id of ids) read.add(id)
  readVideos.set(athleteId, read)
  const known = sharedVideos.get(athleteId)
  if (known) for (const id of ids) if (known.has(id)) known.set(id, true)
}

export function unreadVideoCount(athleteId) {
  return [...(sharedVideos.get(athleteId)?.values() ?? [])].filter(seen => !seen).length
}

// Teksten på Hjems ene linje: samme linje som 1669, kun ordene skifter, når coachen har svaret på en video.
export function unreadCoachLabel(messages, videos) {
  if (messages + videos === 0) return null
  if (videos === 0) return messages === 1 ? 'Ny besked fra din coach' : `${messages} nye beskeder fra din coach`
  if (messages === 0) return videos === 1 ? 'Coachen har svaret på din video' : `Coachen har svaret på ${videos} af dine videoer`
  return `${messages + videos} nye svar fra din coach`
}
