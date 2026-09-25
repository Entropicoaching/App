// ORDRE 377: flyttet uændret fra src/Dashboard.jsx (se docs/DASHBOARD-KORT.md).
// Coach Briefing-køen (buildCoachPriorityItems, kø-kontekst), nyeste gemte
// måling pr. atlet og mailens deep-link-effekt. Hook kaldt nøjagtig hvor
// koden stod, så effekt-rækkefølgen er uændret.
import { useEffect } from 'react'
import { buildCoachPriorityItems, coachPriorityQueueContext } from '../coachPriority'
import { coachVideoPriorityDetail } from './coachVideoHjaelp'
import { coachInboxFocusDecision } from '../coachInboxState'

export function useCoachPrioritet({
  athletes, automationAlerts, focusNextFromLinkRef, hiddenAthleteIds, inboxRefreshing, inboxRefreshStatus,
  latestByTrack, openCoachPriorityItem, profilePriorityKey, profileReturnView, trainingSignals, unreadByTrack,
  videoReviewQueue, view,
}) {
  const coachPriorityItems = buildCoachPriorityItems({
    athletes: athletes.filter(athlete => !hiddenAthleteIds.has(athlete.id)),
    trainingSignals,
    unreadByTrack,
    latestByTrack,
    videoReviewQueue,
    describeVideo: coachVideoPriorityDetail,
    automationAlerts,
  })
  const coachPriorityCount = coachPriorityItems.length
  const priorityQueueContext = profileReturnView === 'inbox'
    ? coachPriorityQueueContext(coachPriorityItems, profilePriorityKey)
    : null
  const nextPriorityItem = priorityQueueContext?.nextItem || null

  // ORDRE 266 · commit 1: nyeste GEMTE måling pr. atlet (reps_count sat),
  // udledt af videoReviewQueue (allerede hentet ved mount, sorteret nyeste
  // først) - ingen ny forespørgsel. En atlet uden nogen sporet måling
  // (fx en "Film et sæt"-video der endnu ikke er analyseret) er blot
  // fraværende her, se videoCoachMeasurementSummary.
  const videoMeasurementByAthlete = {}
  for (const video of videoReviewQueue) {
    if (video.reps_count == null || videoMeasurementByAthlete[video.athlete_id]) continue
    videoMeasurementByAthlete[video.athlete_id] = video
  }


  // Mailens sikre deep-link indeholder ingen atletidentifikator. Efter den første
  // komplette opdatering åbner appen selv den aktuelle topprioritet præcis én gang.
  useEffect(() => {
    const focusDecision = coachInboxFocusDecision({
      requested: focusNextFromLinkRef.current,
      view,
      refreshing: inboxRefreshing,
      refreshStatus: inboxRefreshStatus,
      priorityItems: coachPriorityItems,
    })
    if (!focusDecision.ready) return

    const consumeFocusIntent = () => {
      focusNextFromLinkRef.current = false
      if (typeof window === 'undefined') return
      const url = new URL(window.location.href)
      url.searchParams.delete('focus')
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
    }

    const nextItem = focusDecision.nextItem
    if (!nextItem) {
      consumeFocusIntent()
      return undefined
    }

    const openTimer = window.setTimeout(() => {
      if (!focusNextFromLinkRef.current) return
      consumeFocusIntent()
      openCoachPriorityItem(nextItem, 'inbox')
    }, 0)

    return () => window.clearTimeout(openTimer)
    // openCoachPriorityItem reads the current item only; the ref makes this one-shot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coachPriorityItems, inboxRefreshStatus, inboxRefreshing, view])

  return {
    coachPriorityItems, coachPriorityCount, priorityQueueContext, nextPriorityItem, videoMeasurementByAthlete,
  }
}
