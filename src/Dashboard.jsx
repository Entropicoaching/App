import { analyseMissingDataEnabled } from './analyseMissingFlag.mjs'
import { analyseConclusionMessageEnabled } from './dashboard/analyseConclusionMessage.mjs'
import { MobilityAdherenceProfile } from './mobilityAdherence.mjs'
import NytIAppen, { nytCoachNavigation } from './nytIAppen.mjs'
import { coachNotesFlag, createCoachNoteSaver } from './dashboard/coachNotes.mjs'
import { FridayChecklist, FridayChecklistEntry } from './dashboard/fridayChecklist.mjs'
import ProgramOverblik from './dashboard/ProgramOverblikView.mjs'
import { programOverblikEnabled } from './programOverblik.mjs'
import { indbakke2Enabled } from './indbakke2.mjs'
import { rel1030Enabled } from './rel1030.mjs'
import { coachMeetSoonFlag } from './dashboard/coachMeetSoon.mjs'
import { DEFAULT_VIDEO_REVIEW_TEMPLATES } from './dashboard/VideoReviewTemplates.mjs'
import { coachFollowUpFlag } from './dashboard/coachFollowUp.mjs'
import { coachMorningFlag } from './dashboard/coachMorning.mjs'
import { ProfileWeekSummary, profileWeekFlag } from './dashboard/profileWeekSummary.mjs'
import CoachFourWeeks from './dashboard/CoachFourWeeks.jsx'
import { COACH_FOUR_WEEKS_ENABLED, reduceFourWeekRead } from './dashboard/coachFourWeeks.mjs'
import { coachWeekFlag } from './dashboard/coachWeekOverview.mjs'
import { COACH_TEMPLATE_MESSAGES_ENABLED, createCoachTemplateSender } from './dashboard/coachTemplateMessages.mjs'
import { supabase } from './supabase.js'
import { coachRydEnabled, coachRydEntryView, WorkInboxLink } from './coachRyd.mjs'
import { calendarDay } from './calendarDate.js'

import { useState, useEffect, useRef } from 'react'
import LazyBoundary from './LazyBoundary.jsx'
import { coachInboxEntryIntent, createSingleFlightRunner } from './coachInboxState.js'
import { withBlockPurposes } from './periodizationAssistant.js'
import { s, currentWeekNo } from './dashboardShared.js'
import { lavLaesninger } from './dashboard/laesninger.js'
import { lavNavigation } from './dashboard/navigation.js'
import { lavIndbakkeHandlinger } from './dashboard/indbakkeHandlinger.js'
import { lavVideoReviewHandlinger } from './dashboard/videoReviewHandlinger.js'
import { lavAtletHandlinger } from './dashboard/atletHandlinger.js'
import { lavAiRapport } from './dashboard/aiRapport.js'
import { lavProgramHandlinger } from './dashboard/programHandlinger.js'
import { createWeekDeletionQueue } from './dashboard/weekDeletion.js'
import { DEFAULT_PROGRAM_COPY } from './dashboard/programCopy.js'
import WeekDeletionNotice from './dashboard/WeekDeletionNotice.jsx'
import { useVideoCoachBro } from './dashboard/useVideoCoachBro.js'
import BibliotekView from './dashboard/BibliotekView.jsx'
import KalenderView from './dashboard/KalenderView.jsx'
import ForsideView from './dashboard/ForsideView.jsx'
import HubTab from './dashboard/HubTab.jsx'
import OpvarmningTab from './dashboard/OpvarmningTab.jsx'
import OversigtTab from './dashboard/OversigtTab.jsx'
import KostTab from './dashboard/KostTab.jsx'
import LogTab from './dashboard/LogTab.jsx'
import StaevneTab from './dashboard/StaevneTab.jsx'
import NoterTab from './dashboard/NoterTab.jsx'
import BeskederTab from './dashboard/BeskederTab.jsx'
import { COACH_SAVE_NEXT_ENABLED, createInboxSaveNext, inboxReplyMatches } from './dashboard/coachSaveNext.mjs'
import VideoReviewModal from './dashboard/VideoReviewModal.jsx'
import StaevneResultatModal from './dashboard/StaevneResultatModal.jsx'
import NyAtletModal from './dashboard/NyAtletModal.jsx'
import Overlays from './dashboard/Overlays.jsx'
import Sidebar from './dashboard/Sidebar.jsx'
import MobilNav from './dashboard/MobilNav.jsx'
import ProfilHoved from './dashboard/ProfilHoved.jsx'
import WeekdayPicker from './dashboard/WeekdayPicker.jsx'
import ExFormRow from './dashboard/ExFormRow.jsx'
import BlockSequenceRows from './dashboard/BlockSequenceRows.jsx'
import { lavProfilTal } from './dashboard/profilTal.js'
import { useDashboardEffekter } from './dashboard/useDashboardEffekter.js'
import { useCoachPrioritet } from './dashboard/useCoachPrioritet.js'
import { entropi2Enabled, loadEntropi2Styles, CoachScreen, ConversationEntry, useEntropi2ReadContext, entropi2CalendarRead, entropi2ReadGate, entropi2MessageSummary, entropi2VideoQueueError, useEntropi2CoachNutrition, CoachKostMaal, useEntropi2KostVaegt, useEntropi2Dag, COACH_NOTE_SIGNAL_ENABLED } from './entropi2/coachEntry.mjs'
import { readCoachSelfAthleteId, requestCoachSelfTraining } from './coachSelfTraining.mjs'





// Lazy-loadede underfaner (ordre 130 · commit 2): coachens tungeste skærme
// (videoer, program-redigering, indbakke) hentes kun når coachen rent faktisk
// åbner dem, så atletlisten og check-in-gennemgangen ikke skal downloade dem.
// Indlæses via LazyBoundary (ordre 163 · del 2): egen fejlgrænse pr. fane, så
// en fejl i ÉN fane ikke river resten af dashboardet med sig.
const indbakke2Factory = async () => {
  const [legacy, conversations] = await Promise.all([
    import('./dashboard/IndbakkeView.jsx'), import('./dashboard/Indbakke2View.mjs'),
  ])
  return { default: conversations.withInboxConversations(legacy.default) }
}
const indbakkeFactory = () => import('./dashboard/IndbakkeView.jsx')
const analyseTabFactory = () => import('./dashboard/AnalyseTab.jsx')
const coachWeekFactory = () => import('./dashboard/AnalyseUgeevaluering.mjs')
const programTabFactory = () => import('./dashboard/ProgramTab.jsx')
// ORDRE 228 · commit 2: Volumenkortet (177/185/209/210) trækker hele
// src/volume/-træet med sig, inkl. den 53 kB genererede kortlægnings-JSON
// (muskelkort.generet.json) — kun brugt på 'oversigt'-fanen i en atlets
// profil, aldrig ved coachens første tegning af atletlisten. Samme
// LazyBoundary-mønster som de tre fane-factories ovenfor.
const volumenKortFactory = () => import('./dashboard/VolumenKort.jsx')

export default function Dashboard({ mobilitetCoach = false, mobilitetHjemme = false, mobilitetOpfoelgning = false, coachCalendarEvents = false, mobilitetHjalp = false, session, coachSelfContext, onPreviewAthlete: previewAthlete, programCopyEnabled = DEFAULT_PROGRAM_COPY, coachPlanCopyEnabled = false, blokFremgang = false, coachFourWeeksEnabled = COACH_FOUR_WEEKS_ENABLED, coachTemplateMessages = COACH_TEMPLATE_MESSAGES_ENABLED, videoReviewTemplates = DEFAULT_VIDEO_REVIEW_TEMPLATES, programOverblik = false, entropi2 }) {
  const analyseMissingData = analyseMissingDataEnabled(typeof window === 'undefined' ? '' : window.location.search)
  const analyseConclusionMessage = analyseConclusionMessageEnabled(typeof window === 'undefined' ? '' : window.location.search)
  const programOverview = programOverblik === true || programOverblikEnabled(typeof window === 'undefined' ? '' : window.location.search)
  const indbakke2 = indbakke2Enabled(typeof window === 'undefined' ? '' : window.location.search)
  const checklistEnabled = rel1030Enabled(typeof window === 'undefined' ? '' : window.location.search)
  const initialCoachEntryRef = useRef(coachInboxEntryIntent(
    typeof window === 'undefined' ? '' : window.location.search,
  ))
  const coachRyd = useRef(coachRydEnabled(typeof window === 'undefined' ? '' : window.location.search)).current
  const coachProfileWeek = profileWeekFlag(typeof window === 'undefined' ? '' : window.location.search)
  const coachNotesEnabled = coachNotesFlag(typeof window === 'undefined' ? '' : window.location.search)
  const coachWeekEnabled = coachWeekFlag(typeof window === 'undefined' ? '' : window.location.search)
  const [coachWeekDataStatus, setCoachWeekDataStatus] = useState({})
  const coachFollowUp = coachFollowUpFlag(typeof window === 'undefined' ? '' : window.location.search)
  const e2 = entropi2Enabled(entropi2) === true
  useEffect(() => { if (e2) loadEntropi2Styles() }, [e2])
  // Entropi 2 bruger morgenlæsningerne som kilde; de tændes derfor med flaget.
  const coachMorning = e2 || coachMorningFlag(typeof window === 'undefined' ? '' : window.location.search)
  const [coachMorningData, setCoachMorningData] = useState({})
  const coachMeetSoon = coachMeetSoonFlag(typeof window === 'undefined' ? '' : window.location.search)
  const [coachMeetData, setCoachMeetData] = useState({})
  const [athletes, setAthletes] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  // eslint-disable-next-line react-hooks/refs -- uændret fra før ordre 377; lint ser det først nu (se RAPPORT-377)
  const [view, setView] = useState(coachRydEntryView(coachRyd, initialCoachEntryRef.current.view))
  // eslint-disable-next-line react-hooks/refs -- uændret fra før ordre 377; lint ser det først nu (se RAPPORT-377)
  const focusNextFromLinkRef = useRef(initialCoachEntryRef.current.focusNext)
  const [profileReturnView, setProfileReturnView] = useState('list')
  const saveNextScopeRef = useRef(null)
  const saveNextRunRef = useRef({ busy: false, completed: new Set() })
  const [saveNextBusy, setSaveNextBusy] = useState(false)
  const [saveNextError, setSaveNextError] = useState(null)
  const [saveNextDone, setSaveNextDone] = useState(false)
  useEffect(() => {
    if (view === 'inbox') {
      saveNextRunRef.current.completed.clear()
      setSaveNextError(null)
      setSaveNextDone(false)
    }
  }, [view])
  const [profilePriorityKey, setProfilePriorityKey] = useState(null)
  const [profilePriorityContext, setProfilePriorityContext] = useState(null)
  const [selectedAthlete, setSelectedAthlete] = useState(null)
  // ORDRE 175: hvilken atlet-id weeks+athleteLogs sidst er hentet for — se
  // effekten der bruger den, nedenfor.
  const weeksLogsLoadedForRef = useRef(null)
  const [activeTab, setActiveTab] = useState('hub')
  const [navMenuOpen, setNavMenuOpen] = useState(false) // "Mere"-menu i sektions-navigationen
  const [editing, setEditing] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const emptyNewAthlete = {
    name: '', email: '', age: '', sex: '', bodyweight: '', height: '', weightClass: '',
    status: 'active', goal: '', competition_date: '', notes: '',
    squat: '', bench: '', deadlift: '', ohp: '',
    kcal_target: '', protein_target: '',
  }
  const [newAthlete, setNewAthlete] = useState(emptyNewAthlete)
  const [addStep, setAddStep] = useState(0)
  const [editData, setEditData] = useState({})
  const [saving, setSaving] = useState(false)

  // Messages state
  const [messages, setMessages] = useState([])
  const [messageInput, setMessageInput] = useState('')
  const [messageThreadError, setMessageThreadError] = useState(null)
  const [messageSendError, setMessageSendError] = useState(null)
  const [sendingMessage, setSendingMessage] = useState(false)
  const messageThreadAthleteRef = useRef(null)
  // ORDRE 285 · commit 3: rullepositionen på atletlisten skal holde efter
  // "← Tilbage til atleter" — uden dette blev window.scrollY nulstillet af
  // browseren, fordi profilvisningen ofte er kortere end den rullede liste
  // (bevist af e2e/coach-mandagsrunden.spec.mjs). Gemmes ved openProfile,
  // gendannes i useEffect'en nedenfor når view bliver 'list' igen. viewRef
  // (ikke `view` selv) læst i openProfile, så openProfile ikke bliver
  // "reaktiv" i react-hooks/exhaustive-deps' øjne for de andre steder der
  // kalder den fra en useEffect med tomt deps-array.
  const listScrollYRef = useRef(0)
  const viewRef = useRef(view)
  useEffect(() => { viewRef.current = view }, [view])
  const [coachMsgTrack, setCoachMsgTrack] = useState('besked')  // 'teknik' | 'besked'
  const [unreadByTrack, setUnreadByTrack] = useState({})
  const [latestByTrack, setLatestByTrack] = useState({})
  const [pendingByTrack, setPendingByTrack] = useState({})
  const [unreadCounts, setUnreadCounts] = useState({})
  const [profilesLastSeen, setProfilesLastSeen] = useState({})

  // Export state
  const [exportingTraening, setExportingTraening] = useState(false)
  const [exportingBackup, setExportingBackup] = useState(false)
  // In-app toast + bekræftelses-modal (erstatter native alert/confirm)
  const [flash, setFlash] = useState(null)
  const [confirmDialog, setConfirmDialog] = useState(null)
  const flashTimerRef = useRef(null)
  const snoozeMigratedRef = useRef(false) // engangs-flyt af localStorage-snoozes til DB
  const [lastBackup, setLastBackup] = useState(null) // synces via profiles.last_backup_at

  // Program state
  const [sidebarOpen, setSidebarOpen] = useState(false)
  // "Min profil"-genvej: hvilken atlet er coachen selv (gemt i localStorage).
  const selfNavigationEnabled = entropi2 !== false && !!coachSelfContext
  const [myAthleteId, setMyAthleteId] = useState(() => selfNavigationEnabled ? readCoachSelfAthleteId(session) : localStorage.getItem('entropi_my_athlete_id'))
  const [pickingMine, setPickingMine] = useState(false)
  const selfNavigationRef = useRef({ active: true, ownerId: session?.user?.id })
  useEffect(() => {
    selfNavigationRef.current = { active: true, ownerId: session?.user?.id }
    return () => { selfNavigationRef.current.active = false }
  }, [session?.user?.id])
  const currentSelfNavigation = () => selfNavigationRef.current.active && selfNavigationRef.current.ownerId === session?.user?.id
  const onPreviewAthlete = selfNavigationEnabled && previewAthlete ? (athleteId, initialTab = 'hjem') => {
    if (!currentSelfNavigation()) return
    const athlete = athletes.find(row => row.id === athleteId)
    previewAthlete?.(athleteId, initialTab, requestCoachSelfTraining({ session, athlete }))
  } : previewAthlete
  function onSelectOwnAthlete(athleteId) {
    if (!selfNavigationEnabled || !previewAthlete || !currentSelfNavigation()) return
    const athlete = athletes.find(row => row.id === athleteId)
    const request = requestCoachSelfTraining({ session, athlete, explicit: true })
    if (!request) return
    setMyAthleteId(athleteId)
    previewAthlete?.(athleteId, 'hjem', request)
  }

  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 768)

  const [fourWeekReads, setFourWeekReads] = useState({})
  const fourWeekCapture = coachFourWeeksEnabled === true || coachProfileWeek
    ? event => setFourWeekReads(previous => reduceFourWeekRead(previous, event)) : undefined
  const [weeks, setWeeks] = useState([])
  const [openWeekId, setOpenWeekId] = useState(null)
  const [programBlockStart, setProgramBlockStart] = useState(null) // hvilken blok vises i program-listen (week_number for 1. uge, eller 'all')
  const [openSessionId, setOpenSessionId] = useState(null)
  const [addingWeek, setAddingWeek] = useState(false)
  const [addingSession, setAddingSession] = useState(null)
  // Auto-udkast til næste uge via edge functionen draft-next-week:
  // null = skjult, {loading} = henter, {data} = preview klar, {error} = fejl.
  const [weekDraft, setWeekDraft] = useState(null)
  const [sendingDraft, setSendingDraft] = useState(false)
  const [approvingProgression, setApprovingProgression] = useState(false)
  // Dagens træningslogs bruges til de små aktivitetsmarkeringer i navigationen.
  const [todayData, setTodayData] = useState({ logs: [] })
  const [videoQueueFilters, setVideoQueueFilters] = useState({ athleteId: '', lift: '' })
  const [videoReviewQueue, setVideoReviewQueue] = useState([])
  const [videoReviewQueueError, setVideoReviewQueueError] = useState(null)
  const [trainingSignals, setTrainingSignals] = useState([])
  const [trainingSignalsError, setTrainingSignalsError] = useState(null)
  // ORDRE 301: uløste n8n-fejl (public.automation_alerts, kun metadata).
  const [automationAlerts, setAutomationAlerts] = useState([])
  const [automationAlertsError, setAutomationAlertsError] = useState(null)
  const [automationAlertUpdatingId, setAutomationAlertUpdatingId] = useState(null)
  const [automationAlertActionError, setAutomationAlertActionError] = useState(null)
  // ORDRE 325: coach_briefing_seen (supabase/sql/coach-briefing-seen-v1.sql,
  // IKKE kørt) — punkt-nøgle -> seen_at, for "Set" på et punkt under
  // "Kræver dit blik" (se coachBriefingSeen.js).
  const [coachBriefingSeen, setCoachBriefingSeen] = useState({})
  const [coachBriefingSeenSavingKey, setCoachBriefingSeenSavingKey] = useState(null)
  const [messageInboxError, setMessageInboxError] = useState(null)
  const [inboxRefreshing, setInboxRefreshing] = useState(false)
  const [inboxRefreshStatus, setInboxRefreshStatus] = useState(null)
  const inboxRefreshRunnerRef = useRef(createSingleFlightRunner())
  // Entropi 2: egen single-flight for flagets opdateringer, så en igangværende opdatering fra den anden flagtilstand ikke opsluger den første efter et flagskift.
  const e2InboxRefreshRunnerRef = useRef(createSingleFlightRunner())
  const [trainingSignalUpdatingKey, setTrainingSignalUpdatingKey] = useState(null)
  const [videoReviewRequest, setVideoReviewRequest] = useState(null)
  const videoReviewOpenedRef = useRef(null)
  const [menuSheetOpen, setMenuSheetOpen] = useState(false)
  const [sheetPreviewPick, setSheetPreviewPick] = useState(false)
  const [sidebarMoreOpen, setSidebarMoreOpen] = useState(false)
  const [addingExercise, setAddingExercise] = useState(null)
  const [editingWeek, setEditingWeek] = useState(null)
  const [editingSession, setEditingSession] = useState(null)
  const [editingExercise, setEditingExercise] = useState(null)
  const [weekForm, setWeekForm] = useState({ week_number: '', block_name: '', coach_note: '', block_description: '', start_date: '' })
  // "Sæt datoer" (ordre 204, commit 2): udfylder manglende start_date på
  // eksisterende uger med ét tryk. null = skjult, ellers { rows, saving }
  // hvor rows er previewet fra fillMissingWeekDates, vist før det gemmes.
  const [weekDateFill, setWeekDateFill] = useState(null)
  // Inline omdøbning af en blok i periodiserings-tidslinjen (id på blokkens første uge)
  const [renamingBlock, setRenamingBlock] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [showBlockPlanner, setShowBlockPlanner] = useState(false)
  const [calBlockAthlete, setCalBlockAthlete] = useState(null) // {id, name} når kalender-blok-byggeren er åben
  const [hoverCell, setHoverCell] = useState(null) // {aid, col} = tom kalender-celle der hoveres (klik = opret uge)
  const [blockPlan, setBlockPlan] = useState(() => withBlockPurposes([
    { id: 1, name: 'Akkumulering', weeks: 4 },
    { id: 2, name: 'Intensificering', weeks: 3 },
    { id: 3, name: 'Peak', weeks: 2 },
    { id: 4, name: 'Deload', weeks: 1 },
  ]))
  const [planStartDate, setPlanStartDate] = useState(() => calendarDay())
  const [planAssistantFocus, setPlanAssistantFocus] = useState('competition')
  const [assignEdits, setAssignEdits] = useState({})
  const [sessionForm, setSessionForm] = useState({ title: '', weekday: null })
  const [exerciseForm, setExerciseForm] = useState({ name: '', sets: '', reps: '', intensity: '', intensityPrefix: 'RPE', note: '' })
  const [athleteLogs, setAthleteLogs] = useState([])
  const [openLogWeeks, setOpenLogWeeks] = useState(null) // null = standard (seneste uge åben); ellers Set af åbne ugenumre
  const [logExerciseFilter, setLogExerciseFilter] = useState(null) // Log-fane: null = alle øvelser; ellers øvelsesnavn
  const [weeklyActivity, setWeeklyActivity] = useState({}) // athlete_id → { sessions, sets } for indeværende uge
  const [athleteWeightLogs, setAthleteWeightLogs] = useState([])
  const [coachActionsStatus, setCoachActionsStatus] = useState({})
  const [athleteReadiness, setAthleteReadiness] = useState([])
  const [athletePRs, setAthletePRs] = useState([])
  const [athletePRHistory, setAthletePRHistory] = useState([])
  const [videoAnalyses, setVideoAnalyses] = useState([])
  const [videoBaselines, setVideoBaselines] = useState([])
  const [videoAnalysisLoading, setVideoAnalysisLoading] = useState(false)
  const [videoAnalysisError, setVideoAnalysisError] = useState(null)
  const [videoLiftFilter, setVideoLiftFilter] = useState('all')
  const [videoAnalysisUpdatingId, setVideoAnalysisUpdatingId] = useState(null)
  const [videoAnalysisReview, setVideoAnalysisReview] = useState(null)
  const [videoAnalysisReviewLoadingId, setVideoAnalysisReviewLoadingId] = useState(null)
  const [videoAnalysisReviewError, setVideoAnalysisReviewError] = useState(null)
  const [videoAnalysisFeedbackDraft, setVideoAnalysisFeedbackDraft] = useState({ works: '', focus: '', next_set: '' })
  const [videoAnalysisBaselineFindingId, setVideoAnalysisBaselineFindingId] = useState('')
  const [videoAnalysisFeedbackDirty, setVideoAnalysisFeedbackDirty] = useState(false)
  const [videoAnalysisCloseWarning, setVideoAnalysisCloseWarning] = useState(false)
  const [warmupTemplates, setWarmupTemplates] = useState([])
  const [editingWarmup, setEditingWarmup] = useState(null)
  const [warmupDraftSteps, setWarmupDraftSteps] = useState([])
  const [warmupNewStep, setWarmupNewStep] = useState('')
  const [editingRecommended, setEditingRecommended] = useState(null)
  const [recommendedInput, setRecommendedInput] = useState('')
  const [copyingExercise, setCopyingExercise] = useState(null)
  const [copyingSession, setCopyingSession] = useState(null)
  // ORDRE 456 (A6): "Kopiér seneste uge" kører.
  const [copyingWeek, setCopyingWeek] = useState(false)
  const [pendingWeekDeletes, setPendingWeekDeletes] = useState([])
  const [weekDeletionQueue] = useState(() => createWeekDeletionQueue(setPendingWeekDeletes))
  const currentProgramAthleteRef = useRef(null)
  currentProgramAthleteRef.current = selectedAthlete?.id
  useEffect(() => {
    weekDeletionQueue.activate()
    return () => weekDeletionQueue.dispose()
  }, [weekDeletionQueue])

  // Meet plan state
  const [meetPlan, setMeetPlan] = useState(null)
  const [meetPlanForm, setMeetPlanForm] = useState({ meet_type: 'sbd', squat1: '', squat2: '', squat3: '', bench1: '', bench2: '', bench3: '', dead1: '', dead2: '', dead3: '', notes: '' })
  const [savingMeetPlan, setSavingMeetPlan] = useState(false)

  // Meet results (historik)
  const [meetResults, setMeetResults] = useState([])
  const [meetResultForm, setMeetResultForm] = useState(null) // null = lukket

  const [previewPickerOpen, setPreviewPickerOpen] = useState(false)
  const [exerciseLibrary, setExerciseLibrary] = useState([])
  const [exerciseSearchOpen, setExerciseSearchOpen] = useState(false)
  const [editingLibraryEx, setEditingLibraryEx] = useState(null)
  const [libraryEditForm, setLibraryEditForm] = useState({ name: '', category: '' })
  const [addingLibraryEx, setAddingLibraryEx] = useState(false)
  const [libraryAddForm, setLibraryAddForm] = useState({ name: '', category: 'Accessory' })
  const [librarySearch, setLibrarySearch] = useState('')
  const [athleteWeekSummary, setAthleteWeekSummary] = useState({})
  // ORDRE 456 (A7): null = endnu ikke hentet (forsiden siger "henter" i stedet
  // for "Ingen logs"/"0 af 4 pas", som på en langsom telefon stod i ca. 5 s).
  const [athleteLastLogs, setAthleteLastLogs] = useState(null)
  const [calendarWeeks, setCalendarWeeks] = useState({}) // athlete_id -> [{week_number, block_name, start_date, session_count, exercise_count, planned_sets, planned_tonnage}]
  const [athleteCurrentWeek, setAthleteCurrentWeek] = useState({}) // athlete_id -> ugenummer for seneste logg. træning
  // ORDRE 277 · commit 1: athlete_id -> { [week_number]: { sets, tonnage } } —
  // gennemførte (ikke sprunget over) sæt/tonnage pr. programuge, til
  // afvigelse-sorteringen (src/dashboard/afvigelse.js).
  const [athleteWeekCompletion, setAthleteWeekCompletion] = useState(null) // ORDRE 456 (A7): null = ikke hentet
  const [athleteSortMode, setAthleteSortMode] = useState('navn') // 'navn' | 'afvigelse'
  const [timelineEdit, setTimelineEdit] = useState(null) // { athleteId, weeks, name, block, firstStartIso } — åbent dato-panel i kalender-tidslinjen
  // Kilde = athletes.snooze_until (DB). localStorage bruges kun som midlertidig seed for
  // straks-visning + migreres væk ved første load (se snoozeMigratedRef-effekt).
  const [snoozedAthletes, setSnoozedAthletes] = useState(() => {
    try { return JSON.parse(localStorage.getItem('entropi_calendar_snooze') || '{}') } catch { return {} }
  })
  // Skjulte atleter synces nu via athletes.hidden i DB (på tværs af enheder),
  // ikke localStorage. Sættet fyldes fra fetchAthletes.
  const [hiddenAthleteIds, setHiddenAthleteIds] = useState(new Set())
  const [showHiddenAthletes, setShowHiddenAthletes] = useState(false)
  // ORDRE 175: atletlisten tegnede ALLE rækker uanset hvor mange der reelt er
  // synlige på skærmen (se view === 'list' nedenfor). Samme "vis kun de
  // første N, vis flere ved ønske"-mønster som showHiddenAthletes ovenfor,
  // bare for den SYNLIGE liste når den er lang.
  const [showAllAthletes, setShowAllAthletes] = useState(false)
  const [showAiExport, setShowAiExport] = useState(false)
  const [aiExportWeeks, setAiExportWeeks] = useState(8)
  const [aiExportText, setAiExportText] = useState('')
  const [aiExportCopied, setAiExportCopied] = useState(false)
  const videoCoachAthletesRef = useRef([])
  const videoCoachClientsRef = useRef(new Set())
  const videoCoachSelectedAthleteRef = useRef(null)
  const videoCoachFrameRef = useRef(null)
  // Efter en coach-send til en ANDEN atlet: husk målingen, så vi kan tilbyde
  // "Del med atlet" når iframen lukkes (dialogen kan ikke ses bag iframen).
  const videoCoachPendingShareRef = useRef(null)
  // ORDRE 57 · commit 2: sat når coachen åbner en afventende atlet-video for
  // at spore den. Fortæller ready-handleren hvilken video der skal indlæses,
  // og save-draft-handleren at gemmet skal opdatere SAMME række i stedet for
  // at oprette en ny (client_analysis_id er nøglen).
  const videoCoachPendingCompletionRef = useRef(null)
  // VideoCoach åbnes som iframe i coach-portalen (ikke popup), så Marc kan
  // optage/gemme sin egen og atleternes træning uden at skifte konto/fane.
  const [videoCoachOpen, setVideoCoachOpen] = useState(false)
  const openVideoCoachV3 = () => setVideoCoachOpen(true)

  /* eslint-disable react-hooks/refs -- fabrikkerne får ref-objekterne med, men læser .current kun i hændelses- og effekt-callbacks, præcis som før ordre 377 */
  const {
    refreshCoachInbox, fetchLastBackup, fetchAthletes, fetchAthleteWeekSummaries, fetchCalendarWeeks, fetchCalendarProgress,
    fetchVideoReviewQueue, fetchWeeks, fetchExerciseLibrary, fetchLatestMessages, fetchMessages, fetchAthleteLogs,
    fetchVideoCoachHistory, fetchAthleteWeightLogs, fetchAthleteReadiness, fetchAthletePRs, fetchMeetResults, fetchMeetPlan,
    fetchWarmupTemplates,
  } = lavLaesninger({
    blokFremgang: blokFremgang === true,
    ...(e2 ? { coachTabCleanup: true } : {}),
    fourWeekCapture, profileWeekCapture: coachProfileWeek ? fourWeekCapture : undefined,
    setCoachActionsStatus, coachMorning, setCoachMorningData,
    coachMeetSoon, setCoachMeetData,
    coachWeekEnabled, setCoachWeekDataStatus,
    inboxRefreshRunnerRef, messageThreadAthleteRef, session, setAthleteCurrentWeek, setAthleteLastLogs, setAthleteLogs,
    setAthletePRHistory, setAthletePRs, setAthleteReadiness, setAthletes, setAthleteWeekCompletion, setAthleteWeekSummary,
    setAthleteWeightLogs, setAutomationAlerts, setAutomationAlertsError, setCalendarWeeks, setCoachBriefingSeen, setExerciseLibrary,
    setHiddenAthleteIds, setInboxRefreshing, setInboxRefreshStatus, setLastBackup, setLatestByTrack, setLoadError, setPendingByTrack,
    setLoading, setMeetPlan, setMeetPlanForm, setMeetResults, setMessageInboxError, setMessageInput,
    setMessages, setMessageSendError, setMessageThreadError, setProfilesLastSeen, setSnoozedAthletes, setTodayData,
    setTrainingSignals, setTrainingSignalsError, setUnreadByTrack, setUnreadCounts, setVideoAnalyses, setVideoAnalysisError,
    setVideoAnalysisLoading, setVideoBaselines, setVideoReviewQueue, setVideoReviewQueueError, setWarmupTemplates, setWeeklyActivity,
    setWeeks, videoCoachAthletesRef, currentProgramAthleteRef: programCopyEnabled === true || e2 ? currentProgramAthleteRef : undefined,
    ...(coachTemplateMessages === true || e2 ? { coachActions: true } : {}),
    ...(e2 ? { entropi2CalendarRead, entropi2ReadGate, inboxRefreshRunnerRef: e2InboxRefreshRunnerRef } : {}),
  })

  // Entropi 2: læsekonteksten kommer fra selve kalenderlæsningen (se entropi2/coachReadContext.mjs).
  const e2ReadContext = useEntropi2ReadContext({ enabled: e2, loading, loadError, coachId: session?.user?.id, athletes, calendarWeeks, coachActionsStatus, coachMorningData })
  // Entropi 2: coachens kostlinje læses kun med flaget tændt og bindes til samme kontekst.
  const e2CoachNutrition = useEntropi2CoachNutrition({ enabled: e2, client: supabase, readContext: e2ReadContext })
  // Entropi 2: kostmål. Vægtloggen læses i koblingens egen læsning (samme forespørgsel som den
  // eksisterende læser), når coachens kostfane er åben; den fælles athleteWeightLogs røres ikke.
  const e2KostVaegt = useEntropi2KostVaegt({ enabled: e2 && activeTab === 'kost', athleteId: selectedAthlete?.id, client: supabase })
  // Entropi 2: dagsur, så kostmål og samtale følger dagsskiftet også uden anden ændring.
  const e2Dag = useEntropi2Dag({ enabled: e2, today: calendarDay }) ?? {}
  const e2CoachSamtaleRef = useRef(null)
  useEffect(() => { if (e2) void e2CoachSamtaleRef.current?.refresh?.() }, [e2, e2Dag.day])
  // Entropi 2: beskedsammendrag og fejlstatus udledes af samme indfangede beskedkilde (se entropi2/coachMessageSummary.mjs).
  const e2Beskeder = e2 ? entropi2MessageSummary(coachMorningData.messages, { noteSignalEnabled: COACH_NOTE_SIGNAL_ENABLED }) : null
  const missingDataScopeRef = useRef(null)
  missingDataScopeRef.current = {
    enabled: analyseMissingData === true && !videoAnalysisLoading && !videoAnalysisError,
    coachId: session?.user?.id,
    athletes: athletes.filter(item => item.id === selectedAthlete?.id),
  }
  const [sendMissingDataMessage] = useState(() => createCoachTemplateSender({
    enabled: true, database: supabase, getScope: () => missingDataScopeRef.current,
    onSent: () => fetchLatestMessages(missingDataScopeRef.current.athletes.map(item => item.id)),
  }))

  const conclusionScopeRef = useRef(null)
  conclusionScopeRef.current = {
    enabled: analyseConclusionMessage === true && !videoAnalysisLoading && !videoAnalysisError,
    coachId: session?.user?.id,
    athletes: athletes.filter(item => item.id === selectedAthlete?.id),
  }
  const [sendConclusionMessage] = useState(() => createCoachTemplateSender({
    enabled: true, database: supabase, getScope: () => conclusionScopeRef.current,
    onSent: () => fetchLatestMessages(conclusionScopeRef.current.athletes.map(item => item.id)),
  }))

  const templateScopeRef = useRef(null)
  templateScopeRef.current = { enabled: coachTemplateMessages === true, coachId: session?.user?.id, athletes }
  const [sendTemplateMessage] = useState(() => createCoachTemplateSender({
    enabled: true, database: supabase, getScope: () => templateScopeRef.current,
    onSent: () => fetchLatestMessages(templateScopeRef.current.athletes.map(a => a.id)),
  }))

  const {
    goToMyProfile, openProfile, openPlanReview, startEdit, openCoachPriorityItem,
  } = lavNavigation({
    analyseTabFactory, athletes, calendarWeeks, isMobile, listScrollYRef, messageThreadAthleteRef,
    myAthleteId, onPreviewAthlete, setActiveTab, setAddingExercise, setAddingSession, setAddingWeek,
    setAthleteWeightLogs, setBlockPlan, setCalBlockAthlete, setCoachMsgTrack, setEditData, setEditing,
    setEditingExercise, setEditingSession, setEditingWeek, setMenuSheetOpen, setMessageInput, setMessages,
    setMessageSendError, setMessageThreadError, setOpenSessionId, setOpenWeekId, setPickingMine, setPlanAssistantFocus,
    setPlanStartDate, setPreviewPickerOpen, setProfilePriorityContext, setProfilePriorityKey, setProfileReturnView, setProgramBlockStart,
    setSelectedAthlete, setSheetPreviewPick, setShowBlockPlanner, setSidebarOpen, setVideoAnalysisReview, setVideoAnalysisReviewError,
    setVideoLiftFilter, setVideoReviewRequest, setView, setWeekDraft, setWeeks, viewRef,
  })

  const {
    handleCoachBriefingSeen, handleAutomationAlert, handleTrainingSignal, markMessagesRead, sendCoachMessage, togglePin,
    formatMsgTime,
  } = lavIndbakkeHandlinger({
    athletes, coachMsgTrack, fetchLatestMessages, fetchMessages, messageInput, messageThreadAthleteRef,
    selectedAthlete, sendingMessage, session, setAutomationAlertActionError, setAutomationAlerts, setAutomationAlertUpdatingId,
    setCoachBriefingSeen, setCoachBriefingSeenSavingKey, setMessageInput, setMessages, setMessageSendError, setSendingMessage,
    setTrainingSignals, setTrainingSignalUpdatingKey, showFlash,
  })

  const {
    saveApproveShareVideoAnalysis, reviewVideoAnalysis, saveVideoAnalysisFeedback, closeVideoAnalysisReview, discardVideoAnalysisFeedback, openAwaitingAnalysisVideo, openVideoAnalysisReview,
  } = lavVideoReviewHandlinger({
    fetchVideoCoachHistory, fetchVideoReviewQueue, openVideoCoachV3, selectedAthlete, setVideoAnalyses, setVideoAnalysisBaselineFindingId,
    setVideoAnalysisCloseWarning, setVideoAnalysisError, setVideoAnalysisFeedbackDirty, setVideoAnalysisFeedbackDraft, setVideoAnalysisReview, setVideoAnalysisReviewError,
    setVideoAnalysisReviewLoadingId, setVideoAnalysisUpdatingId, showFlash, videoAnalysisBaselineFindingId, videoAnalysisFeedbackDirty, videoAnalysisFeedbackDraft,
    videoAnalysisReviewLoadingId, videoAnalysisUpdatingId, videoBaselines, videoCoachPendingCompletionRef,
  })

  const {
    saveMeetPlan, saveWarmupTemplate, deleteWarmupTemplate, addAthlete, saveEdit, openMeetResult,
    saveMeetResult, deleteMeetResult, deleteAthlete, exportTraeningsdata, exportBackup,
  } = lavAtletHandlinger({
    askConfirm, editData, emptyNewAthlete, exerciseLibrary, fetchAthletePRs, fetchMeetPlan,
    fetchMeetResults, fetchWarmupTemplates, meetPlanForm, meetResultForm, newAthlete, openProfile,
    selectedAthlete, session, setAddingWeek, setAddStep, setAthletes, setEditing,
    setEditingWarmup, setExportingBackup, setExportingTraening, setLastBackup, setMeetResultForm, setMeetResults,
    setNewAthlete, setSaving, setSavingMeetPlan, setSelectedAthlete, setShowAddModal, setShowDeleteModal,
    setView, setWarmupNewStep, setWeekForm, showFlash, warmupTemplates,
  })

  const {
    generateAIReport,
  } = lavAiRapport({
    athleteLogs, athletePRs, athleteReadiness, athleteWeightLogs, exerciseLibrary, meetResults,
    selectedAthlete, setAiExportText,
  })

  const {
    programActiveStart, programShownWeeks, gotoWeek, sessionLogStatus, setBlockStartDate, snoozeAthlete,
    approveDraftProgressionState, editDraftForecast, setDraftForecastOverrideReason, addWeek, updateWeek, generateWeeksFromPlan,
    applyPeriodizationSuggestion, createCalendarWeek, openCalBlockBuilder, deleteWeek, addSession, updateSession,
    deleteSession, reorderSession, reorderExercise, copySessionToWeek, copyExerciseToSession, addLibraryExercise,
    updateLibraryExercise, deleteLibraryExercise, addToLibraryQuick, parseIntensity, addExercise, updateExercise,
    deleteExercise, saveRecommendedWeight, copyWeek, copyBlock, previewWeekDateFill, applyWeekDateFill,
  } = lavProgramHandlinger({
    ...(e2 ? { coachTabCleanup: true } : {}),
    askConfirm, athleteLogs, athletes, blockPlan, calendarWeeks, exerciseForm,
    exerciseLibrary, fetchAthleteWeekSummaries, fetchCalendarWeeks, fetchExerciseLibrary, fetchWeeks, libraryAddForm,
    libraryEditForm, openSessionId, openWeekId, planAssistantFocus, planStartDate, programBlockStart,
    recommendedInput, selectedAthlete, session, sessionForm, setAddingExercise, setAddingLibraryEx,
    setAddingSession, setAddingWeek, setApprovingProgression, setBlockPlan, setCalBlockAthlete, setCopyingExercise,
    setCopyingSession, setEditingExercise, setEditingLibraryEx, setEditingRecommended, setEditingSession, setEditingWeek,
    setExerciseForm, setLibraryAddForm, setOpenSessionId, setOpenWeekId, setPlanStartDate, setProgramBlockStart,
    setSessionForm, setShowBlockPlanner, setSnoozedAthletes, setWeekDateFill, setWeekDraft, setWeekForm,
    showFlash, weekDateFill, weekDraft, weekForm, weeks, setCopyingWeek,
    weekDeletionQueue, setWeeks, currentProgramAthleteRef, programCopyEnabled,
  })

  const {
    currentWeight, weightTrend, bestLog,
  } = lavProfilTal({
    athleteLogs, athleteWeightLogs,
  })
  /* eslint-enable react-hooks/refs */

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  // ORDRE 285 · commit 3: gendan rullepositionen på atletlisten efter
  // "← Tilbage til atleter" (listScrollYRef sat i openProfile). Kører efter
  // listen selv er commited til DOM'en (almindelig useEffect, ikke layout —
  // ingen synligt flimmer set i e2e-prøven), så dokumentets højde allerede
  // matcher den rullede liste før vi ruller.
  useEffect(() => {
    if (view === 'list') window.scrollTo(0, listScrollYRef.current)
  }, [view])

  useVideoCoachBro({
    athletes, fetchVideoCoachHistory, fetchVideoReviewQueue, openProfile, selectedAthlete, setConfirmDialog,
    setSelectedAthlete, setVideoCoachOpen, setVideoReviewRequest, setView, showFlash, videoCoachAthletesRef,
    videoCoachClientsRef, videoCoachFrameRef, videoCoachPendingCompletionRef, videoCoachPendingShareRef, videoCoachSelectedAthleteRef,
  })

  useDashboardEffekter({
    coachWeekEnabled,
    coachFourWeeksEnabled, coachProfileWeek,
    activeTab, athletes, coachMsgTrack, fetchAthleteLogs, fetchAthletePRs, fetchAthleteReadiness,
    fetchAthletes, fetchAthleteWeightLogs, fetchCalendarProgress, fetchCalendarWeeks, fetchExerciseLibrary, fetchLastBackup,
    fetchMeetPlan, fetchMeetResults, fetchMessages, fetchVideoCoachHistory, fetchWarmupTemplates, fetchWeeks,
    isMobile, loadError, loading, markMessagesRead: e2 ? () => {} : markMessagesRead, openAwaitingAnalysisVideo, openVideoAnalysisReview,
    refreshCoachInbox, selectedAthlete, snoozeMigratedRef, videoAnalysisReview, videoReviewOpenedRef, videoReviewRequest,
    view, weeksLogsLoadedForRef, ...(e2 ? { entropi2: true } : {}),
  })


  function showFlash(message, kind = 'info') {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
    setFlash({ message, kind })
    flashTimerRef.current = setTimeout(() => setFlash(null), 3000)
  }

  function askConfirm(message, onConfirm) {
    setConfirmDialog({ message, onConfirm })
  }


  // Bygger til kalender-blok-opstilling: returnerer blok-sekvens-editoren (delt UI).
  function blockSequenceRows() {
    return (
      <BlockSequenceRows {...{
        blockPlan, setBlockPlan,
      }} />
    )
  }



  // Tastaturgenvej: tast "M" (uden for input-felter) → min profil.
  useEffect(() => {
    function onKey(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const t = e.target
      const tag = t?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t?.isContentEditable) return
      if (e.key === 'm' || e.key === 'M') { e.preventDefault(); goToMyProfile() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myAthleteId, athletes])













  const a = selectedAthlete
  const total = a ? (a.squat || 0) + (a.bench || 0) + (a.deadlift || 0) : 0
  const trainingTotal = a ? (a.training_squat || 0) + (a.training_bench || 0) + (a.training_deadlift || 0) : 0
  const {
    coachPriorityItems, coachPriorityCount, priorityQueueContext, nextPriorityItem, videoMeasurementByAthlete,
  } = useCoachPrioritet({
    athletes, automationAlerts, focusNextFromLinkRef, hiddenAthleteIds, inboxRefreshing, inboxRefreshStatus,
    latestByTrack, pendingByTrack, openCoachPriorityItem, profilePriorityKey, profileReturnView, trainingSignals, unreadByTrack,
    videoReviewQueue, view,
  })


  const replyVisit = [view, profileReturnView, profilePriorityKey, selectedAthlete?.id,
    coachMsgTrack, videoAnalysisReview?.id, activeTab].join(':')
  if (saveNextRunRef.current.visit !== replyVisit) {
    saveNextRunRef.current.visit = replyVisit
    saveNextRunRef.current.visitId = (saveNextRunRef.current.visitId || 0) + 1
  }
  saveNextScopeRef.current = {
    visitId: saveNextRunRef.current.visitId,
    view, returnView: profileReturnView, key: profilePriorityKey,
    item: profilePriorityContext, athleteId: selectedAthlete?.id,
    track: coachMsgTrack, analysisId: videoAnalysisReview?.id, activeTab,
    items: coachPriorityItems,
  }
  const saveNextAvailable = COACH_SAVE_NEXT_ENABLED === true && inboxReplyMatches(saveNextScopeRef.current)
  const saveAndNext = createInboxSaveNext({
    enabled: COACH_SAVE_NEXT_ENABLED, scopeRef: saveNextScopeRef, run: saveNextRunRef.current,
    setBusy: setSaveNextBusy, setError: setSaveNextError,
    persist: kind => kind === 'message'
      ? sendCoachMessage({ confirmed: true })
      : saveVideoAnalysisFeedback(videoAnalysisReview, { confirmed: true }),
    open: item => { setSaveNextDone(false); openCoachPriorityItem(item, 'inbox') },
    complete: () => { setVideoAnalysisReview(null); setSaveNextDone(true) },
  })
  const saveMessageAndNext = () => saveAndNext('message', messageInput)
  const saveVideoAndNext = () => saveAndNext('video',
    ['works', 'focus', 'next_set'].map(key => videoAnalysisFeedbackDraft?.[key] || '').join(' ').trim())

  // Delt ugedags-vælger (bruges i både rediger- og tilføj-session-formen).
  const weekdayPicker = (
    <WeekdayPicker {...{
      sessionForm, setSessionForm,
    }} />
  )

  const exFormRow = (() => {
    return (
      <ExFormRow {...{
        addToLibraryQuick, exerciseForm, exerciseLibrary, exerciseSearchOpen, isMobile, setExerciseForm,
        setExerciseSearchOpen,
      }} />
    )
  })()

  // Only presentation state survives the list/profile mounting boundary.
  // Reset in this host render so another coach (or OFF -> ON) cannot revive it.
  const coachListOwner = e2 ? session?.user?.id ?? null : null
  const [coachListView, setCoachListView] = useState({ owner: coachListOwner, athleteQuery: '', athletesOpen: false, inboxLimit: 10 })
  const currentCoachListView = coachListView.owner === coachListOwner ? coachListView
    : { owner: coachListOwner, athleteQuery: '', athletesOpen: false, inboxLimit: 10 }
  if (coachListView.owner !== coachListOwner) setCoachListView(currentCoachListView)
  const changeCoachListView = patch => setCoachListView(current =>
    current.owner === coachListOwner ? { ...current, ...(typeof patch === 'function' ? patch(current) : patch) } : current)

  return (
    <div {...(coachWeekEnabled === true ? { 'data-app-375': 'coach' } : {})} {...(e2 ? { 'data-entropi2-coach-root': '' } : {})} style={s.wrap}>
      <Overlays {...{
        confirmDialog, flash, isMobile, setConfirmDialog, videoCoachFrameRef, videoCoachOpen,
      }} />
      {programCopyEnabled === true && <WeekDeletionNotice entries={pendingWeekDeletes} onUndo={id => weekDeletionQueue.undo(id)} />}
      <Sidebar {...(selfNavigationEnabled ? { onSelectOwnAthlete } : {})} {...(programOverview ? { programOverblik: true } : {})} {...{ coachRyd,
        athletes, athleteWeekSummary, coachPriorityCount, exportBackup, exportingBackup, exportingTraening,
        exportTraeningsdata, goToMyProfile, hiddenAthleteIds, isMobile, lastBackup, onPreviewAthlete,
        openProfile, openVideoCoachV3, pickingMine, previewPickerOpen, selectedAthlete, setMyAthleteId,
        setPickingMine, setPreviewPickerOpen, setSelectedAthlete, setSidebarMoreOpen, setSidebarOpen, setView,
        sidebarMoreOpen, sidebarOpen, todayData, unreadCounts, view,
      }} />

      <main style={{ ...s.main, ...(isMobile ? { marginLeft: 0, overflowX: 'hidden', paddingBottom: '76px' } : {}) }}>
        {COACH_SAVE_NEXT_ENABLED === true && saveNextDone && view === 'profile' && <p role="status" style={{ padding: '1rem', color: '#c9d7c7' }}>Svaret er gemt. Ingen flere ubesvarede beskeder eller videoer i denne gennemgang.</p>}
        <div style={s.topbar}>
          <FridayChecklistEntry enabled={checklistEnabled} open={() => { setSelectedAthlete(null); setView('friday-checklist') }} />
          <div style={{ ...s.topbarTitle, flex: 1 }}>{view === 'friday-checklist' && checklistEnabled ? 'Fredagens tjekliste' : view === 'library' ? 'Øvelsesbibliotek' : view === 'calendar' ? (programOverview ? 'Programoverblik' : 'Kalender') : view === 'inbox' ? (coachRyd ? 'Arbejdsindbakke' : 'Coach Briefing') : view === 'list' ? (isMobile ? 'Entropi Coach' : 'Atleter') : a?.name}</div>
          {previewAthlete && !isMobile && (
            <button
              onClick={goToMyProfile}
              title="Min træning — hop til din egen profil (tast M)"
              style={{ ...s.btnPrimary, fontSize: '0.55rem', padding: '0.4rem 0.8rem', whiteSpace: 'nowrap' }}
            >⚡ Min træning</button>
          )}
        </div>

        <MobilNav {...(selfNavigationEnabled ? { onSelectOwnAthlete } : {})} {...(programOverview ? { programOverblik: true } : {})} {...{ coachRyd,
          athletes, coachPriorityCount, exportBackup, exportingBackup, exportingTraening, exportTraeningsdata,
          goToMyProfile, isMobile, menuSheetOpen, onPreviewAthlete, openVideoCoachV3, pickingMine,
          selectedAthlete, setMenuSheetOpen, setMyAthleteId, setPickingMine, setSelectedAthlete, setSheetPreviewPick,
          setShowAddModal, setSidebarOpen, setView, sheetPreviewPick, view,
        }} />

        <NytIAppen search={typeof window === 'undefined' ? '' : window.location.search}
          role="coach" profileId={session?.user?.id}
          athletes={athletes.filter(athlete => !hiddenAthleteIds.has(athlete.id))}
          onNavigate={nytCoachNavigation({ setView, setSelectedAthlete, openProfile })} />

        {coachRyd && view !== 'inbox' && view !== 'list' && <WorkInboxLink count={coachPriorityItems.length} next={coachPriorityItems[0]} open={() => { setView('inbox'); setSelectedAthlete(null) }} />}
        {checklistEnabled && view === 'friday-checklist' && <FridayChecklist key={session.user.id} enabled={checklistEnabled} coachId={session.user.id} athletes={athletes} openProfile={openProfile} onPreviewAthlete={onPreviewAthlete} setView={setView} />}
        {/* INDBAKKE — samlet beskedoverblik på tværs af atleter */}
        {e2 && (view === 'inbox' || view === 'list') && (
          <CoachScreen enabled={true} tab={view === 'inbox' ? 'inbox' : 'home'} {...{
            session, athletes, hiddenAthleteIds, loading, loadError, calendarWeeks, coachActionsStatus, coachMorningData,
            inboxRefreshing,
            openCoachPriorityItem, openProfile, setSelectedAthlete, setView,
          }}
          athleteQuery={currentCoachListView.athleteQuery}
          onAthleteQueryChange={athleteQuery => changeCoachListView({ athleteQuery })}
          athletesOpen={currentCoachListView.athletesOpen}
          onAthletesOpenChange={athletesOpen => changeCoachListView({ athletesOpen })}
          inboxLimit={currentCoachListView.inboxLimit}
          onShowMoreInbox={() => changeCoachListView(current => ({ inboxLimit: current.inboxLimit + 10 }))}
          {...e2Beskeder}
          videoReviewQueueError={entropi2VideoQueueError(coachMorningData.videos)}
          reloadOverview={async () => { if (loadError) await fetchAthletes(); await refreshCoachInbox() }}
          notesClient={supabase}
          noteSignalEnabled={COACH_NOTE_SIGNAL_ENABLED} coachNutrition={e2CoachNutrition}
          readContext={e2ReadContext} />
        )}
        {!e2 && view === 'inbox' && (
          <LazyBoundary
            factory={indbakke2 ? indbakke2Factory : indbakkeFactory} label="Indbakke" loading={<div style={{ ...s.page }}>Indlæser…</div>}
            componentProps={{ ...(indbakke2 ? { database: supabase, coachId: session?.user?.id } : {}), coachRyd,
              coachBriefingSeen, coachBriefingSeenSavingKey, handleCoachBriefingSeen,
              calendarTasks: coachRyd ? <KalenderView tasksOnly {...{ athletes, hiddenAthleteIds, calendarWeeks, athleteCurrentWeek, athleteLastLogs, snoozedAthletes, isMobile, openProfile, openPlanReview, snoozeAthlete }} /> : null,
              athletes, coachPriorityItems, handleTrainingSignal,
              automationAlertActionError, automationAlertUpdatingId, automationAlertsError, handleAutomationAlert,
              hiddenAthleteIds, inboxRefreshing, inboxRefreshStatus,
              isMobile, latestByTrack, messageInboxError,
              openCoachPriorityItem, openProfile, refreshCoachInbox,
              setCoachMsgTrack, trainingSignalsError,
              trainingSignalUpdatingKey, unreadByTrack, videoReviewQueueError, videoQueueFilters, setVideoQueueFilters,
            }}
          />
        )}

        {/* LIBRARY VIEW */}
        {view === 'library' && (() => {
          return (
            <BibliotekView {...{
              addingLibraryEx, addLibraryExercise, deleteLibraryExercise, editingLibraryEx, exerciseLibrary, isMobile,
              libraryAddForm, libraryEditForm, librarySearch, setAddingLibraryEx, setEditingLibraryEx, setLibraryAddForm,
              setLibraryEditForm, setLibrarySearch, updateLibraryExercise,
            }} />
          )
        })()}

        {/* LIST VIEW */}
        {/* CALENDAR VIEW */}
        {view === 'calendar' && (() => {
          return (
            programOverview ? <ProgramOverblik {...{ athletes, calendarWeeks, hiddenAthleteIds, openProfile, loading, loadError }} /> : <KalenderView {...{ coachRyd,
              ...(e2 ? { entropi2: true, loading, loadError, calendarStatus: coachActionsStatus.calendar, calendarReady: !!e2ReadContext,
                onRetry: async () => { if (loadError) { setLoading(true); await fetchAthletes() } await refreshCoachInbox() } } : {}),
              coachCalendarEvents: coachCalendarEvents === true,
              askConfirm, athleteCurrentWeek, athleteLastLogs, athletes, blockPlan, blockSequenceRows,
              calBlockAthlete, calendarWeeks, createCalendarWeek, generateWeeksFromPlan, hiddenAthleteIds, hoverCell,
              isMobile, openCalBlockBuilder, openPlanReview, openProfile, planStartDate, setBlockStartDate,
              // eslint-disable-next-line react-hooks/refs -- uændret fra før ordre 377; lint ser det først nu (se RAPPORT-377)
              setCalBlockAthlete, setHoverCell, setPlanStartDate, setTimelineEdit, showFlash, snoozeAthlete,
              snoozedAthletes, timelineEdit,
            }} />
          )
        })()}

        {!e2 && view === 'list' && (() => {
          return (
            <ForsideView {...{ coachFollowUp, coachRyd, coachMorning, coachMorningData, coachMeetSoon, coachMeetData,
              coachWeekEnabled, coachWeekDataStatus,
              athleteCurrentWeek, athleteLastLogs, athletes, athleteSortMode, athleteWeekCompletion, athleteWeekSummary,
              automationAlertsError, calendarWeeks, coachBriefingSeen, coachBriefingSeenSavingKey, coachPriorityCount, coachPriorityItems,
              fetchAthletes, goToMyProfile, handleCoachBriefingSeen, handleTrainingSignal, hiddenAthleteIds, isMobile,
              inboxRefreshStatus, loadError, loading, messageInboxError, openCoachPriorityItem, openProfile, openVideoCoachV3,
              setAthleteSortMode, setHiddenAthleteIds, setLoading, setSelectedAthlete, setShowAllAthletes, setShowHiddenAthletes,
              setView, showAllAthletes, showHiddenAthletes, trainingSignalsError, trainingSignalUpdatingKey, unreadCounts,
              videoMeasurementByAthlete, videoReviewQueueError, latestByTrack, videoReviewQueue, coachActionsStatus,
              coachTemplateMessages, coachId: session?.user?.id, sendTemplateMessage,
            }} />
          )
        })()}

        {/* Den tidligere forside bevares midlertidigt som lokal rollback under testen. */}
        {/* PROFILE VIEW */}
        {view === 'profile' && a && (
          <div style={{ ...s.page, ...(isMobile ? { padding: '1rem' } : {}) }}>
            {coachProfileWeek && <ProfileWeekSummary enabled={coachProfileWeek} athleteId={a.id} reads={fourWeekReads[a.id]} />}
            <ProfilHoved {...{ mobilitetCoach: mobilitetCoach === true, mobilitetHjemme: mobilitetHjemme === true, mobilitetOpfoelgning: mobilitetOpfoelgning === true, adherenceContent: mobilitetOpfoelgning === true ? <MobilityAdherenceProfile key={a.id} enabled={true} athleteId={a.id} /> : null, mobilityCoachId: session?.user?.id, onMobilitySaved: updated => { setSelectedAthlete(previous => previous?.id === updated.id ? updated : previous); setAthletes(previous => previous.map(item => item.id === updated.id ? updated : item)) }, mobilitetHjalp: mobilitetHjalp === true, coachRyd,
              ...(e2 ? { coachTabCleanup: true } : {}),
              a, activeTab, isMobile, navMenuOpen, nextPriorityItem, openCoachPriorityItem,
              priorityQueueContext, profilePriorityContext, profileReturnView, profilesLastSeen, setActiveTab, setEditing,
              setNavMenuOpen, setShowDeleteModal, setView, showFlash, unreadCounts,
            }} />

            {/* TAB: HUB — coach-landingsside med status + sektionsnavigation */}
            {activeTab === 'hub' && (() => {
              // Ordre 1545: "2 af 4" som forsiden, ikke kun "2".
              const hubUger = calendarWeeks[a.id] || []
              const hubNo = currentWeekNo(hubUger, athleteCurrentWeek[a.id] ?? null)
              const plannedPas = hubUger.find(week => week.week_number === hubNo)?.session_count ?? null
              return (
                <HubTab {...{ coachRyd,
                  ...(e2 ? { coachTabCleanup: true } : {}),
                  a, athleteReadiness, isMobile, plannedPas, setActiveTab, setEditing, unreadCounts,
                  videoAnalyses, weeklyActivity,
                }} />
              )
            })()}

            {/* TAB: ANALYSE */}
            {activeTab === 'analyse' && (
              <LazyBoundary
                factory={analyseTabFactory} label="Analyse" loading={<div style={s.page}>Indlæser…</div>}
                componentProps={{ coachRyd,
                  ...(e2 ? { coachTabCleanup: true } : {}),
                  analyseMissingData, sendMissingDataMessage,
                  analyseConclusionMessage, coachId: session?.user?.id, sendConclusionMessage,
                  a, aiExportCopied, aiExportText, aiExportWeeks,
                  athleteLogs, athletePRHistory, athleteReadiness,
                  athleteWeightLogs, exerciseLibrary, fetchVideoCoachHistory,
                  generateAIReport, isMobile, openAwaitingAnalysisVideo,
                  openVideoAnalysisReview, openVideoCoachV3, reviewVideoAnalysis,
                  selectedAthlete, setAiExportCopied, setAiExportText,
                  setAiExportWeeks, setShowAiExport, setVideoLiftFilter,
                  showAiExport, videoAnalyses, videoAnalysisError,
                  videoAnalysisLoading, videoAnalysisReviewError,
                  videoAnalysisReviewLoadingId, videoAnalysisUpdatingId,
                  videoBaselines, videoLiftFilter, weeks,
                  weeklyEvaluation: e2 ? <LazyBoundary factory={coachWeekFactory} label="Ugeevaluering"
                    loading={<p role="status">Henter ugeevaluering …</p>}
                    componentProps={{ enabled: true, client: supabase, coachId: session?.user?.id, athleteId: a.id, asOf: e2Dag.day }} /> : null,
                }}
              />
            )}

            {/* TAB: OPVARMNING */}
            {activeTab === 'opvarmning' && (() => {
              return (
                <OpvarmningTab {...{
                  a, deleteWarmupTemplate, editingWarmup, saveWarmupTemplate, saving, setEditingWarmup,
                  setWarmupDraftSteps, setWarmupNewStep, warmupDraftSteps, warmupNewStep, warmupTemplates,
                }} />
              )
            })()}

            {/* TAB: OVERSIGT */}
            {activeTab === 'oversigt' && (
              <>
              {coachFourWeeksEnabled === true && <CoachFourWeeks athlete={a} reads={fourWeekReads[a.id]} onOpenVideo={openVideoAnalysisReview} onOpenAwaitingVideo={openAwaitingAnalysisVideo} videoOpening={videoAnalysisReviewLoadingId} videoError={videoAnalysisReviewError} />}
              <OversigtTab {...{
                blokFremgang: blokFremgang === true,
                ...(e2 ? { coachTabCleanup: true } : {}),
                a, athleteLogs, athleteReadiness, currentWeight, editData, editing,
                isMobile, openMeetResult, profilesLastSeen, saveEdit, saving, session,
                setActiveTab, setEditData, setEditing, startEdit, total, trainingTotal,
                volumenKortFactory, weeks, weightTrend,
              }} />
              </>
            )}

            {/* TAB: KOST */}
            {e2 && activeTab === 'kost' && (
              <CoachKostMaal enabled={true} athlete={a} weightStatus={e2KostVaegt} today={calendarDay()} {...{
                editing, editData, startEdit, setEditData, setEditing, saveEdit, saving,
                session, loading, loadError,
              }} coachNutrition={e2CoachNutrition} readContext={e2ReadContext} />
            )}
            {!e2 && activeTab === 'kost' && (
              <KostTab {...{
                a, editData, editing, isMobile, saveEdit, saving,
                setEditData, setEditing, startEdit,
              }} />
            )}

            {/* TAB: PROGRAM */}
            {activeTab === 'program' && (
              <LazyBoundary
                factory={programTabFactory} label="Program" loading={<div style={s.page}>Indlæser…</div>}
                componentProps={{
                  ...(e2 ? { coachTabCleanup: true } : {}),
                  addExercise, addingExercise, addingSession,
                  addingWeek, addSession, addWeek,
                  applyPeriodizationSuggestion, applyWeekDateFill, approveDraftProgressionState,
                  approvingProgression, assignEdits, athleteLogs, bestLog,
                  blockPlan, copyExerciseToSession, copyingExercise,
                  copyingSession, copySessionToWeek, copyWeek, copyBlock, copyingWeek, pendingWeekDeletes, programCopyEnabled, coachPlanCopyEnabled, deleteExercise,
                  deleteSession, deleteWeek, editDraftForecast, editingExercise,
                  editingRecommended, editingSession, editingWeek, exFormRow,
                  fetchWeeks, generateWeeksFromPlan, gotoWeek, isMobile,
                  openSessionId, openWeekId, parseIntensity, planAssistantFocus,
                  planStartDate, previewWeekDateFill, programActiveStart, programBlockStart,
                  programShownWeeks,
                  recommendedInput, renameValue, renamingBlock, reorderExercise,
                  reorderSession, saveRecommendedWeight, selectedAthlete,
                  sendingDraft,
                  sessionForm, sessionLogStatus, setAddingExercise,
                  setAddingSession, setAddingWeek, setAssignEdits, setBlockPlan,
                  setCopyingExercise, setCopyingSession, setDraftForecastOverrideReason,
                  setEditingExercise, setEditingRecommended, setEditingSession,
                  setEditingWeek, setExerciseForm, setOpenSessionId, setOpenWeekId,
                  setPlanAssistantFocus, setPlanStartDate, setProgramBlockStart,
                  setRecommendedInput, setRenameValue, setRenamingBlock,
                  setSendingDraft, setSessionForm, setShowBlockPlanner,
                  setWeekDateFill, setWeekDraft, setWeekForm, showBlockPlanner, showFlash,
                  updateExercise, updateSession, updateWeek, weekdayPicker,
                  weekDateFill, weekDraft, weekForm, weeks,
                }}
              />
            )}

            {/* TRÆNINGSLOG */}
            {activeTab === 'log' && (() => {
              return (
                <LogTab {...{
                  ...(e2 ? { coachTabCleanup: true, athleteId: a.id } : {}),
                  athleteLogs, isMobile, logExerciseFilter, openLogWeeks, setLogExerciseFilter, setOpenLogWeeks,
                }} />
              )
            })()}

            {/* TAB: NOTER */}
            {activeTab === 'stævne' && (() => {
              return (
                <StaevneTab {...{
                  ...(e2 ? { coachTabCleanup: true } : {}),
                  a, athletePRs, deleteMeetResult, meetPlan, meetPlanForm, meetResults,
                  openMeetResult, saveMeetPlan, savingMeetPlan, setMeetPlan, setMeetPlanForm,
                }} />
              )
            })()}

            {activeTab === 'noter' && (
              <NoterTab {...{ mobilitetCoach: mobilitetCoach === true, mobilityCoachId: session?.user?.id, mobilityClient: supabase, setSaving, showFlash, onMobilitySaved: updated => { setSelectedAthlete(previous => previous?.id === updated.id ? updated : previous); setAthletes(previous => previous.map(item => item.id === updated.id ? updated : item)) } }} {...(coachNotesEnabled ? { key: `${session.user.id}:${a.id}` } : {})} {...{
                ...(e2 ? { coachTabCleanup: true } : {}),
                coachNotesEnabled,
                onAddNote: coachNotesEnabled ? createCoachNoteSaver({
                  enabled: coachNotesEnabled, athlete: a, coachId: session.user.id, client: supabase,
                  onSaved: data => {
                    setSelectedAthlete(previous => previous?.id === data.id ? data : previous)
                    setAthletes(previous => previous.map(item => item.id === data.id ? data : item))
                  },
                }) : undefined,
                a, editData, editing, saveEdit, saving, setEditData,
                setEditing, startEdit,
              }} />
            )}

            {/* TAB: BESKEDER */}
            {e2 && activeTab === 'beskeder' && (
              <ConversationEntry enabled={true} role="coach" controllerRef={e2CoachSamtaleRef} getEntry={() => ({
                enabled: true, session, selectedAthlete, athletes, hiddenAthleteIds, inboxDatabase: supabase,
                openVideoAnalysisReview, openAwaitingAnalysisVideo, storage: () => localStorage,
              })} />
            )}
            {!e2 && activeTab === 'beskeder' && (() => {
              return (
                <BeskederTab {...{
                  a, coachMsgTrack, fetchMessages, formatMsgTime, messageInput, messages,
                  messageSendError, messageThreadError, sendCoachMessage, sendingMessage, setCoachMsgTrack, setMessageInput,
                  setMessageSendError, togglePin, saveNextAvailable, saveNextBusy, saveNextError, saveNextDone, saveMessageAndNext,
                }} />
              )
            })()}
          </div>
        )}
      </main>

      {videoAnalysisReview && (() => {
        return (
          <VideoReviewModal coachId={session?.user?.id} videoReviewTemplates={videoReviewTemplates} {...{ coachRyd,
            closeVideoAnalysisReview, discardVideoAnalysisFeedback, isMobile, saveApproveShareVideoAnalysis, reviewVideoAnalysis, saveVideoAnalysisFeedback, selectedAthlete,
            saveNextAvailable, saveNextBusy, saveNextError, saveVideoAndNext,
            setVideoAnalysisBaselineFindingId, setVideoAnalysisCloseWarning, setVideoAnalysisFeedbackDirty, setVideoAnalysisFeedbackDraft, videoAnalyses, videoAnalysisBaselineFindingId,
            videoAnalysisCloseWarning, videoAnalysisFeedbackDirty, videoAnalysisFeedbackDraft, videoAnalysisReview, videoAnalysisUpdatingId, videoBaselines,
          }} />
        )
      })()}

      {meetResultForm && (() => {
        return (
          <StaevneResultatModal {...{
            meetResultForm, saveMeetResult, saving, selectedAthlete, setMeetResultForm,
          }} />
        )
      })()}

      {showAddModal && (() => {
        return (
          <NyAtletModal {...{
            addAthlete, addStep, newAthlete, saving, setAddStep, setNewAthlete,
            setShowAddModal,
          }} />
        )
      })()}

      {showDeleteModal && (
        <div style={s.overlay} onClick={e => e.target === e.currentTarget && setShowDeleteModal(false)}>
          <div style={s.modal}>
            <div style={s.modalTitle}>Fjern atlet</div>
            <p style={{ fontSize: '0.88rem', color: '#7a7770', lineHeight: 1.75, marginBottom: '1.5rem' }}>Er du sikker på at du vil fjerne {a?.name}? Det kan ikke fortrydes.</p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button style={s.btnGhost} onClick={() => setShowDeleteModal(false)}>Annuller</button>
              <button style={s.btnDanger} onClick={deleteAthlete}>Fjern</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
