import { useState, useEffect, useRef } from 'react'
import { supabase, signOutHard } from './supabase'
import LazyBoundary from './LazyBoundary'
import { buildCoachPriorityItems, coachPriorityQueueContext } from './coachPriority'
import { coachInboxEntryIntent, coachInboxFocusDecision, createSingleFlightRunner } from './coachInboxState'
import { blockPurpose, withBlockPurposes } from './periodizationAssistant'
import {
  BLOCK_NAMES, blockColor, computePhases, currentWeekNo,
  VIDEOCOACH_STATUS, VIDEOCOACH_METRICS, videoCoachMetric, videoCoachBaseline,
  videoCoachMetricText, videoCoachBaselineText, s,
  readinessSignal, formatLastSeen, parsePlannedRpe, initials,
} from './dashboardShared'
import { WEEKDAYS_SHORT, statusLabels, holidayInfo, ferieBadgeLabel } from './dashboard/coachKonstanter'
import { HUB_SECTIONS } from './dashboard/hubSektioner'
import { VIDEOCOACH_V3_URL, coachVideoPriorityDetail } from './dashboard/coachVideoHjaelp'
import { lavLaesninger } from './dashboard/laesninger'
import { lavNavigation } from './dashboard/navigation'
import { lavIndbakkeHandlinger } from './dashboard/indbakkeHandlinger'
import { lavVideoReviewHandlinger } from './dashboard/videoReviewHandlinger'
import { lavAtletHandlinger } from './dashboard/atletHandlinger'
import { lavAiRapport } from './dashboard/aiRapport'
import { lavProgramHandlinger } from './dashboard/programHandlinger'
import { useVideoCoachBro } from './dashboard/useVideoCoachBro'
import BibliotekView from './dashboard/BibliotekView'
import KalenderView from './dashboard/KalenderView'
import ForsideView from './dashboard/ForsideView'
import HubTab from './dashboard/HubTab'
import OpvarmningTab from './dashboard/OpvarmningTab'
import OversigtTab from './dashboard/OversigtTab'
import KostTab from './dashboard/KostTab'
import LogTab from './dashboard/LogTab'
import StaevneTab from './dashboard/StaevneTab'
import NoterTab from './dashboard/NoterTab'
import BeskederTab from './dashboard/BeskederTab'
import VideoReviewModal from './dashboard/VideoReviewModal'
import StaevneResultatModal from './dashboard/StaevneResultatModal'
import NyAtletModal from './dashboard/NyAtletModal'





// Lazy-loadede underfaner (ordre 130 · commit 2): coachens tungeste skærme
// (videoer, program-redigering, indbakke) hentes kun når coachen rent faktisk
// åbner dem, så atletlisten og check-in-gennemgangen ikke skal downloade dem.
// Indlæses via LazyBoundary (ordre 163 · del 2): egen fejlgrænse pr. fane, så
// en fejl i ÉN fane ikke river resten af dashboardet med sig.
const indbakkeFactory = () => import('./dashboard/IndbakkeView')
const analyseTabFactory = () => import('./dashboard/AnalyseTab')
const programTabFactory = () => import('./dashboard/ProgramTab')
// ORDRE 228 · commit 2: Volumenkortet (177/185/209/210) trækker hele
// src/volume/-træet med sig, inkl. den 53 kB genererede kortlægnings-JSON
// (muskelkort.generet.json) — kun brugt på 'oversigt'-fanen i en atlets
// profil, aldrig ved coachens første tegning af atletlisten. Samme
// LazyBoundary-mønster som de tre fane-factories ovenfor.
const volumenKortFactory = () => import('./dashboard/VolumenKort')

export default function Dashboard({ session, onPreviewAthlete }) {
  const initialCoachEntryRef = useRef(coachInboxEntryIntent(
    typeof window === 'undefined' ? '' : window.location.search,
  ))
  const [athletes, setAthletes] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [view, setView] = useState(initialCoachEntryRef.current.view)
  const focusNextFromLinkRef = useRef(initialCoachEntryRef.current.focusNext)
  const [profileReturnView, setProfileReturnView] = useState('list')
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
  const [myAthleteId, setMyAthleteId] = useState(() => localStorage.getItem('entropi_my_athlete_id') || null)
  const [pickingMine, setPickingMine] = useState(false)
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 768)

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
  const [planStartDate, setPlanStartDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [planAssistantFocus, setPlanAssistantFocus] = useState('competition')
  const [assignEdits, setAssignEdits] = useState({})
  const [sessionForm, setSessionForm] = useState({ title: '', weekday: null })
  const [exerciseForm, setExerciseForm] = useState({ name: '', sets: '', reps: '', intensity: '', intensityPrefix: 'RPE', note: '' })
  const [athleteLogs, setAthleteLogs] = useState([])
  const [openLogWeeks, setOpenLogWeeks] = useState(null) // null = standard (seneste uge åben); ellers Set af åbne ugenumre
  const [logExerciseFilter, setLogExerciseFilter] = useState(null) // Log-fane: null = alle øvelser; ellers øvelsesnavn
  const [weeklyActivity, setWeeklyActivity] = useState({}) // athlete_id → { sessions, sets } for indeværende uge
  const [athleteWeightLogs, setAthleteWeightLogs] = useState([])
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
  const [athleteLastLogs, setAthleteLastLogs] = useState({})
  const [calendarWeeks, setCalendarWeeks] = useState({}) // athlete_id -> [{week_number, block_name, start_date, session_count, exercise_count, planned_sets, planned_tonnage}]
  const [athleteCurrentWeek, setAthleteCurrentWeek] = useState({}) // athlete_id -> ugenummer for seneste logg. træning
  // ORDRE 277 · commit 1: athlete_id -> { [week_number]: { sets, tonnage } } —
  // gennemførte (ikke sprunget over) sæt/tonnage pr. programuge, til
  // afvigelse-sorteringen (src/dashboard/afvigelse.js).
  const [athleteWeekCompletion, setAthleteWeekCompletion] = useState({})
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

  const {
    refreshCoachInbox, fetchLastBackup, fetchAthletes, fetchAthleteWeekSummaries, fetchCalendarWeeks, fetchCalendarProgress,
    fetchVideoReviewQueue, fetchWeeks, fetchExerciseLibrary, fetchLatestMessages, fetchMessages, fetchAthleteLogs,
    fetchVideoCoachHistory, fetchAthleteWeightLogs, fetchAthleteReadiness, fetchAthletePRs, fetchMeetResults, fetchMeetPlan,
    fetchWarmupTemplates,
  } = lavLaesninger({
    inboxRefreshRunnerRef, messageThreadAthleteRef, session, setAthleteCurrentWeek, setAthleteLastLogs, setAthleteLogs,
    setAthletePRHistory, setAthletePRs, setAthleteReadiness, setAthletes, setAthleteWeekCompletion, setAthleteWeekSummary,
    setAthleteWeightLogs, setAutomationAlerts, setAutomationAlertsError, setCalendarWeeks, setCoachBriefingSeen, setExerciseLibrary,
    setHiddenAthleteIds, setInboxRefreshing, setInboxRefreshStatus, setLastBackup, setLatestByTrack, setLoadError,
    setLoading, setMeetPlan, setMeetPlanForm, setMeetResults, setMessageInboxError, setMessageInput,
    setMessages, setMessageSendError, setMessageThreadError, setProfilesLastSeen, setSnoozedAthletes, setTodayData,
    setTrainingSignals, setTrainingSignalsError, setUnreadByTrack, setUnreadCounts, setVideoAnalyses, setVideoAnalysisError,
    setVideoAnalysisLoading, setVideoBaselines, setVideoReviewQueue, setVideoReviewQueueError, setWarmupTemplates, setWeeklyActivity,
    setWeeks, videoCoachAthletesRef,
  })

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
    reviewVideoAnalysis, saveVideoAnalysisFeedback, closeVideoAnalysisReview, discardVideoAnalysisFeedback, openAwaitingAnalysisVideo, openVideoAnalysisReview,
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
    deleteExercise, saveRecommendedWeight, copyWeek, previewWeekDateFill, applyWeekDateFill,
  } = lavProgramHandlinger({
    askConfirm, athleteLogs, athletes, blockPlan, calendarWeeks, exerciseForm,
    exerciseLibrary, fetchAthleteWeekSummaries, fetchCalendarWeeks, fetchExerciseLibrary, fetchWeeks, libraryAddForm,
    libraryEditForm, openSessionId, openWeekId, planAssistantFocus, planStartDate, programBlockStart,
    recommendedInput, selectedAthlete, session, sessionForm, setAddingExercise, setAddingLibraryEx,
    setAddingSession, setAddingWeek, setApprovingProgression, setBlockPlan, setCalBlockAthlete, setCopyingExercise,
    setCopyingSession, setEditingExercise, setEditingLibraryEx, setEditingRecommended, setEditingSession, setEditingWeek,
    setExerciseForm, setLibraryAddForm, setOpenSessionId, setOpenWeekId, setPlanStartDate, setProgramBlockStart,
    setSessionForm, setShowBlockPlanner, setSnoozedAthletes, setWeekDateFill, setWeekDraft, setWeekForm,
    showFlash, weekDateFill, weekDraft, weekForm, weeks,
  })

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
  }, [activeTab, selectedAthlete?.id])
  useEffect(() => {
    if (!selectedAthlete) weeksLogsLoadedForRef.current = null
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
  }, [activeTab, selectedAthlete?.id])

  useEffect(() => {
    if ((activeTab === 'hub' || activeTab === 'analyse') && selectedAthlete?.id) {
      fetchVideoCoachHistory(selectedAthlete.id)
    }
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
  }, [activeTab, selectedAthlete?.id])

  useEffect(() => {
    if (activeTab === 'stævne' && selectedAthlete?.id) {
      fetchMeetPlan(selectedAthlete.id)
      fetchMeetResults(selectedAthlete.id)
      fetchAthletePRs(selectedAthlete.id)
    }
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
        {blockPlan.map((block, i) => (
          <div key={block.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: blockColor(block.name), flexShrink: 0 }} />
            <select
              value={block.name}
              onChange={e => setBlockPlan(p => p.map((b, j) => j === i ? { ...b, name: e.target.value, description: blockPurpose(e.target.value) } : b))}
              style={{ ...s.fieldSelect, width: '160px', padding: '0.35rem 0.6rem', fontSize: '0.72rem' }}
            >
              {BLOCK_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <input
                type="number" min="1" max="20"
                value={block.weeks}
                onChange={e => setBlockPlan(p => p.map((b, j) => j === i ? { ...b, weeks: Math.max(1, parseInt(e.target.value) || 1) } : b))}
                style={{ ...s.fieldInput, width: '52px', padding: '0.35rem 0.5rem', fontSize: '0.72rem', textAlign: 'center' }}
              />
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#7a7770' }}>uge{block.weeks !== 1 ? 'r' : ''}</span>
            </div>
            <button onClick={() => setBlockPlan(p => p.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: '#4a4844', cursor: 'pointer', fontSize: '0.7rem', padding: '0.1rem 0.3rem' }}>✕</button>
          </div>
        ))}
        <button
          onClick={() => setBlockPlan(p => [...p, { id: Date.now(), name: BLOCK_NAMES[0], weeks: 2, description: blockPurpose(BLOCK_NAMES[0]) }])}
          style={{ ...s.btnGhost, fontSize: '0.52rem', padding: '0.3rem 0.7rem', alignSelf: 'flex-start', marginTop: '0.25rem' }}
        >+ Tilføj blok</button>
      </div>
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

  const currentWeight = (() => {
    if (!athleteWeightLogs.length) return null
    const recent = athleteWeightLogs.slice(0, 5).map(l => l.weight)
    if (recent.length >= 5) {
      const sorted = [...recent].sort((a, b) => a - b)
      return sorted[Math.floor(sorted.length / 2)]
    }
    return Math.round((recent.reduce((s, v) => s + v, 0) / recent.length) * 10) / 10
  })()

  const weightTrend = (() => {
    if (athleteWeightLogs.length < 2) return null
    const now = new Date()
    const d7 = new Date(now); d7.setDate(now.getDate() - 7)
    const d14 = new Date(now); d14.setDate(now.getDate() - 14)
    const thisWeek = athleteWeightLogs.filter(l => new Date(l.logged_at) >= d7).map(l => l.weight)
    const prevWeek = athleteWeightLogs.filter(l => { const d = new Date(l.logged_at); return d >= d14 && d < d7 }).map(l => l.weight)
    if (!thisWeek.length || !prevWeek.length) return null
    const thisAvg = thisWeek.reduce((s, v) => s + v, 0) / thisWeek.length
    const prevAvg = prevWeek.reduce((s, v) => s + v, 0) / prevWeek.length
    return Math.round((thisAvg - prevAvg) * 10) / 10
  })()

  const lastLogPerExercise = {}
  for (const log of athleteLogs) {
    const name = log.exercises?.name
    if (name && (log.weight > 0 || log.reps_completed > 0)) {
      if (!lastLogPerExercise[name]) lastLogPerExercise[name] = []
      lastLogPerExercise[name].push({ weight: log.weight, reps_completed: log.reps_completed, logged_at: log.logged_at })
    }
  }

  function repZone(r) {
    const n = parseInt(r) || 0
    if (n <= 3) return 0
    if (n <= 6) return 1
    if (n <= 10) return 2
    return 3
  }

  function bestLog(name, plannedReps) {
    const logs = lastLogPerExercise[name]
    if (!logs?.length) return null
    const planned = parseInt(plannedReps) || 0
    if (planned > 0) {
      const zone = repZone(planned)
      const sameZone = logs.filter(l => repZone(l.reps_completed) === zone)
      if (sameZone.length > 0) return sameZone[0]
    }
    return logs[0]
  }

  // Delt ugedags-vælger (bruges i både rediger- og tilføj-session-formen).
  const weekdayPicker = (
    <div style={{ marginBottom: '0.5rem' }}>
      <div style={s.fieldLabel}>Fast ugedag (valgfri)</div>
      <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
        {WEEKDAYS_SHORT.map((d, i) => {
          const active = sessionForm.weekday === i
          return (
            <button key={i} onClick={() => setSessionForm(p => ({ ...p, weekday: active ? null : i }))}
              style={{ ...s.btnSm, fontSize: '0.55rem', padding: '0.25rem 0.5rem', background: active ? 'rgba(200,146,58,0.18)' : 'transparent', borderColor: active ? '#c8923a' : 'rgba(237,234,226,0.12)', color: active ? '#c8923a' : '#7a7770' }}>{d}</button>
          )
        })}
        <button onClick={() => setSessionForm(p => ({ ...p, weekday: null }))}
          style={{ ...s.btnSm, fontSize: '0.55rem', padding: '0.25rem 0.5rem', background: 'transparent', borderColor: sessionForm.weekday == null ? '#c8923a' : 'rgba(237,234,226,0.12)', color: sessionForm.weekday == null ? '#c8923a' : '#7a7770' }}>Ingen</button>
      </div>
    </div>
  )

  const exFormRow = (() => {
    const searchLower = (exerciseForm.name || '').toLowerCase()
    const grouped = {}
    for (const ex of exerciseLibrary) {
      const cat = ex.category || 'Andet'
      if (!grouped[cat]) grouped[cat] = []
      if (ex.name.toLowerCase().includes(searchLower)) grouped[cat].push(ex)
    }
    const competitionOrder = ['Squat', 'Bænkpres', 'Dødløft']
    const filteredCategories = Object.entries(grouped)
      .filter(([, exs]) => exs.length > 0)
      .sort(([a], [b]) => {
        const ai = competitionOrder.indexOf(a)
        const bi = competitionOrder.indexOf(b)
        if (ai !== -1 && bi !== -1) return ai - bi
        if (ai !== -1) return -1
        if (bi !== -1) return 1
        return a.localeCompare(b)
      })
    const exactMatch = exerciseLibrary.some(e => e.name.toLowerCase() === searchLower && searchLower !== '')
    const showDropdown = exerciseSearchOpen && (filteredCategories.length > 0 || (exerciseForm.name.trim() && !exactMatch))

    return (
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 0.5fr 0.7fr minmax(200px, 2fr) 1.5fr', gap: '0.5rem', alignItems: 'end' }}>
        <div style={{ position: 'relative' }}>
          <div style={s.fieldLabel}>Navn</div>
          <input
            style={{ ...s.fieldInput, fontSize: '0.8rem', padding: '0.4rem 0.6rem', minHeight: '44px', boxSizing: 'border-box' }}
            type="text"
            placeholder="Søg øvelse..."
            value={exerciseForm.name}
            autoComplete="off"
            onChange={e => { setExerciseForm(p => ({ ...p, name: e.target.value })); setExerciseSearchOpen(true) }}
            onFocus={() => setExerciseSearchOpen(true)}
            onBlur={() => setTimeout(() => setExerciseSearchOpen(false), 180)}
          />
          {exerciseForm.name.trim() && !exactMatch && !exerciseSearchOpen && (
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', color: '#c8923a', marginTop: '0.2rem', letterSpacing: '0.06em' }}>
              Ikke i bibliotek — tilføj via dropdown
            </div>
          )}
          {showDropdown && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1c1c18', border: '1px solid rgba(237,234,226,0.13)', borderTop: 'none', zIndex: 100, maxHeight: '240px', overflowY: 'auto' }}>
              {filteredCategories.map(([cat, exs]) => (
                <div key={cat}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.46rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#c8923a', padding: '0.3rem 0.6rem 0.15rem', background: 'rgba(14,14,10,0.7)', position: 'sticky', top: 0 }}>{cat}</div>
                  {exs.map(ex => (
                    <div
                      key={ex.id}
                      onMouseDown={e => { e.preventDefault(); setExerciseForm(p => ({ ...p, name: ex.name })); setExerciseSearchOpen(false) }}
                      style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem', color: '#b8b4a8', cursor: 'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(237,234,226,0.06)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >{ex.name}</div>
                  ))}
                </div>
              ))}
              {exerciseForm.name.trim() && !exactMatch && (
                <div
                  onMouseDown={e => { e.preventDefault(); addToLibraryQuick(exerciseForm.name.trim()); setExerciseSearchOpen(false) }}
                  style={{ padding: '0.4rem 0.75rem', fontSize: '0.68rem', color: '#c8923a', cursor: 'pointer', borderTop: '1px solid rgba(237,234,226,0.07)', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.06em' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(200,146,58,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >+ Tilføj "{exerciseForm.name.trim()}" til bibliotek</div>
              )}
            </div>
          )}
        </div>
        {[['Sæt', 'sets', 'number'], ['Reps', 'reps', 'text']].map(([label, key, type]) => (
          <div key={key}>
            <div style={s.fieldLabel}>{label}</div>
            <input
              style={{ ...s.fieldInput, fontSize: '0.8rem', padding: '0.4rem 0.6rem', minHeight: '44px', boxSizing: 'border-box' }}
              type={type}
              placeholder={label}
              value={exerciseForm[key]}
              onChange={e => setExerciseForm(p => ({ ...p, [key]: e.target.value }))}
            />
          </div>
        ))}
        <div>
          <div style={s.fieldLabel}>Intensitet</div>
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            <select
              aria-label="Intensitetsenhed"
              style={{ ...s.fieldInput, fontSize: '0.72rem', padding: '0.4rem 0.3rem', width: 'auto', flexShrink: 0, cursor: 'pointer', minHeight: '44px', boxSizing: 'border-box' }}
              value={exerciseForm.intensityPrefix}
              onChange={e => setExerciseForm(p => ({ ...p, intensityPrefix: e.target.value }))}
            >
              <option value="RPE">RPE</option>
              <option value="%">%</option>
              <option value="Tid">Tid</option>
              <option value="Fri tekst">Fri</option>
            </select>
            <input
              style={{ ...s.fieldInput, fontSize: '0.8rem', padding: '0.4rem 0.6rem', flex: 1, minWidth: 0, minHeight: '44px', boxSizing: 'border-box' }}
              type={exerciseForm.intensityPrefix === 'Fri tekst' ? 'text' : 'number'}
              placeholder={exerciseForm.intensityPrefix === 'RPE' ? 'f.eks. 8' : exerciseForm.intensityPrefix === '%' ? 'f.eks. 80' : exerciseForm.intensityPrefix === 'Tid' ? 'sek, f.eks. 20' : 'tekst...'}
              value={exerciseForm.intensity}
              onChange={e => setExerciseForm(p => ({ ...p, intensity: e.target.value }))}
            />
          </div>
        </div>
        <div>
          <div style={s.fieldLabel}>Note</div>
          <input
            style={{ ...s.fieldInput, fontSize: '0.8rem', padding: '0.4rem 0.6rem', minHeight: '44px', boxSizing: 'border-box' }}
            type="text"
            placeholder="Note"
            value={exerciseForm.note}
            onChange={e => setExerciseForm(p => ({ ...p, note: e.target.value }))}
          />
        </div>
      </div>
    )
  })()

  return (
    <div style={s.wrap}>
      {/* VideoCoach som iframe — coachen optager/gemmer for en valgt atlet (inkl.
          sig selv) uden at forlade portalen. Luk sker via VideoCoachs egen ✕,
          der poster :close til broen ovenfor. */}
      {videoCoachOpen && (
        <div role="dialog" aria-label="VideoCoach" style={{ position: 'fixed', inset: 0, zIndex: 12000, background: '#0f0e0b' }}>
          <iframe
            ref={videoCoachFrameRef}
            src={VIDEOCOACH_V3_URL}
            title="VideoCoach"
            allow="fullscreen"
            allowFullScreen
            style={{ display: 'block', width: '100%', height: '100%', border: 0, background: '#0f0e0b' }}
          />
        </div>
      )}
      {/* Toast */}
      {flash && (
        <div style={{
          position: 'fixed', top: '1.25rem', left: '50%', transform: 'translateX(-50%)',
          background: '#1c1c18', border: `1px solid ${flash.kind === 'error' ? 'rgba(224,85,85,0.55)' : 'rgba(200,146,58,0.55)'}`,
          padding: '0.65rem 1.4rem', zIndex: 10000, maxWidth: '90vw',
          fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.62rem', letterSpacing: '0.06em',
          color: flash.kind === 'error' ? '#e05555' : '#c8923a', boxShadow: '0 4px 24px rgba(0,0,0,0.55)',
        }}>{flash.message}</div>
      )}
      {/* Bekræftelses-modal */}
      {confirmDialog && (
        <div onClick={() => setConfirmDialog(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,8,0.6)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#1c1c18', border: '1px solid rgba(237,234,226,0.13)', padding: '1.5rem', maxWidth: '360px', width: '100%', boxShadow: '0 8px 40px rgba(0,0,0,0.6)' }}>
            <div style={{ fontSize: '0.95rem', color: '#edeae2', lineHeight: 1.5, marginBottom: '1.25rem' }}>{confirmDialog.message}</div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button style={s.btnGhost} onClick={() => setConfirmDialog(null)}>Annuller</button>
              <button style={confirmDialog.kind === 'primary'
                ? { ...s.btnPrimary }
                : { ...s.btnPrimary, background: '#e05555', borderColor: '#e05555', color: '#141410' }}
                onClick={() => { const fn = confirmDialog.onConfirm; setConfirmDialog(null); fn && fn() }}>{confirmDialog.confirmLabel || 'Bekræft'}</button>
            </div>
          </div>
        </div>
      )}
      {isMobile && (
        <style>{`
          button { min-height: 44px !important; }
          input, select, textarea { font-size: 16px !important; }
        `}</style>
      )}
      {isMobile && sidebarOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 199 }}
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside style={{
        ...s.sidebar,
        ...(isMobile ? {
          transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.25s ease',
          zIndex: 200,
        } : {}),
      }}>
        <div style={{ ...s.sidebarLogo, cursor: 'pointer' }} onClick={() => { setView('list'); setSelectedAthlete(null); setSidebarOpen(false) }}>
          <div style={s.wordmark}>Entropi<span style={{ color: '#c8923a' }}>.</span></div>
          <div style={s.sub}>Coach Portal</div>
        </div>
        <nav style={{ flex: 1, padding: '0.75rem 0', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {[
            { icon: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></>, label: 'Forside', active: view === 'list', onClick: () => { setView('list'); setSelectedAthlete(null); setSidebarOpen(false) } },
            { icon: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />, label: 'Min træning', active: false, onClick: () => { setSidebarOpen(false); goToMyProfile() } },
            { icon: <><rect x="3" y="5" width="18" height="16" rx="2" /><line x1="3" y1="10" x2="21" y2="10" /><line x1="8" y1="3" x2="8" y2="7" /><line x1="16" y1="3" x2="16" y2="7" /></>, label: 'Kalender', active: view === 'calendar', onClick: () => { setView('calendar'); setSelectedAthlete(null); setSidebarOpen(false) } },
            { icon: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />, label: 'Coach Briefing', active: view === 'inbox', badge: coachPriorityCount, onClick: () => { setView('inbox'); setSelectedAthlete(null); setSidebarOpen(false) } },
            { icon: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></>, label: 'Bibliotek', active: view === 'library', onClick: () => { setView('library'); setSelectedAthlete(null); setSidebarOpen(false) } },
          ].map(item => (
            <div
              key={item.label}
              onClick={item.onClick}
              style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.55rem 1.25rem', cursor: 'pointer', borderLeft: item.active ? '2px solid #c8923a' : '2px solid transparent', background: item.active ? 'rgba(200,146,58,0.08)' : 'transparent', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: item.active ? '#c8923a' : '#b8b4a8' }}
              onMouseEnter={e => { if (!item.active) e.currentTarget.style.background = 'rgba(237,234,226,0.03)' }}
              onMouseLeave={e => { if (!item.active) e.currentTarget.style.background = 'transparent' }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>{item.icon}</svg>
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badge > 0 && (
                <span style={{ background: '#c8923a', color: '#141410', fontSize: '0.46rem', fontWeight: 700, borderRadius: '999px', padding: '0.1rem 0.35rem', flexShrink: 0 }}>{item.badge}</span>
              )}
            </div>
          ))}
          <div style={{ borderTop: '1px solid rgba(237,234,226,0.06)', margin: '0.75rem 1.25rem' }} />
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.46rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#4a4844', padding: '0 1.25rem', marginBottom: '0.45rem' }}>Atleter</div>
          {athletes.filter(a => !hiddenAthleteIds.has(a.id)).map(ath => {
            const isActive = (view === 'profile' || view === 'list') && selectedAthlete?.id === ath.id
            const unread = unreadCounts[ath.id] || 0
            const ws = athleteWeekSummary[ath.id]
            const hol = holidayInfo(ath)
            const trainedToday = todayData.logs.some(l => l.athlete_id === ath.id)
            const ringColor = hol?.onHoliday ? 'rgba(91,155,181,0.6)' : unread > 0 ? 'rgba(200,146,58,0.7)' : trainedToday ? 'rgba(108,186,108,0.6)' : 'rgba(237,234,226,0.12)'
            return (
              <div
                key={ath.id}
                onClick={() => { openProfile(ath); setSidebarOpen(false) }}
                style={{ padding: '0.4rem 1.25rem', cursor: 'pointer', borderLeft: isActive ? '2px solid #c8923a' : '2px solid transparent', background: isActive ? 'rgba(200,146,58,0.08)' : 'transparent', display: 'flex', alignItems: 'center', gap: '0.6rem' }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(237,234,226,0.03)' }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{ width: 28, height: 28, borderRadius: '50%', border: `1.5px solid ${ringColor}`, background: '#141410', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', color: isActive ? '#c8923a' : '#b8b4a8' }}>
                  {initials(ath.name)}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 300, fontSize: '0.78rem', color: isActive ? '#c8923a' : '#d5d2c8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ath.name.split(' ')[0]}</div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.46rem', color: '#5f5c55', marginTop: '0.05rem', letterSpacing: '0.04em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {hol?.onHoliday ? ferieBadgeLabel(hol) : ws ? `Uge ${ws.week_number}${ws.session_count > 0 ? '' : ' · tom'}` : 'Intet program'}
                  </div>
                </div>
                {unread > 0 && (
                  <span style={{ background: '#c8923a', color: '#141410', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.44rem', fontWeight: 700, borderRadius: '999px', padding: '0.1rem 0.35rem', flexShrink: 0 }}>{unread}</span>
                )}
              </div>
            )
          })}
          {athletes.length === 0 && (
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#4a4844', padding: '0.5rem 1.25rem' }}>Ingen atleter</div>
          )}
        </nav>
        <div style={s.sidebarFooter}>
          {onPreviewAthlete && !previewPickerOpen && (
            <button
              onClick={() => { setPickingMine(false); setPreviewPickerOpen(true) }}
              style={{ ...s.btnPrimary, width: '100%' }}
            >Se som atlet</button>
          )}
          {onPreviewAthlete && previewPickerOpen && (
            <div style={{ background: '#141410', border: '1px solid rgba(200,146,58,0.3)', padding: '0.5rem' }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#c8923a', marginBottom: '0.4rem' }}>{pickingMine ? 'Vælg din egen profil (huskes)' : 'Vælg profil'}</div>
              {athletes.map(a => (
                <div
                  key={a.id}
                  onClick={() => { setPreviewPickerOpen(false); if (pickingMine) { localStorage.setItem('entropi_my_athlete_id', a.id); setMyAthleteId(a.id); setPickingMine(false) } onPreviewAthlete(a.id) }}
                  style={{ padding: '0.4rem 0.5rem', fontSize: '0.8rem', color: '#b8b4a8', cursor: 'pointer', borderRadius: '1px' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(237,234,226,0.06)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >{a.name}</div>
              ))}
              <button onClick={() => { setPreviewPickerOpen(false); setPickingMine(false) }} style={{ ...s.btnGhost, fontSize: '0.48rem', padding: '0.2rem 0.5rem', marginTop: '0.3rem', width: '100%' }}>Annuller</button>
            </div>
          )}
          {/* Værktøjer samlet bag ét punkt — eksport/backup/VideoCoach/log ud er
              sjældne handlinger og skal ikke fylde i det daglige. */}
          <button
            onClick={() => setSidebarMoreOpen(o => !o)}
            style={{ background: 'transparent', border: 'none', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.55rem 0.1rem 0.15rem', cursor: 'pointer', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: sidebarMoreOpen ? '#c8923a' : '#7a7770' }}
          >
            <span>Værktøjer</span>
            <span style={{ fontSize: '0.5rem', transform: sidebarMoreOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>▾</span>
          </button>
          {sidebarMoreOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', paddingTop: '0.3rem' }}>
              {(() => {
                const days = lastBackup ? Math.floor((Date.now() - new Date(lastBackup)) / 86400000) : null
                const stale = days == null || days >= 7
                const backupNote = days == null ? '⚠ aldrig' : days === 0 ? '✓ i dag' : stale ? `⚠ ${days}d` : `✓ ${days}d`
                const row = { background: 'transparent', border: 'none', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.4rem 0.1rem', cursor: 'pointer', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', letterSpacing: '0.06em', color: '#7a7770', textAlign: 'left' }
                return (
                  <>
                    <button onClick={openVideoCoachV3} style={row}
                      onMouseEnter={e => e.currentTarget.style.color = '#b8b4a8'} onMouseLeave={e => e.currentTarget.style.color = '#7a7770'}>
                      <span>VideoCoach</span><span>→</span>
                    </button>
                    <button onClick={exportTraeningsdata} disabled={exportingTraening} style={row}
                      onMouseEnter={e => e.currentTarget.style.color = '#b8b4a8'} onMouseLeave={e => e.currentTarget.style.color = '#7a7770'}>
                      <span>{exportingTraening ? 'Henter…' : 'Træningsdata'}</span><span>↓</span>
                    </button>
                    <button onClick={exportBackup} disabled={exportingBackup} style={row}
                      onMouseEnter={e => e.currentTarget.style.color = '#b8b4a8'} onMouseLeave={e => e.currentTarget.style.color = '#7a7770'}>
                      <span>{exportingBackup ? 'Henter…' : 'Sikkerhedskopi'}</span>
                      <span style={{ color: stale ? '#c8923a' : '#4a4844' }}>{backupNote}</span>
                    </button>
                    <button onClick={() => signOutHard()} style={row}
                      onMouseEnter={e => e.currentTarget.style.color = '#e05555'} onMouseLeave={e => e.currentTarget.style.color = '#7a7770'}>
                      <span>Log ud</span><span>→</span>
                    </button>
                  </>
                )
              })()}
            </div>
          )}
        </div>
      </aside>

      <main style={{ ...s.main, ...(isMobile ? { marginLeft: 0, overflowX: 'hidden', paddingBottom: '76px' } : {}) }}>
        <div style={s.topbar}>
          <div style={{ ...s.topbarTitle, flex: 1 }}>{view === 'library' ? 'Øvelsesbibliotek' : view === 'calendar' ? 'Kalender' : view === 'inbox' ? 'Coach Briefing' : view === 'list' ? (isMobile ? 'Entropi Coach' : 'Atleter') : a?.name}</div>
          {onPreviewAthlete && !isMobile && (
            <button
              onClick={goToMyProfile}
              title="Min træning — hop til din egen profil (tast M)"
              style={{ ...s.btnPrimary, fontSize: '0.55rem', padding: '0.4rem 0.8rem', whiteSpace: 'nowrap' }}
            >⚡ Min træning</button>
          )}
        </div>

        {/* Mobil bundnavigation — erstatter hamburger-menuen som primær navigation.
            Samme mønster som atlet-appen: 4 faste punkter, guld = aktiv.
            "Menu" åbner sidebaren (atleter, eksport, VideoCoach, log ud). */}
        {isMobile && (
          <nav style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 150,
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
            background: '#171713', borderTop: '1px solid rgba(237,234,226,0.09)',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          }}>
            {[
              {
                key: 'list', label: 'Forside', active: view === 'list' && !selectedAthlete,
                onClick: () => { setView('list'); setSelectedAthlete(null); setSidebarOpen(false); setMenuSheetOpen(false) },
                icon: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></>,
              },
              {
                key: 'inbox', label: 'Coach Briefing', active: view === 'inbox',
                onClick: () => { setView('inbox'); setSelectedAthlete(null); setSidebarOpen(false); setMenuSheetOpen(false) },
                icon: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
              },
              {
                key: 'mine', label: 'Min træning', active: false,
                onClick: () => { setSidebarOpen(false); setMenuSheetOpen(false); goToMyProfile() },
                icon: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
              },
              {
                key: 'menu', label: 'Menu', active: menuSheetOpen,
                onClick: () => { setSheetPreviewPick(false); setMenuSheetOpen(o => !o) },
                icon: <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>,
              },
            ].map(item => {
              const priorityCount = item.key === 'inbox' ? coachPriorityCount : 0
              return (
                <button
                  key={item.key}
                  onClick={item.onClick}
                  style={{
                    position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', gap: '0.25rem', padding: '0.55rem 0 0.5rem',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: item.active ? '#c8923a' : '#7a7770',
                  }}
                >
                  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{item.icon}</svg>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.44rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{item.label}</span>
                  {priorityCount > 0 && (
                    <span style={{ position: 'absolute', top: '0.3rem', right: 'calc(50% - 1.15rem)', background: '#c8923a', color: '#141410', borderRadius: '999px', fontSize: '0.44rem', minWidth: '0.85rem', height: '0.85rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, padding: '0 0.15rem', fontFamily: "'IBM Plex Mono', monospace" }}>{priorityCount}</span>
                  )}
                </button>
              )
            })}
          </nav>
        )}

        {/* Mobil menu-ark: sekundære handlinger i et bund-ark i stedet for
            desktop-sidebaren presset ind fra siden. */}
        {isMobile && menuSheetOpen && (
          <>
            <div onClick={() => setMenuSheetOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 205 }} />
            <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 210, background: '#1c1c18', borderTop: '1px solid rgba(237,234,226,0.12)', borderRadius: '14px 14px 0 0', padding: '0.85rem 1rem calc(1.1rem + env(safe-area-inset-bottom, 0px))' }}>
              <div style={{ width: 36, height: 4, background: 'rgba(237,234,226,0.2)', borderRadius: 2, margin: '0 auto 0.8rem' }} />
              {sheetPreviewPick ? (
                <>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#c8923a', marginBottom: '0.6rem' }}>Se som atlet</div>
                  <div style={{ maxHeight: '40vh', overflowY: 'auto' }}>
                    {athletes.map(a2 => (
                      <div key={a2.id}
                        onClick={() => {
                          setMenuSheetOpen(false); setSheetPreviewPick(false)
                          if (pickingMine) { localStorage.setItem('entropi_my_athlete_id', a2.id); setMyAthleteId(a2.id); setPickingMine(false) }
                          onPreviewAthlete && onPreviewAthlete(a2.id)
                        }}
                        style={{ padding: '0.65rem 0.25rem', fontSize: '0.9rem', color: '#b8b4a8', cursor: 'pointer', borderBottom: '1px solid rgba(237,234,226,0.05)' }}
                      >{a2.name}</div>
                    ))}
                  </div>
                  <button onClick={() => setSheetPreviewPick(false)} style={{ ...s.btnGhost, marginTop: '0.75rem', width: '100%' }}>← Tilbage</button>
                </>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    {[
                      { label: 'Kalender', onClick: () => { setMenuSheetOpen(false); setSelectedAthlete(null); setView('calendar') }, icon: <><rect x="3" y="5" width="18" height="16" rx="2" /><line x1="3" y1="10" x2="21" y2="10" /><line x1="8" y1="3" x2="8" y2="7" /><line x1="16" y1="3" x2="16" y2="7" /></> },
                      { label: 'Bibliotek', onClick: () => { setMenuSheetOpen(false); setSelectedAthlete(null); setView('library') }, icon: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></> },
                      { label: 'VideoCoach', onClick: () => { setMenuSheetOpen(false); openVideoCoachV3() }, icon: <><rect x="2" y="6" width="13" height="12" rx="2" /><path d="M15 10.5 22 7v10l-7-3.5" /></> },
                      { label: 'Se som atlet', onClick: () => setSheetPreviewPick(true), icon: <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></> },
                    ].map(m => (
                      <button key={m.label} onClick={m.onClick}
                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem', padding: '0.8rem 0.5rem', background: '#16150f', border: '1px solid rgba(237,234,226,0.1)', borderRadius: 8, cursor: 'pointer', color: '#b8b4a8' }}>
                        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{m.icon}</svg>
                        <span style={{ fontSize: '0.72rem' }}>{m.label}</span>
                      </button>
                    ))}
                  </div>
                  <div style={{ borderTop: '1px solid rgba(237,234,226,0.07)', paddingTop: '0.6rem', display: 'flex', flexDirection: 'column' }}>
                    <button onClick={() => { setMenuSheetOpen(false); setShowAddModal(true) }} style={{ background: 'none', border: 'none', textAlign: 'left', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#b8b4a8', padding: '0.55rem 0.25rem', cursor: 'pointer' }}>+ Tilføj atlet</button>
                    <button onClick={exportTraeningsdata} disabled={exportingTraening} style={{ background: 'none', border: 'none', textAlign: 'left', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7a7770', padding: '0.55rem 0.25rem', cursor: 'pointer' }}>{exportingTraening ? '...' : '↓ Træningsdata'}</button>
                    <button onClick={exportBackup} disabled={exportingBackup} style={{ background: 'none', border: 'none', textAlign: 'left', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7a7770', padding: '0.55rem 0.25rem', cursor: 'pointer' }}>{exportingBackup ? '...' : '↓ Sikkerhedskopi'}</button>
                    <button onClick={() => signOutHard()} style={{ background: 'none', border: 'none', textAlign: 'left', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7a7770', padding: '0.55rem 0.25rem', cursor: 'pointer' }}>Log ud</button>
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {/* INDBAKKE — samlet beskedoverblik på tværs af atleter */}
        {view === 'inbox' && (
          <LazyBoundary
            factory={indbakkeFactory} label="Indbakke" loading={<div style={{ ...s.page }}>Indlæser…</div>}
            componentProps={{
              athletes, coachPriorityItems, handleTrainingSignal,
              automationAlertActionError, automationAlertUpdatingId, automationAlertsError, handleAutomationAlert,
              hiddenAthleteIds, inboxRefreshing, inboxRefreshStatus,
              isMobile, latestByTrack, messageInboxError,
              openCoachPriorityItem, openProfile, refreshCoachInbox,
              setCoachMsgTrack, trainingSignalsError,
              trainingSignalUpdatingKey, unreadByTrack, videoReviewQueueError,
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
            <KalenderView {...{
              askConfirm, athleteCurrentWeek, athleteLastLogs, athletes, blockPlan, blockSequenceRows,
              calBlockAthlete, calendarWeeks, createCalendarWeek, generateWeeksFromPlan, hiddenAthleteIds, hoverCell,
              isMobile, openCalBlockBuilder, openPlanReview, openProfile, planStartDate, setBlockStartDate,
              setCalBlockAthlete, setHoverCell, setPlanStartDate, setTimelineEdit, showFlash, snoozeAthlete,
              snoozedAthletes, timelineEdit,
            }} />
          )
        })()}

        {view === 'list' && (() => {
          return (
            <ForsideView {...{
              athleteCurrentWeek, athleteLastLogs, athletes, athleteSortMode, athleteWeekCompletion, athleteWeekSummary,
              automationAlertsError, calendarWeeks, coachBriefingSeen, coachBriefingSeenSavingKey, coachPriorityCount, coachPriorityItems,
              fetchAthletes, goToMyProfile, handleCoachBriefingSeen, handleTrainingSignal, hiddenAthleteIds, isMobile,
              loadError, loading, messageInboxError, openCoachPriorityItem, openProfile, openVideoCoachV3,
              setAthleteSortMode, setHiddenAthleteIds, setLoading, setSelectedAthlete, setShowAllAthletes, setShowHiddenAthletes,
              setView, showAllAthletes, showHiddenAthletes, trainingSignalsError, trainingSignalUpdatingKey, unreadCounts,
              videoMeasurementByAthlete, videoReviewQueueError,
            }} />
          )
        })()}

        {/* Den tidligere forside bevares midlertidigt som lokal rollback under testen. */}
        {/* PROFILE VIEW */}
        {view === 'profile' && a && (
          <div style={{ ...s.page, ...(isMobile ? { padding: '1rem' } : {}) }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '1.75rem' }}>
              <button onClick={() => setView(profileReturnView)} style={{ background: 'none', border: 'none', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7a7770', cursor: 'pointer', padding: 0 }}>
                ← Tilbage til {profileReturnView === 'inbox' ? 'indbakken' : 'atleter'}
              </button>
              {priorityQueueContext && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <span style={{ color: priorityQueueContext.state === 'complete' ? '#6cba6c' : '#7a7770', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                    {priorityQueueContext.state === 'complete'
                      ? 'Køen er ryddet ✓'
                      : priorityQueueContext.state === 'last'
                        ? 'Sidste opgave'
                        : `${priorityQueueContext.remainingCount} tilbage${priorityQueueContext.currentOpen ? ' efter denne' : ''}`}
                  </span>
                  {nextPriorityItem && (
                    <button onClick={() => openCoachPriorityItem(nextPriorityItem, 'inbox')}
                      style={{ ...s.btnGhost, minHeight: 36, padding: '0.35rem 0.6rem', fontSize: '0.46rem', flexShrink: 0 }}>
                      Næste opgave →
                    </button>
                  )}
                </div>
              )}
            </div>

            {profilePriorityContext && (
              <div style={{ ...s.card, marginBottom: '1rem', padding: '0.75rem 0.85rem', borderColor: `${profilePriorityContext.color}38`, background: `${profilePriorityContext.color}08` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.35rem' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: profilePriorityContext.color, boxShadow: `0 0 0 3px ${profilePriorityContext.color}16` }} />
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.45rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7a7770' }}>Aktuel opgave</span>
                  <span style={{ color: profilePriorityContext.color, border: `1px solid ${profilePriorityContext.color}44`, padding: '0.08rem 0.3rem', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.4rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{profilePriorityContext.label}</span>
                </div>
                <div style={{ color: '#d8d4ca', fontSize: '0.72rem', lineHeight: 1.45 }}>{profilePriorityContext.summary}</div>
                {profilePriorityContext.detail && <div style={{ color: '#7a7770', fontSize: '0.64rem', lineHeight: 1.45, marginTop: '0.22rem' }}>{profilePriorityContext.detail}</div>}
              </div>
            )}

            <div style={{ ...s.card, display: isMobile ? 'flex' : 'grid', gridTemplateColumns: isMobile ? undefined : 'auto 1fr auto', alignItems: 'center', gap: isMobile ? '0.85rem' : '1.5rem', marginBottom: '1.5rem', ...(isMobile ? { flexWrap: 'wrap', padding: '0.85rem 1rem' } : {}) }}>
              <div style={{ ...s.avatar, width: isMobile ? '44px' : '56px', height: isMobile ? '44px' : '56px', fontSize: isMobile ? '1rem' : '1.3rem', flexShrink: 0 }}>{initials(a.name)}</div>
              <div style={isMobile ? { flex: 1, minWidth: 0 } : undefined}>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: isMobile ? '1.2rem' : '1.5rem', fontWeight: 400, color: '#edeae2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: isMobile ? 'nowrap' : 'normal' }}>{a.name}</div>
                {!isMobile && <div style={{ fontSize: '0.8rem', color: '#7a7770', marginTop: '0.2rem' }}>{a.email}{a.age ? ' · ' + a.age + ' år' : ''}</div>}
                {/* Det lange atlet-ID er skjult på mobil — det bruges kun til scripts på desktop */}
                {!isMobile && <div
                  onClick={() => { navigator.clipboard?.writeText(a.id); showFlash('Atlet-ID kopieret') }}
                  title="Klik for at kopiere — bruges som athleteId i cowork-scripts"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.04em', color: '#4a4844', marginTop: '0.3rem', cursor: 'pointer', wordBreak: 'break-all' }}
                >
                  <span>ID: {a.id}</span>
                  <span style={{ color: '#7a7770' }}>⧉</span>
                </div>}
                {(() => {
                  const ls = formatLastSeen(profilesLastSeen[a.user_id])
                  if (!ls) return null
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.3rem' }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: ls.dotColor, flexShrink: 0 }} />
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.07em', color: ls.dotColor }}>{ls.text}</span>
                    </div>
                  )
                })()}
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <span style={s.badge(a.status)}>{statusLabels[a.status]}</span>
                <button style={s.btnDanger} onClick={() => setShowDeleteModal(true)}>Fjern</button>
              </div>
            </div>

            {/* Sektions-navigation: de sektioner man bruger dagligt står som
                tydelige TEKST-faner; resten ligger i en "Mere"-menu. Erstatter den
                gamle ikon-kun-bar, hvor man ikke kunne se hvad hver knap var. */}
            {(() => {
              const navItems = [{ key: 'hub', label: 'Hjem' }, ...HUB_SECTIONS]
              const EMOJI = { hub: '🏠', oversigt: '📊', kost: '🍽️', program: '🏋️', log: '📓', analyse: '📈', opvarmning: '🔥', stævne: '🏆', noter: '🗒️', beskeder: '💬' }
              const PRIMARY = ['hub', 'program', 'log', 'beskeder']
              const primary = PRIMARY.map(k => navItems.find(n => n.key === k)).filter(Boolean)
              const more = navItems.filter(n => !PRIMARY.includes(n.key))
              const activeInMore = more.some(n => n.key === activeTab)
              const activeMoreLabel = more.find(n => n.key === activeTab)?.label
              const go = (key) => { setActiveTab(key); setEditing(null); setNavMenuOpen(false) }
              const tabBtn = (active) => ({
                position: 'relative', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem',
                fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase',
                padding: isMobile ? '0.6rem 0.7rem' : '0.65rem 1.1rem', cursor: 'pointer',
                color: active ? '#c8923a' : '#7a7770', background: 'none', border: 'none',
                borderBottom: active ? '2px solid #c8923a' : '2px solid transparent',
                marginBottom: '-1px', whiteSpace: 'nowrap',
              })
              return (
                <div style={{ marginBottom: '1.5rem', position: 'relative' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.1rem', borderBottom: '1px solid rgba(237,234,226,0.07)' }}>
                    {primary.map(n => {
                      const active = activeTab === n.key
                      return (
                        <button
                          key={n.key}
                          onClick={() => go(n.key)}
                          style={tabBtn(active)}
                          onMouseEnter={e => { if (!active) e.currentTarget.style.color = '#b8b4a8' }}
                          onMouseLeave={e => { if (!active) e.currentTarget.style.color = '#7a7770' }}
                        >
                          <span style={{ marginRight: '0.35rem' }}>{EMOJI[n.key]}</span>{n.label}
                          {n.key === 'beskeder' && unreadCounts[a.id] > 0 && (
                            <span style={{ position: 'absolute', top: '0.15rem', right: '0.05rem', background: '#c8923a', color: '#141410', borderRadius: '999px', fontSize: '0.45rem', minWidth: '0.85rem', height: '0.85rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, padding: '0 0.15rem' }}>{unreadCounts[a.id]}</span>
                          )}
                        </button>
                      )
                    })}
                    <button
                      onClick={() => setNavMenuOpen(o => !o)}
                      style={{ ...tabBtn(activeInMore), display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                      onMouseEnter={e => { if (!activeInMore) e.currentTarget.style.color = '#b8b4a8' }}
                      onMouseLeave={e => { if (!activeInMore) e.currentTarget.style.color = '#7a7770' }}
                    >
                      {activeInMore ? <><span style={{ marginRight: '0.35rem' }}>{EMOJI[activeTab]}</span>{activeMoreLabel}</> : 'Mere'}
                      <span style={{ fontSize: '0.5rem', transform: navMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>▾</span>
                    </button>
                  </div>

                  {navMenuOpen && (
                    <>
                      {/* usynligt lag: klik udenfor lukker menuen */}
                      <div onClick={() => setNavMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                      <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: '0.25rem', zIndex: 41, background: '#1c1c18', border: '1px solid rgba(237,234,226,0.13)', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', minWidth: '11rem', padding: '0.3rem 0' }}>
                        {more.map(n => {
                          const active = activeTab === n.key
                          return (
                            <button
                              key={n.key}
                              onClick={() => go(n.key)}
                              style={{ display: 'block', width: '100%', textAlign: 'left', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0.6rem 1rem', cursor: 'pointer', background: active ? 'rgba(200,146,58,0.1)' : 'none', border: 'none', borderLeft: active ? '2px solid #c8923a' : '2px solid transparent', color: active ? '#c8923a' : '#b8b4a8' }}
                              onMouseEnter={e => { e.currentTarget.style.color = '#edeae2' }}
                              onMouseLeave={e => { e.currentTarget.style.color = active ? '#c8923a' : '#b8b4a8' }}
                            >
                              <span style={{ display: 'inline-block', width: '1.5rem' }}>{EMOJI[n.key]}</span>{n.label}
                            </button>
                          )
                        })}
                      </div>
                    </>
                  )}
                </div>
              )
            })()}

            {/* TAB: HUB — coach-landingsside med status + sektionsnavigation */}
            {activeTab === 'hub' && (() => {
              return (
                <HubTab {...{
                  a, athleteReadiness, isMobile, setActiveTab, setEditing, unreadCounts,
                  videoAnalyses, weeklyActivity,
                }} />
              )
            })()}

            {/* TAB: ANALYSE */}
            {activeTab === 'analyse' && (
              <LazyBoundary
                factory={analyseTabFactory} label="Analyse" loading={<div style={s.page}>Indlæser…</div>}
                componentProps={{
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
              <OversigtTab {...{
                a, athleteLogs, athleteReadiness, currentWeight, editData, editing,
                isMobile, openMeetResult, profilesLastSeen, saveEdit, saving, session,
                setActiveTab, setEditData, setEditing, startEdit, total, trainingTotal,
                volumenKortFactory, weeks, weightTrend,
              }} />
            )}

            {/* TAB: KOST */}
            {activeTab === 'kost' && (
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
                  addExercise, addingExercise, addingSession,
                  addingWeek, addSession, addWeek,
                  applyPeriodizationSuggestion, applyWeekDateFill, approveDraftProgressionState,
                  approvingProgression, assignEdits, athleteLogs, bestLog,
                  blockPlan, copyExerciseToSession, copyingExercise,
                  copyingSession, copySessionToWeek, copyWeek, deleteExercise,
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
                  athleteLogs, logExerciseFilter, openLogWeeks, setLogExerciseFilter, setOpenLogWeeks,
                }} />
              )
            })()}

            {/* TAB: NOTER */}
            {activeTab === 'stævne' && (() => {
              return (
                <StaevneTab {...{
                  a, athletePRs, deleteMeetResult, meetPlan, meetPlanForm, meetResults,
                  openMeetResult, saveMeetPlan, savingMeetPlan, setMeetPlan, setMeetPlanForm,
                }} />
              )
            })()}

            {activeTab === 'noter' && (
              <NoterTab {...{
                a, editData, editing, saveEdit, saving, setEditData,
                setEditing, startEdit,
              }} />
            )}

            {/* TAB: BESKEDER */}
            {activeTab === 'beskeder' && (() => {
              return (
                <BeskederTab {...{
                  a, coachMsgTrack, fetchMessages, formatMsgTime, messageInput, messages,
                  messageSendError, messageThreadError, sendCoachMessage, sendingMessage, setCoachMsgTrack, setMessageInput,
                  setMessageSendError, togglePin,
                }} />
              )
            })()}
          </div>
        )}
      </main>

      {videoAnalysisReview && (() => {
        return (
          <VideoReviewModal {...{
            closeVideoAnalysisReview, discardVideoAnalysisFeedback, isMobile, reviewVideoAnalysis, saveVideoAnalysisFeedback, selectedAthlete,
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
