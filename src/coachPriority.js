export function buildCoachPriorityItems({ athletes, trainingSignals, unreadByTrack, latestByTrack, videoReviewQueue, describeVideo }) {
  const athleteById = new Map(athletes.map(athlete => [athlete.id, athlete]))
  const items = []

  trainingSignals.forEach(signal => {
    const athlete = athleteById.get(signal.o_athlete_id)
    if (!athlete) return
    const alert = signal.o_severity === 'alert'
    const detectorLabel = signal.o_detector === 'dropout' ? 'Træningsmængde'
      : signal.o_detector === 'stagnation' ? 'Udvikling'
        : signal.o_detector === 'rpe_drift' ? 'RPE' : 'Træning'
    items.push({
      key: `signal-${signal.o_athlete_id}-${signal.o_detector}`,
      kind: 'signal', athlete, signal,
      rank: alert ? 0 : 3,
      color: alert ? '#e05555' : '#c8923a',
      label: detectorLabel,
      title: signal.o_headline,
      detail: signal.o_detail,
    })
  })

  athletes.forEach(athlete => {
    for (const track of ['teknik', 'besked']) {
      const last = latestByTrack[athlete.id]?.[track]
      const unread = unreadByTrack[athlete.id]?.[track] || 0
      if (!last || unread < 1) continue
      items.push({
        key: `message-${athlete.id}-${track}`,
        kind: 'message', athlete, track,
        rank: 1, color: track === 'teknik' ? '#67dff5' : '#c8923a',
        label: track === 'teknik' ? 'Teknik & løft' : 'Besked',
        title: athlete.name,
        detail: last.content,
        createdAt: last.created_at,
        count: unread,
      })
    }
  })

  videoReviewQueue.forEach(video => {
    const athlete = athleteById.get(video.athlete_id)
    if (!athlete) return
    items.push({
      key: `video-${video.id}`,
      kind: 'video', athlete, video,
      rank: 1, color: '#67dff5', label: 'Video',
      title: athlete.name,
      detail: describeVideo(video),
      createdAt: video.created_at || video.analyzed_at,
    })
  })

  const itemTime = item => {
    const value = item.createdAt ? new Date(item.createdAt).getTime() : Number.POSITIVE_INFINITY
    return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY
  }
  return items.sort((left, right) => left.rank - right.rank || itemTime(left) - itemTime(right) || left.title.localeCompare(right.title, 'da'))
}

export function nextCoachPriorityItem(items, currentKey) {
  return coachPriorityQueueContext(items, currentKey).nextItem
}

export function coachPriorityFocus(items) {
  const queue = (items || []).filter(item => item?.key)
  return {
    currentItem: queue[0] || null,
    remainingItems: queue.slice(1),
    remainingCount: Math.max(queue.length - 1, 0),
  }
}

export function coachPriorityTaskContext(item) {
  if (!item?.key) return null
  const isSignal = item.kind === 'signal'
  return {
    key: item.key,
    kind: item.kind,
    label: item.label || 'Opgave',
    color: item.color || '#c8923a',
    summary: (isSignal ? item.title : item.detail) || item.title || 'Åbn opgaven',
    detail: isSignal && item.detail && item.detail !== item.title ? item.detail : null,
  }
}

export function coachPriorityQueueContext(items, currentKey) {
  const queue = (items || []).filter(item => item?.key)
  const currentOpen = !!currentKey && queue.some(item => item.key === currentKey)
  const remainingItems = currentKey
    ? queue.filter(item => item.key !== currentKey)
    : queue

  return {
    state: remainingItems.length > 0 ? 'active' : currentOpen ? 'last' : 'complete',
    currentOpen,
    remainingCount: remainingItems.length,
    nextItem: remainingItems[0] || null,
  }
}
