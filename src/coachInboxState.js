export function coachMessageTrack(message) {
  return (message?.category || 'besked') === 'teknik' ? 'teknik' : 'besked'
}

export function summarizeCoachMessages(messages) {
  const unreadCounts = {}
  const unreadByTrack = {}
  const latestByTrack = {}

  for (const message of messages || []) {
    if (!message?.athlete_id) continue
    const track = coachMessageTrack(message)
    const latest = (latestByTrack[message.athlete_id] ??= {})
    if (!latest[track]) latest[track] = message
    if (message.sender_role !== 'athlete' || message.read_by_coach) continue

    unreadCounts[message.athlete_id] = (unreadCounts[message.athlete_id] || 0) + 1
    const byTrack = (unreadByTrack[message.athlete_id] ??= { teknik: 0, besked: 0 })
    byTrack[track]++
  }

  return { unreadCounts, unreadByTrack, latestByTrack }
}

export function filterDraftVideoReviews(analyses) {
  return (analyses || []).filter(item => item?.id && item?.athlete_id && item.status === 'draft')
}

function stableSignalValue(value) {
  if (Array.isArray(value)) return value.map(stableSignalValue)
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((result, key) => {
      result[key] = stableSignalValue(value[key])
      return result
    }, {})
  }
  return value
}

export function trainingSignalFingerprint(signal) {
  return JSON.stringify(stableSignalValue({
    severity: signal.o_severity,
    metrics: signal.o_metrics || {},
  }))
}

export function filterOpenTrainingSignals(signals, actions, now = Date.now()) {
  const rank = { alert: 0, context: 1 }
  const candidates = (signals || [])
    .filter(item => item?.o_athlete_id && (item.o_severity === 'alert' || item.o_severity === 'context'))
    .sort((left, right) => (rank[left.o_severity] - rank[right.o_severity]) ||
      (left.o_athlete_name || '').localeCompare(right.o_athlete_name || ''))
  const actionBySignal = new Map((actions || []).map(action =>
    [`${action.athlete_id}:${action.detector}`, action]))

  return candidates.filter(signal => {
    const action = actionBySignal.get(`${signal.o_athlete_id}:${signal.o_detector}`)
    if (!action) return true
    if (action.snoozed_until && new Date(action.snoozed_until).getTime() > now) return false
    return action.signal_fingerprint !== trainingSignalFingerprint(signal)
  })
}

export function createSingleFlightRunner() {
  let inFlight = null
  return run => {
    if (inFlight) return inFlight
    const request = (async () => run())()
    inFlight = request.finally(() => { inFlight = null })
    return inFlight
  }
}
