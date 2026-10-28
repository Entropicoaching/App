import { fridayTestEnabled } from './e2eTestFlags.mjs'
// APP-COACH4: aktiveres kun ved et eksplicit kodevalg. Ingen storage eller net.
export const COACH_NOTE_SIGNAL_ENABLED = fridayTestEnabled(import.meta.env?.MODE, typeof window === 'undefined' ? '' : window.location.href)

// Den gemte samtale identificeres af athlete_id og category, som i
// sendCoachMessage og BeskederTab. Laest-markering er ikke et svar.
export function pendingCoachNotes(messages = []) {
  const threads = new Map()
  for (const message of messages || []) {
    if (!message?.athlete_id || !['athlete', 'coach'].includes(message.sender_role)) continue
    if (typeof message.content !== 'string' || !message.content.trim()) continue
    const time = Date.parse(message.created_at)
    if (!Number.isFinite(time)) continue
    const track = (message.category || 'besked') === 'teknik' ? 'teknik' : 'besked'
    let tracks = threads.get(message.athlete_id)
    if (!tracks) threads.set(message.athlete_id, tracks = new Map())
    let thread = tracks.get(track)
    if (!thread) tracks.set(track, thread = { repliedAt: -Infinity, notes: [] })
    if (message.sender_role === 'coach') thread.repliedAt = Math.max(thread.repliedAt, time)
    else thread.notes.push({ message, time })
  }
  const pending = {}
  for (const [athleteId, tracks] of threads) {
    for (const [track, thread] of tracks) {
      // Samme tidsstempel beviser ikke et senere svar. Behold signalet.
      const notes = thread.notes.filter(note => note.time >= thread.repliedAt)
        .sort((a, b) => a.time - b.time || String(a.message.id || '').localeCompare(String(b.message.id || '')))
      if (!notes.length) continue
      const byTrack = (pending[athleteId] ??= {})
      byTrack[track] = {
        count: notes.length,
        latestNote: notes[notes.length - 1].message,
        oldestAt: notes[0].message.created_at,
      }
    }
  }
  return pending
}

export * from './bridge.mjs'
