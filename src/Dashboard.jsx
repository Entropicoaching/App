import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'
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
import { WEEKDAYS_SHORT } from './dashboard/coachKonstanter'
import { coachVideoPriorityDetail } from './dashboard/coachVideoHjaelp'
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
import Overlays from './dashboard/Overlays'
import Sidebar from './dashboard/Sidebar'
import MobilNav from './dashboard/MobilNav'
import ProfilHoved from './dashboard/ProfilHoved'





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
      <Overlays {...{
        confirmDialog, flash, isMobile, setConfirmDialog, videoCoachFrameRef, videoCoachOpen,
      }} />
      <Sidebar {...{
        athletes, athleteWeekSummary, coachPriorityCount, exportBackup, exportingBackup, exportingTraening,
        exportTraeningsdata, goToMyProfile, hiddenAthleteIds, isMobile, lastBackup, onPreviewAthlete,
        openProfile, openVideoCoachV3, pickingMine, previewPickerOpen, selectedAthlete, setMyAthleteId,
        setPickingMine, setPreviewPickerOpen, setSelectedAthlete, setSidebarMoreOpen, setSidebarOpen, setView,
        sidebarMoreOpen, sidebarOpen, todayData, unreadCounts, view,
      }} />

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

        <MobilNav {...{
          athletes, coachPriorityCount, exportBackup, exportingBackup, exportingTraening, exportTraeningsdata,
          goToMyProfile, isMobile, menuSheetOpen, onPreviewAthlete, openVideoCoachV3, pickingMine,
          selectedAthlete, setMenuSheetOpen, setMyAthleteId, setPickingMine, setSelectedAthlete, setSheetPreviewPick,
          setShowAddModal, setSidebarOpen, setView, sheetPreviewPick, view,
        }} />

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
            <ProfilHoved {...{
              a, activeTab, isMobile, navMenuOpen, nextPriorityItem, openCoachPriorityItem,
              priorityQueueContext, profilePriorityContext, profileReturnView, profilesLastSeen, setActiveTab, setEditing,
              setNavMenuOpen, setShowDeleteModal, setView, showFlash, unreadCounts,
            }} />

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
