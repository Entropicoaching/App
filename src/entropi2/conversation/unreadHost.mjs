// U2: samtalens ulæst-tal føres tilbage til værten, så atletens fane-prik og
// coachens indbakke ikke bliver stående, efter at et svar er læst i samtalen.
export const CONVERSATION_UNREAD_EVENT = 'entropi2:samtale-ulaest'

export function unreadSummary(snapshot) {
  if (!snapshot?.available || !snapshot.loaded || !snapshot.athleteId) return null
  const unread = item => snapshot.role === 'athlete' ? item.unreadAthlete : item.unreadCoach
  const thread = snapshot.thread || []
  return {
    role: snapshot.role, athleteId: snapshot.athleteId,
    messages: thread.filter(item => item.kind === 'message' && unread(item)).length,
    videos: thread.filter(item => item.kind === 'video' && unread(item)).length,
    readVideoIds: thread.filter(item => item.kind === 'video' && !unread(item)).map(item => item.value.id),
  }
}

export const sameUnread = (a, b) => a === b || !!a && !!b && a.role === b.role && a.athleteId === b.athleteId
  && a.messages === b.messages && a.videos === b.videos
  && a.readVideoIds.length === b.readVideoIds.length && a.readVideoIds.every((id, i) => id === b.readVideoIds[i])

// Atletens delte videoer: en video, samtalen har vist som læst, tæller ikke længere i prikken.
export function seenSharedVideos(analyses, summary, now = new Date().toISOString()) {
  if (summary?.role !== 'athlete' || !Array.isArray(analyses) || !summary.readVideoIds?.length) return analyses
  const read = new Set(summary.readVideoIds)
  let changed = false
  const next = analyses.map(row => {
    if (row?.athlete_seen_at || !read.has(row?.id)) return row
    changed = true
    return { ...row, athlete_seen_at: now }
  })
  return changed ? next : analyses
}

// Atlet: værtens egne setters (fanens prik). Coach: en begivenhed, som coachens
// indbakke lytter efter; den første opgørelse ved åbning sendes ikke, kun ændringer.
export function shareUnread(entry, summary, previous, target = globalThis.window) {
  if (!summary) return
  if (summary.role === 'athlete' && entry?.athlete?.id === summary.athleteId) {
    entry.setUnreadMsgCount?.(summary.messages)
    entry.setSharedVideoAnalyses?.(prev => seenSharedVideos(prev, summary))
  }
  if (summary.role === 'coach' && previous && typeof target?.dispatchEvent === 'function')
    target.dispatchEvent(new CustomEvent(CONVERSATION_UNREAD_EVENT, { detail: summary }))
}
