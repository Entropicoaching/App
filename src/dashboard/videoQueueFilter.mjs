// VC-KOE4: eksplicit kodeflag. Ingen storage, URL-flag eller netadgang.
export const VIDEO_QUEUE_FILTER_ENABLED = false

export function videoQueueItems(items = [], hiddenAthleteIds = new Set()) {
  return items.filter(item => item?.kind === 'video' && item.video?.id
    && item.athlete?.id && !hiddenAthleteIds.has(item.athlete.id))
}

export function filterVideoQueue(items, athleteId = '', lift = '') {
  return items.filter(item => (!athleteId || item.athlete.id === athleteId)
    && (!lift || item.video.lift === lift))
}

export function videoQueueOptions(items) {
  const athletes = new Map()
  const lifts = new Set()
  for (const item of items) {
    athletes.set(item.athlete.id, item.athlete.name || 'Ukendt atlet')
    if (typeof item.video.lift === 'string' && item.video.lift) lifts.add(item.video.lift)
  }
  return {
    athletes: [...athletes].map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'da') || a.id.localeCompare(b.id)),
    lifts: [...lifts].sort(),
  }
}
