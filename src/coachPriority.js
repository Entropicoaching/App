import { AUTOMATION_ALERT_COLOR, AUTOMATION_ALERT_LABEL, automationAlertDetail, filterOpenAutomationAlerts } from './automationAlerts.js'
import { MESSAGE_VIDEO_RANK, signalRank } from './coachBriefingRules.js'

// ORDRE 377: samme rækkefølge som Coach Briefing-mailen (ORDRE 370):
// smerte 0 · fravær 1 · afvigelse fra plan 2 · beskeder/videoer 3 ·
// fremgang (PR) 4; inden for samme rang alert (+0) før context (+0,5).
// Tabellen er DETECTOR_RANK i coachBriefingRules.js, som n8n spejler.
// En automatiseringsfejl er ikke i mailen; den står efter beskeder og
// videoer og før fremgang.
export const AUTOMATION_RANK = MESSAGE_VIDEO_RANK + 0.75

export function buildCoachPriorityItems({ athletes, trainingSignals, unreadByTrack, latestByTrack, videoReviewQueue, describeVideo, automationAlerts = [], now = Date.now() }) {
  const athleteById = new Map(athletes.map(athlete => [athlete.id, athlete]))
  const items = []

  // ORDRE 301: en automatiseringsfejl har ingen atlet, så den må ikke gå
  // gennem athleteById-opslaget som de andre typer. Rang: se AUTOMATION_RANK.
  filterOpenAutomationAlerts(automationAlerts).forEach(alert => {
    items.push({
      key: `automation-${alert.id}`,
      kind: 'automation', alert,
      rank: AUTOMATION_RANK,
      color: AUTOMATION_ALERT_COLOR,
      label: AUTOMATION_ALERT_LABEL,
      title: alert.workflow_name || 'Ukendt workflow',
      detail: automationAlertDetail(alert, now),
      createdAt: alert.occurred_at,
    })
  })

  trainingSignals.forEach(signal => {
    const athlete = athleteById.get(signal.o_athlete_id)
    if (!athlete) return
    const alert = signal.o_severity === 'alert'
    const detectorLabel = signal.o_detector === 'dropout' ? 'Træningsmængde'
      : signal.o_detector === 'stagnation' ? 'Udvikling'
        : signal.o_detector === 'rpe_drift' ? 'RPE'
          : signal.o_detector === 'pain' ? 'Smerte'
            : signal.o_detector === 'missed_sessions' ? 'Fremmøde'
              : signal.o_detector === 'data_conflict' ? 'Datatjek'
                : signal.o_detector === 'pr' ? 'PR' : 'Træning'
    items.push({
      key: `signal-${signal.o_athlete_id}-${signal.o_detector}`,
      kind: 'signal', athlete, signal,
      rank: signalRank({ detector: signal.o_detector, severity: signal.o_severity }),
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
        rank: MESSAGE_VIDEO_RANK, color: track === 'teknik' ? '#67dff5' : '#c8923a',
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
      rank: MESSAGE_VIDEO_RANK, color: '#67dff5', label: 'Video',
      title: athlete.name,
      detail: describeVideo(video),
      createdAt: video.created_at || video.analyzed_at,
    })
  })

  const itemTime = item => {
    const value = item.createdAt ? new Date(item.createdAt).getTime() : Number.POSITIVE_INFINITY
    return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY
  }
  // Som mailen: rang, ældste besked/video, atletens navn; titlen til sidst.
  const itemName = item => item.athlete?.name || item.title
  return items.sort((left, right) => left.rank - right.rank || itemTime(left) - itemTime(right)
    || itemName(left).localeCompare(itemName(right), 'da') || left.title.localeCompare(right.title, 'da'))
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
  // "Næste opgave" åbner en atlets profil; en automatiseringsfejl har ingen
  // atlet og hører ikke til den gennemgang.
  const queue = (items || []).filter(item => item?.key && item.kind !== 'automation')
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
