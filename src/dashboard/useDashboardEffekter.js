// ORDRE 377: flyttet uændret fra src/Dashboard.jsx (se docs/DASHBOARD-KORT.md).
// Coachens effekter efter VideoCoach-broen: opstart, snooze-migrering,
// kalender- og fanehentninger, review-åbning, scroll-lås og den friske
// indbakke. Hook kaldt nøjagtig hvor effekterne stod (samme rækkefølge).
import { useEffect } from 'react'
import { supabase } from '../supabase.js'

export function useDashboardEffekter({
  coachFourWeeksEnabled = false, coachProfileWeek = false,
  coachWeekEnabled = false, activeTab, athletes, coachMsgTrack, fetchAthleteLogs, fetchAthletePRs, fetchAthleteReadiness,
  fetchAthletes, fetchAthleteWeightLogs, fetchCalendarProgress, fetchCalendarWeeks, fetchExerciseLibrary, fetchLastBackup,
  fetchMeetPlan, fetchMeetResults, fetchMessages, fetchVideoCoachHistory, fetchWarmupTemplates, fetchWeeks,
  isMobile, loadError, loading, markMessagesRead, openAwaitingAnalysisVideo, openVideoAnalysisReview,
  refreshCoachInbox, selectedAthlete, snoozeMigratedRef, videoAnalysisReview, videoReviewOpenedRef, videoReviewRequest,
  view, weeksLogsLoadedForRef, entropi2 = false,
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
  const e2Effects = entropi2 === true
  const calendarAthletes = coachWeekEnabled ? JSON.stringify(athletes.map(a => a.id).sort()) : athletes
  useEffect(() => {
    // Entropi 2: coachskærmen (list og inbox) bygger på kalenderlæsningen, også ved direkte åbning af indbakken.
    if ((view === 'calendar' || view === 'list' || (entropi2 === true && view === 'inbox')) && athletes.length) {
      const ids = athletes.map(a => a.id)
      fetchCalendarWeeks(ids)
      fetchCalendarProgress(ids)
    }
  // Entropi 2: flaget er med i afhængighederne, så et flagskift på samme instans starter effekten igen med den aktuelle læser.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch-funktionerne kommer fra lavLaesninger (nye i hvert render, som de hoistede funktioner før ordre 377) og refs er Dashboards stabile ref-objekter; effekten kører bevidst på de samme deps som før
  }, [view, calendarAthletes, e2Effects])
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
    if ((coachProfileWeek === true || activeTab === 'program' || activeTab === 'analyse' || activeTab === 'log' || activeTab === 'oversigt') && selectedAthlete?.id) {
      if (weeksLogsLoadedForRef.current === selectedAthlete.id && coachProfileWeek !== true) return
      weeksLogsLoadedForRef.current = selectedAthlete.id
      fetchWeeks(selectedAthlete.id)
      fetchAthleteLogs(selectedAthlete.id)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch-funktionerne kommer fra lavLaesninger (nye i hvert render, som de hoistede funktioner før ordre 377) og refs er Dashboards stabile ref-objekter; effekten kører bevidst på de samme deps som før
  }, [activeTab, selectedAthlete?.id, coachProfileWeek])
  useEffect(() => {
    if (!selectedAthlete) weeksLogsLoadedForRef.current = null
  // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch-funktionerne kommer fra lavLaesninger (nye i hvert render, som de hoistede funktioner før ordre 377) og refs er Dashboards stabile ref-objekter; effekten kører bevidst på de samme deps som før
  }, [selectedAthlete])

  useEffect(() => {
    if ((coachProfileWeek === true || activeTab === 'beskeder') && selectedAthlete?.id) {
      fetchMessages(selectedAthlete.id)
      if (activeTab === 'beskeder') markMessagesRead(selectedAthlete.id, coachMsgTrack)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- markMessagesRead læser athletes synkront ved kørsel, ikke en ældre snapshot
  }, [activeTab, selectedAthlete?.id, coachMsgTrack, coachProfileWeek])

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
    if ((coachProfileWeek === true || activeTab === 'hub' || activeTab === 'analyse' || (coachFourWeeksEnabled === true && activeTab === 'oversigt')) && selectedAthlete?.id) {
      fetchVideoCoachHistory(selectedAthlete.id)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch-funktionerne kommer fra lavLaesninger (nye i hvert render, som de hoistede funktioner før ordre 377) og refs er Dashboards stabile ref-objekter; effekten kører bevidst på de samme deps som før
  }, [activeTab, selectedAthlete?.id, coachFourWeeksEnabled, coachProfileWeek])

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
    // Entropi 2: coachskærmen afviser gårsdagens læsninger; ved dansk dagsskifte fornyes de straks.
    let dayTimer = null
    if (entropi2 === true) {
      const day = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Copenhagen', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
      let seen = day()
      dayTimer = window.setInterval(() => { const now = day(); if (now !== seen) { seen = now; refreshCoachInbox() } }, 60 * 1000)
    }

    return () => {
      window.removeEventListener('focus', refreshWhenVisible)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
      window.clearInterval(intervalId)
      if (dayTimer !== null) window.clearInterval(dayTimer)
    }
    // Funktionskaldet læser seneste atletliste fra ref; view styrer abonnementets levetid.
    // Entropi 2: et flagskift installerer timere og lyttere igen med læseren fra den aktuelle flagtilstand.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, loading, loadError, e2Effects])
}
