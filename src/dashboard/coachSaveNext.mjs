// Kun aktiveret ved eksplicit kodevalg. Ingen storage eller URL-overstyring.
export const COACH_SAVE_NEXT_ENABLED = false

export function canonicalFeedback(value) {
  const canonical = item => Array.isArray(item) ? item.map(canonical)
    : item && typeof item === 'object' ? Object.fromEntries(
      Object.keys(item).sort().map(key => [key, canonical(item[key])])) : item
  return JSON.stringify(canonical(value))
}

export function inboxReplyMatches(scope, kind = scope?.item?.kind) {
  if (!scope || scope.view !== 'profile' || scope.returnView !== 'inbox' ||
      !scope.key || scope.item?.key !== scope.key || !scope.athleteId) return false
  if (kind === 'message') return scope.item.kind === kind && scope.activeTab === 'beskeder' &&
    scope.key === `message-${scope.athleteId}-${scope.track}`
  return kind === 'video' && scope.item.kind === kind && scope.activeTab === 'analyse' &&
    scope.key === `video-${scope.analysisId}`
}

// KÃ¸ens eksisterende rÃ¦kkefÃ¸lge bevares. Kun svarbare opgaver indgÃ¥r.
export function nextInboxReply(items, currentKey, completed = new Set()) {
  return (items || []).find(item => item?.key && item.key !== currentKey &&
    !completed.has(item.key) && item.athlete?.id &&
    (item.kind === 'message' || item.kind === 'video')) || null
}

export function createInboxSaveNext({ enabled = COACH_SAVE_NEXT_ENABLED, scopeRef, run,
  persist, open, complete, setBusy, setError }) {
  return async (kind, text) => {
    const start = scopeRef.current
    if (enabled !== true || run.busy || !inboxReplyMatches(start, kind) ||
        run.completed.has(start.key)) return false
    if (typeof text !== 'string' || !text.trim()) {
      setError('Skriv et svar fÃ¸r du gemmer.')
      return false
    }
    run.busy = true
    setBusy(true)
    setError(null)
    const stillHere = () => {
      const now = scopeRef.current
      return inboxReplyMatches(now, kind) && now.key === start.key &&
        now.visitId === start.visitId && now.athleteId === start.athleteId && now.track === start.track &&
        now.analysisId === start.analysisId
    }
    try {
      // Handlere skal bekrÃ¦fte en persisteret rÃ¦kke. Undefined er aldrig succes.
      if (await persist(kind) !== true) {
        if (stillHere()) setError('Svaret kunne ikke bekrÃ¦ftes gemt. Dit svar er bevaret.')
        return false
      }
      run.completed.add(start.key)
      if (!stillHere()) return true
      const next = nextInboxReply(scopeRef.current.items, start.key, run.completed)
      if (next) open(next)
      else complete()
      return true
    } catch {
      if (stillHere()) setError('Svaret kunne ikke gemmes. Dit svar er bevaret.')
      return false
    } finally {
      run.busy = false
      setBusy(false)
    }
  }
}
