// ORDRE 377: flyttet uændret fra src/Dashboard.jsx (se docs/DASHBOARD-KORT.md).
// Navigation på coachens side: åbn en atlets profil (med returadresse og
// kø-kontekst), planflade, redigering, "Min træning" og et punkt fra Coach
// Briefing. Handler-fabrik: Dashboard kalder den i hvert render.
import { nextWeekStartDate } from '../weekDates'
import { coachPriorityTaskContext } from '../coachPriority'

export function lavNavigation({
  analyseTabFactory, athletes, calendarWeeks, isMobile, listScrollYRef, messageThreadAthleteRef,
  myAthleteId, onPreviewAthlete, setActiveTab, setAddingExercise, setAddingSession, setAddingWeek,
  setAthleteWeightLogs, setBlockPlan, setCalBlockAthlete, setCoachMsgTrack, setEditData, setEditing,
  setEditingExercise, setEditingSession, setEditingWeek, setMenuSheetOpen, setMessageInput, setMessages,
  setMessageSendError, setMessageThreadError, setOpenSessionId, setOpenWeekId, setPickingMine, setPlanAssistantFocus,
  setPlanStartDate, setPreviewPickerOpen, setProfilePriorityContext, setProfilePriorityKey, setProfileReturnView, setProgramBlockStart,
  setSelectedAthlete, setSheetPreviewPick, setShowBlockPlanner, setSidebarOpen, setVideoAnalysisReview, setVideoAnalysisReviewError,
  setVideoLiftFilter, setVideoReviewRequest, setView, setWeekDraft, setWeeks, viewRef,
}) {
  // Hop direkte ind i coachens egen atlet-profil (preview) for hurtig logging.
  // Første gang (eller hvis den gemte ikke findes): åbn picker i "vælg din egen"-mode.
  function goToMyProfile() {
    if (!onPreviewAthlete) return
    if (myAthleteId && athletes.some(a => a.id === myAthleteId)) {
      onPreviewAthlete(myAthleteId)
    } else if (isMobile) {
      // På mobil: brug menu-arkets atletvælger (aldrig desktop-sidebaren)
      setPickingMine(true)
      setSheetPreviewPick(true)
      setMenuSheetOpen(true)
    } else {
      setPickingMine(true)
      setPreviewPickerOpen(true)
      setSidebarOpen(true)
    }
  }

  // En eksplicit returadresse holder indbakkens arbejdsflow samlet. Alle andre
  // profilåbninger bevarer den hidtidige retur til atletoversigten.
  function openProfile(athlete, initialTab = 'hub', returnView = 'list', priorityKey = null, priorityContext = null) {
    // ORDRE 175: forudhent Analyse-fanens lazy chunk med det samme — coachen
    // åbner ofte "Videoer" et par klik senere (via "Mere" → "Analyse"), og
    // chunken (48 KB) hentede sig selv først PÅ det klik. En fejlet/afbrudt
    // forudhentning er harmløs: LazyBoundary/lazy() prøver selv igen ved det
    // rigtige klik, uændret.
    analyseTabFactory().catch(() => {})
    if (viewRef.current === 'list') listScrollYRef.current = window.scrollY
    setProfileReturnView(returnView === 'inbox' ? 'inbox' : 'list')
    setProfilePriorityKey(priorityKey)
    setProfilePriorityContext(priorityContext)
    setVideoAnalysisReview(null)
    setVideoAnalysisReviewError(null)
    messageThreadAthleteRef.current = athlete.id
    setSelectedAthlete(athlete)
    setActiveTab(initialTab)
    setEditing(null)
    setView('profile')
    setMessages([])
    setMessageInput('')
    setMessageThreadError(null)
    setMessageSendError(null)
    setWeeks([])
    setAthleteWeightLogs([])
    setOpenWeekId(null)
    setProgramBlockStart(null)
    setOpenSessionId(null)
    setAddingWeek(false)
    setAddingSession(null)
    setAddingExercise(null)
    setEditingWeek(null)
    setEditingSession(null)
    setEditingExercise(null)
  }

  // Åbner kun den lokale planflade for den valgte atlet. Ingen blokke eller
  // uger oprettes, før coachen senere vælger "Opret" i planlæggeren.
  function openPlanReview(planEntry) {
    setPlanStartDate(nextWeekStartDate(calendarWeeks[planEntry.athlete.id] || []))
    setPlanAssistantFocus(planEntry.suggested_focus)
    setBlockPlan([])
    setWeekDraft(null)
    setCalBlockAthlete(null)
    setShowBlockPlanner(true)
    openProfile(planEntry.athlete, 'program')
  }

  function startEdit(section, data) {
    setEditing(section)
    setEditData(data)
  }

  function openCoachPriorityItem(item, returnView = 'inbox') {
    if (!item) return
    // ORDRE 301: en automatiseringsfejl har ingen atlet at åbne; fra forsiden
    // fører rækken til Indbakken, hvor "Markeret som set" ligger.
    if (item.kind === 'automation') {
      setView('inbox')
      setSelectedAthlete(null)
      return
    }
    const priorityContext = coachPriorityTaskContext(item)
    if (item.kind === 'signal') {
      openProfile(item.athlete, 'log', returnView, item.key, priorityContext)
      return
    }
    if (item.kind === 'message') {
      setCoachMsgTrack(item.track)
      openProfile(item.athlete, 'beskeder', returnView, item.key, priorityContext)
      return
    }
    setVideoReviewRequest({ item: item.video, token: `${item.video.id}:${Date.now()}` })
    setVideoLiftFilter(item.video.lift || 'all')
    openProfile(item.athlete, 'analyse', returnView, item.key, priorityContext)
  }

  return {
    goToMyProfile, openProfile, openPlanReview, startEdit, openCoachPriorityItem,
  }
}
