// ORDRE 377: flyttet uændret fra src/Dashboard.jsx (se docs/DASHBOARD-KORT.md).
// Coachens effekter efter VideoCoach-broen: opstart, snooze-migrering,
// kalender- og fanehentninger, review-åbning, scroll-lås og den friske
// indbakke. Hook kaldt nøjagtig hvor effekterne stod (samme rækkefølge).
import { useEffect } from 'react'
import { supabase } from '../supabase'

export function useDashboardEffekter({
  activeTab, athletes, coachMsgTrack, fetchAthleteLogs, fetchAthletePRs, fetchAthleteReadiness,
  fetchAthletes, fetchAthleteWeightLogs, fetchCalendarProgress, fetchCalendarWeeks, fetchExerciseLibrary, fetchLastBackup,
  fetchMeetPlan, fetchMeetResults, fetchMessages, fetchVideoCoachHistory, fetchWarmupTemplates, fetchWeeks,
  isMobile, loadError, loading, markMessagesRead, openAwaitingAnalysisVideo, openVideoAnalysisReview,
  refreshCoachInbox, selectedAthlete, snoozeMigratedRef, videoAnalysisReview, videoReviewOpenedRef, videoReviewRequest,
  view, weeksLogsLoadedForRef,
}) {
  // eslint-disable-next-line react-hooks/exhaustive-deps -- kører bevidst kun ved mount af Dashboard; session.user.id er fast for instansens levetid
  useEffect(() => { fetchAthletes(); fetchExerciseLibrary(); fetchLastBackup() }, [])
  // Engangs-migrering: flyt evt. gamle localStorage-snoozes ind i DB, så de ikke tabes
  // når snooze nu synces via athletes.snooze_until. Kører én gang når atleter er hentet.
  useEffect(() => {
    if (snoozeMigratedRef.current || !athletes.length) return
    snoozeMigratedRef.current = true
    let local
    try { local = JSON.parse(localStorage.getItem('entropi_calendar_snooze') || '{}') } catch { local = {} }
    const entries = Object.entries(local).filter(([id, until]) => until && athletes.some(a => a.id === id))
    if (entries.length) {
      Promise.all(entries.map(([id, until]) => supabase.from('athletes').update({ snooze_until: until }).eq('id', id)))
        .then(() => { localStorage.removeItem('entropi_calendar_snooze'); fetchAthletes() })
    } else {
      localStorage.removeItem('entropi_calendar_snooze')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [athletes])
  useEffect(() => {
    if ((view === 'calendar' || view === 'list') && athletes.length) {
      const ids = athletes.map(a => a.id)
      fetchCalendarWeeks(ids)
      fetchCalendarProgress(ids)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch-funktionerne kommer fra lavLaesninger (nye i hvert render, som de hoistede funktioner før ordre 377) og refs er Dashboards stabile ref-objekter; effekten kører bevidst på de samme deps som før
  }, [view, athletes])
  // ORDRE 175: program/log/analyse-fanerne deler samme weeks+athleteLogs-data.
  // ORDRE 185 commit 1: 'oversigt' tilføjet til listen — VolumenKort.jsx har nu
  // brug for `weeks` (planlagt mod gennemført), ikke kun `athleteLogs`.
  // Uden vagten nedenfor genhentede et klik MELLEM disse fire faner (samme
  // atlet, ingen skrivning imellem) begge kald hver gang — målt til 2 unødige
  // kald pr. faneskift (se docs/RAPPORT-175.md). Enhver ægte skrivning (tilføj
  // øvelse, omarrangér osv.) kalder allerede fetchWeeks/fetchAthleteLogs
  // eksplicit selv bagefter (grep'et før denne rettelse), så et rent
  // faneskift er trygt at springe over. weeksLogsLoadedForRef ryddes når
  // profilen lukkes (se effekten nedenfor), så et senere genbesøg altid
  // henter friskt.
  useEffect(() => {
    if ((activeTab === 'program' || activeTab === 'analyse' || activeTab === 'log' || activeTab === 'oversigt') && selectedAthlete?.id) {
      if (weeksLogsLoadedForRef.current === selectedAthlete.id) return
      weeksLogsLoadedForRef.current = selectedAthlete.id
      fetchWeeks(selectedAthlete.id)
      fetchAthleteLogs(selectedAthlete.id)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch-funktionerne kommer fra lavLaesninger (nye i hvert render, som de hoistede funktioner før ordre 377) og refs er Dashboards stabile ref-objekter; effekten kører bevidst på de samme deps som før
  }, [activeTab, selectedAthlete?.id])
  useEffect(() => {
    if (!selectedAthlete) weeksLogsLoadedForRef.current = null
  // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch-funktionerne kommer fra lavLaesninger (nye i hvert render, som de hoistede funktioner før ordre 377) og refs er Dashboards stabile ref-objekter; effekten kører bevidst på de samme deps som før
  }, [selectedAthlete])

  useEffect(() => {
    if (activeTab === 'beskeder' && selectedAthlete?.id) {
      fetchMessages(selectedAthlete.id)
      markMessagesRead(selectedAthlete.id, coachMsgTrack)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- markMessagesRead læser athletes synkront ved kørsel, ikke en ældre snapshot
  }, [activeTab, selectedAthlete?.id, coachMsgTrack])

  useEffect(() => {
    if ((activeTab === 'oversigt' || activeTab === 'analyse') && selectedAthlete?.id) {
      fetchAthleteWeightLogs(selectedAthlete.id)
      fetchAthleteReadiness(selectedAthlete.id)
      fetchAthletePRs(selectedAthlete.id)
      fetchMeetResults(selectedAthlete.id)
    }
    // Volumenkortet (ordre 177/185) bor i 'oversigt' og deler weeks+athleteLogs
    // med 'program'/'analyse'/'log' — hentes nu af den guardede effekt ovenfor.
    // Hubben viser dagens parathed i statuslinjen.
    if (activeTab === 'hub' && selectedAthlete?.id) fetchAthleteReadiness(selectedAthlete.id)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch-funktionerne kommer fra lavLaesninger (nye i hvert render, som de hoistede funktioner før ordre 377) og refs er Dashboards stabile ref-objekter; effekten kører bevidst på de samme deps som før
  }, [activeTab, selectedAthlete?.id])

  useEffect(() => {
    if ((activeTab === 'hub' || activeTab === 'analyse') && selectedAthlete?.id) {
      fetchVideoCoachHistory(selectedAthlete.id)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch-funktionerne kommer fra lavLaesninger (nye i hvert render, som de hoistede funktioner før ordre 377) og refs er Dashboards stabile ref-objekter; effekten kører bevidst på de samme deps som før
  }, [activeTab, selectedAthlete?.id])

  // Et tryk i den samlede indbakke skifter først atlet og åbner derefter
  // den konkrete måling. Rækkefølgen forhindrer reviewdata fra en anden
  // atlet i kortvarigt at blive vist under den forkerte profil.
  useEffect(() => {
    const target = videoReviewRequest?.item
    if (!target || selectedAthlete?.id !== target.athlete_id ||
        videoReviewOpenedRef.current === videoReviewRequest.token) return
    videoReviewOpenedRef.current = videoReviewRequest.token
    // ORDRE 57 · commit 2: en afventende video har intet at gennemgå endnu -
    // åbn den til sporing i stedet for den almindelige reviewmodal.
    if (target.analysis_state === 'awaiting_analysis') openAwaitingAnalysisVideo(target)
    else openVideoAnalysisReview(target)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoReviewRequest, selectedAthlete?.id])

  useEffect(() => {
    if (!videoAnalysisReview || !isMobile) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [videoAnalysisReview, isMobile])

  useEffect(() => {
    if (activeTab === 'opvarmning' && selectedAthlete?.id) {
      fetchWarmupTemplates(selectedAthlete.id)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch-funktionerne kommer fra lavLaesninger (nye i hvert render, som de hoistede funktioner før ordre 377) og refs er Dashboards stabile ref-objekter; effekten kører bevidst på de samme deps som før
  }, [activeTab, selectedAthlete?.id])

  useEffect(() => {
    if (activeTab === 'stævne' && selectedAthlete?.id) {
      fetchMeetPlan(selectedAthlete.id)
      fetchMeetResults(selectedAthlete.id)
      fetchAthletePRs(selectedAthlete.id)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch-funktionerne kommer fra lavLaesninger (nye i hvert render, som de hoistede funktioner før ordre 377) og refs er Dashboards stabile ref-objekter; effekten kører bevidst på de samme deps som før
  }, [activeTab, selectedAthlete?.id])


  // Coachens forside og indbakke holdes friske ved navigation, tilbagevenden
  // til appen og et roligt interval, mens fanen er synlig. Single-flight-runneren
  // sikrer, at fokus, interval og manuelt tryk ikke starter parallelle kald.
  useEffect(() => {
    if (loading || loadError || (view !== 'list' && view !== 'inbox')) return undefined
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refreshCoachInbox()
    }

    refreshCoachInbox()
    window.addEventListener('focus', refreshWhenVisible)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    const intervalId = window.setInterval(refreshWhenVisible, 5 * 60 * 1000)

    return () => {
      window.removeEventListener('focus', refreshWhenVisible)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
      window.clearInterval(intervalId)
    }
    // Funktionskaldet læser seneste atletliste fra ref; view styrer abonnementets levetid.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, loading, loadError])
}
