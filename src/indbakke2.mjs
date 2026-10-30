import { rel1030Feature } from './rel1030.mjs'
export const DEFAULT_INDBAKKE2 = false
export function indbakke2Enabled(search = '') {
  const values = new URLSearchParams(search).getAll('indbakke2')
  return (values.length === 1 && values[0] === '1') || rel1030Feature('indbakke2', search)
}
const time = value => Number.isFinite(Date.parse(value)) ? Date.parse(value) : 0
export function conversationThread(messages = [], videos = []) {
  return [
    ...messages.map(value => ({ kind: 'message', value, at: value.created_at, key: `message:${value.id}` })),
    ...videos.map(value => ({ kind: 'video', value, at: value.shared_at || value.analyzed_at || value.created_at, key: `video:${value.id}` })),
  ].sort((a, b) => time(a.at) - time(b.at) || a.key.localeCompare(b.key))
}
export function athleteUnread(item) {
  return item.kind === 'video' ? !item.value.athlete_seen_at
    : item.value.sender_role === 'coach' && !item.value.read_at
}
export function coachConversations(athletes, messages, videos) {
  return athletes.map(athlete => {
    const own = messages.filter(m => m.athlete_id === athlete.id)
    const thread = conversationThread(own, videos.filter(v => v.athlete_id === athlete.id && v.status === 'shared'))
    return { athlete, thread, unread: own.filter(m => m.sender_role === 'athlete' && !m.read_by_coach).length }
  }).sort((a, b) => Number(b.unread > 0) - Number(a.unread > 0)
    || time(b.thread.at(-1)?.at) - time(a.thread.at(-1)?.at) || a.athlete.id.localeCompare(b.athlete.id))
}

// Same athlete-scoped RPC and page size as the legacy read; opt-in reads older pages too.
export async function readSharedInboxVideos(database) {
  const data = [], seen = new Set()
  try {
    for (let offset = 0; ; offset += 6) {
      const result = await database.rpc('get_my_shared_video_analyses_v3', { p_limit: 6, p_offset: offset })
      if (result.error) return result
      const rows = Array.isArray(result.data) ? result.data : []
      for (const row of rows) {
        if (!row?.id || seen.has(row.id)) throw Error('Videofeedback kunne ikke opdateres. Prøv igen.')
        seen.add(row.id); data.push(row)
      }
      if (rows.length < 6) return { data }
    }
  } catch (error) { return { error } }
}

// Acknowledge only coach replies actually displayed in this athlete's inbox.
// Existing messages.read_at is sufficient; no schema or storage changes.
export async function acknowledgeInboxReplies({ enabled = false, database, athleteId,
  messages = [], isCurrent = () => true }) {
  if (enabled !== true || typeof athleteId !== 'string' || !athleteId || !isCurrent()) return {}
  const ids = [...new Set(messages.filter(message => message?.athlete_id === athleteId
    && message.sender_role === 'coach' && !message.read_at
    && typeof message.id === 'string' && message.id
    && typeof message.content === 'string' && message.content.trim()).map(message => message.id))]
  if (!ids.length) return {}
  try {
    const readAt = new Date().toISOString()
    const result = await database.from('messages').update({ read_at: readAt })
      .eq('athlete_id', athleteId).eq('sender_role', 'coach').in('id', ids).select('id')
    if (!isCurrent()) return {}
    const returned = new Set(Array.isArray(result?.data) ? result.data.map(row => row?.id) : [])
    if (!result || result.error || returned.size !== ids.length || ids.some(id => !returned.has(id)))
      return { error: true }
    return { messages: messages.map(message => message.athlete_id === athleteId
      && message.sender_role === 'coach' && ids.includes(message.id)
      ? { ...message, read_at: readAt } : message) }
  } catch { return isCurrent() ? { error: true } : {} }
}
