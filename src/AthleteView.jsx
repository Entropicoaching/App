import { useState, useEffect, useRef } from 'react'
import { supabase, signOutHard, createAbortableUploadClient } from './supabase'
import { sanitizeVideoCoachFeedbackEvidence } from './videoCoachFeedbackEvidence'
import { loadReadinessDraft, saveReadinessDraft, clearReadinessDraft, isEmptyReadinessDraft } from './readinessDraft'
import { recordSilentFail, attachPendingSilentFails, clearPendingSilentFails, markUploadInflight,
  clearUploadInflight, takeStaleUploadInflight } from './athleteSilentFailLog'
import { remainingSeconds } from './restTimer'
import { countOfflineSets } from './offlineSetQueue'
import { calcWarmupSets } from './warmup'
import { applyWarmupCorrection, saveWarmupOverride, suggestWarmupOverride } from './warmupOverride'
import { flushVideoCoachDraftQueue, isRetryableVideoCoachError,
  queueVideoCoachDraft, saveVideoCoachDraft } from './videoCoachSubmission'
import { buildAwaitingAnalysisRow, buildVideoUploadPath, validateVideoUploadRequest,
  videoUploadAlreadyExistsError, VIDEOCOACH_UPLOAD_BUCKET } from './videoCoachUpload'
import LazyBoundary from './LazyBoundary'
import { s, today } from './athleteShared'
import { ATHLETE_VIDEOCOACH_PREFIX, ATHLETE_VIDEOCOACH_QUEUE_CHANGED,
  validateAthleteVideoCoachRow } from './athlete/videoCoachBro'
import { computeActiveWeekIdx, weekStartDate, fmtWeekRange,
  WEEKDAYS_LONG, parsePlannedRpe, logFrontendError } from './athlete/ugeHjaelp'
import { NAV_ITEMS } from './athlete/NavItems'
import HjemTab from './athlete/HjemTab'
import OnboardingGuide from './athlete/OnboardingGuide'
import Ramme from './athlete/Ramme'
import { lavSaetSkrivning } from './athlete/saetSkrivning'
import { lavLaesninger } from './athlete/laesninger'
import { lavBeskederOgVaegt } from './athlete/beskederOgVaegt'
import { lavKostHandlinger } from './athlete/kostHandlinger'

// Indlæses via LazyBoundary (ordre 232 · commit 2), samme mønster som Dashboard.jsx's fire faner.
const mobiliseringFactory = () => import('./athlete/MobiliseringTab')
const staevnedagFactory = () => import('./athlete/StaevnedagTab')
const programFactory = () => import('./athlete/ProgramTab')
// ORDRE 259 · commit 1: samme lazy-chunk-mønster, ny fane.
const volumenFactory = () => import('./athlete/VolumenTab')
// ORDRE 284 · commit 1: samme lazy-chunk-mønster, ny fane.
const fremgangFactory = () => import('./athlete/FremgangTab')
const kostFactory = () => import('./athlete/KostTab')
const beskederFactory = () => import('./athlete/BeskederTab')

export default function AthleteView({ session, onExitPreview, role, coachAthleteId, onRecheckRole }) {
  const [tab, setTab] = useState('hjem')
  const [recheckingRole, setRecheckingRole] = useState(false)
  const [recheckMsg, setRecheckMsg] = useState('')
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  // Undgår setState efter unmount: lykkes genopslaget og rollen bliver
  // 'coach', skifter App.jsx denne gren ud med Dashboard FØR onRecheckRole's
  // promise resolver — komponentet er da allerede væk.
  const mountedRef = useRef(true)
  useEffect(() => () => { mountedRef.current = false }, [])
  async function handleRecheckRole() {
    setRecheckingRole(true); setRecheckMsg('')
    await onRecheckRole?.()
    if (!mountedRef.current) return
    setRecheckingRole(false)
    setRecheckMsg('Din konto er registreret som atlet — ingen coach-adgang fundet.')
  }
  const [athlete, setAthlete] = useState(null)
  // ORDRE 263 · commit 2: den automatiske pause mellem sæt (null = ingen
  // aktiv pause). Se restPause.js.
  const [restPause, setRestPause] = useState(null)
  // ORDRE 280 · commit 4: antal sæt der ligger lokalt og venter på net (se
  // offlineSetQueue.js). Kun til "Dagens pas"-kortets linje — Program-fanens
  // Log-knap er urørt.
  const [pendingSyncCount, setPendingSyncCount] = useState(0)
  const athleteVideoCoachRef = useRef(null)
  const athleteVideoCoachFrameRef = useRef(null)
  const athleteVideoCoachClientsRef = useRef(new Set())
  // ORDRE 61 · commit 2: aktive upload-and-go-forsøg, keyet på requestId, så
  // en abort-upload-besked fra VideoCoach kan afbryde netop DEN overførsel.
  const athleteVideoUploadAbortsRef = useRef(new Map())
  const [athleteVideoCoachOpen, setAthleteVideoCoachOpen] = useState(false)
  // ORDRE 262 · commit 1: "Film et sæt" åbner det SAMME VideoCoach-værktøj,
  // men i et instant-flow (?instant=1) der ikke autosender - se videocoach.html.
  const [athleteVideoCoachInstant, setAthleteVideoCoachInstant] = useState(false)
  const [sharedVideoAnalyses, setSharedVideoAnalyses] = useState([])
  const [sharedVideoLoading, setSharedVideoLoading] = useState(false)
  const [sharedVideoError, setSharedVideoError] = useState(null)
  const [openSharedVideoId, setOpenSharedVideoId] = useState(null)
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  // G1: skelner "programmet er tomt" fra "programmet kunne ikke hentes", så
  // en fejlet fetchProgram ikke viser samme skærm som en atlet uden program.
  const [programError, setProgramError] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [selectedFood, setSelectedFood] = useState(null)
  // Rå streng (ikke number) så feltet kan ryddes/skrives frit — fx "0" eller
  // midlertidigt tomt — uden at snappe tilbage til 0. Parses hvor der regnes.
  const [amount, setAmount] = useState('100')
  const [unitIdx, setUnitIdx] = useState(0)
  const [customFoods, setCustomFoods] = useState([])
  const [showCreateFood, setShowCreateFood] = useState(false)
  const [createFood, setCreateFood] = useState({ name: '', kcal100: '', protein100: '', carb100: '', fat100: '', unit_label: '', unit_grams: '' })
  const [shareFood, setShareFood] = useState(true)
  const [mealTemplates, setMealTemplates] = useState([])
  const [showTemplates, setShowTemplates] = useState(false)
  const [showSaveTemplate, setShowSaveTemplate] = useState(false)
  const [templateNameInput, setTemplateNameInput] = useState('')
  const [historicalMealLogs, setHistoricalMealLogs] = useState([])
  const [frequentFoods, setFrequentFoods] = useState([])
  const [kostDate, setKostDate] = useState(today())
  const [showTdee, setShowTdee] = useState(false)
  const [editingLogId, setEditingLogId] = useState(null)
  const [editGrams, setEditGrams] = useState('')
  const [editMacros, setEditMacros] = useState({ kcal: '', protein: '', carb: '', fat: '' })

  // Messages state
  const [messages, setMessages] = useState([])
  const [unreadMsgCount, setUnreadMsgCount] = useState(0)
  const [messageInput, setMessageInput] = useState('')
  const [msgTrack, setMsgTrack] = useState('besked')  // 'teknik' | 'besked' — to spor, ét sted

  // Program state
  const [currentWeek, setCurrentWeek] = useState(null)
  const [allWeeks, setAllWeeks] = useState([])
  const [viewingWeekIdx, setViewingWeekIdx] = useState(0)
  const [pastLogs, setPastLogs] = useState([])
  const [progOpenSession, setProgOpenSession] = useState(null)
  const [exerciseLogs, setExerciseLogs] = useState([])
  const [prs, setPrs] = useState([]) // atletens egne rekorder (personal_records)
  const [prsError, setPrsError] = useState(false) // se fetchPRs — ordre 163 · del 3
  const [logInputs, setLogInputs] = useState({})
  const [lastLogByExerciseName, setLastLogByExerciseName] = useState({})
  const [exerciseHistory, setExerciseHistory] = useState({})
  // ORDRE 280 · commit 2 — Dagens pas' "Fortryd sidste sæt": kun det senest
  // loggede sæt FRA DEN KORT (ikke Program-fanen), og kun synligt så længe
  // pas.next stadig peger på samme øvelse (se DagensPasCard).
  const [lastLoggedSet, setLastLoggedSet] = useState(null) // { exerciseId, setNumber }
  // ORDRE 259 · commit 1: atletens egen volumen pr. muskelgruppe-fane —
  // rå exercise_logs-rækker (kun feltet VolumenTab.jsx behøver), hentet når
  // fanen åbnes, se effekten ved fetchMeetPlan/fetchMeetResults nedenfor.
  const [volumeLogs, setVolumeLogs] = useState([])
  const [volumeLoading, setVolumeLoading] = useState(false)
  // ORDRE 268 · commit 2: "hele forløbet" i UgensStatusKort (Hjem) — lazy-
  // hentet først når atleten faktisk skifter til den visning (se
  // UgensStatusKort's onAabnForloeb), samme mønster som volumeLogs ovenfor.
  const [forloebLogs, setForloebLogs] = useState(null)
  const [forloebLoading, setForloebLoading] = useState(false)
  // ORDRE 284 · commit 1: al historik (ikke kun et par uger) til Fremgang-
  // fanens pr.-øvelse-kurver — lazy-hentet først når fanen åbnes, samme
  // mønster som volumeLogs/forloebLogs ovenfor.
  const [fremgangLogs, setFremgangLogs] = useState([])
  const [fremgangLoading, setFremgangLoading] = useState(false)
  const [weeklyTonnage, setWeeklyTonnage] = useState([])
  const [liftProgress, setLiftProgress] = useState([])
  const [weightLogs, setWeightLogs] = useState([])
  const [weightInput, setWeightInput] = useState('')
  const [savingWeight, setSavingWeight] = useState(false)

  // PR toast state
  const [prToast, setPrToast] = useState(null)
  const [prToastFading, setPrToastFading] = useState(false)
  const [setConfirm, setSetConfirm] = useState({})
  // Serialiseret skrivning pr. sæt-nøgle (exerciseId_setNumber). Hurtige gentagne
  // tryk på samme sæt (fx en vægtkorrektion mens den forrige skrivning stadig
  // kører) må hverken lave dubletter eller tabe den nyeste værdi: første skrivning
  // INSERT'er og fanger rækkens rigtige id, resten UPDATE'er samme række.
  const setWriteRef = useRef({}) // key -> { realId, chain }
  // Fortryd-toast (sletning) + beskeder auto-scroll
  const [undoToast, setUndoToast] = useState(null)
  const [undoPending, setUndoPending] = useState(false)
  const undoTimerRef = useRef(null)
  // Session-niveau skriv-tilstand ("<sessionId>:skip"|"autofill"|"feedback") — knapperne
  // deaktiveres og viser "..."/"Gemmer..." mens skrivningen afventer svar fra Supabase.
  const [pendingSessionAction, setPendingSessionAction] = useState(null)
  const messagesEndRef = useRef(null)
  const readinessCardRef = useRef(null)
  // ORDRE 330 · blok 2 — alt på forsiden der ikke skal bruges NU ligger bag
  // folden "Mere" (lukket fra start, ikke husket mellem besøg).
  const [mereOpen, setMereOpen] = useState(false)
  // Session-kort refs, så vi kan scrolle en nyåbnet session op i toppen
  // (accordion: når en session over kollapser, hopper layoutet ellers så man
  // lander midt/nederst i den nye session i stedet for ved første øvelse).
  const sessionRefs = useRef({})
  // In-app toast + bekræftelses-modal (erstatter native alert/confirm)
  const [flash, setFlash] = useState(null)
  const [confirmDialog, setConfirmDialog] = useState(null)
  const flashTimerRef = useRef(null)
  const [skipConfirmEx, setSkipConfirmEx] = useState(null)
  const [openRpePicker, setOpenRpePicker] = useState(null)

  // Session feedback state
  const [dismissedFeedback, setDismissedFeedback] = useState(new Set())
  const [feedbackInputs, setFeedbackInputs] = useState({})

  const [showRpeGuide, setShowRpeGuide] = useState(false)

  // Warmup state
  const [warmupTemplates, setWarmupTemplates] = useState([])
  const [warmupChecked, setWarmupChecked] = useState({})
  const [exWarmupExpanded, setExWarmupExpanded] = useState(new Set())
  const [exWarmupWeightOverride, setExWarmupWeightOverride] = useState({})
  const [exWarmupWeightEditing, setExWarmupWeightEditing] = useState(null)
  // Atletens rettelse af ét opvarmningssæts vægt (ordre 105, commit 2) —
  // `${exKey}_${index}` mens feltet redigeres. Selve rettelsen gemmes
  // straks i warmupOverride.js's storage; tick'et her tvinger et re-render,
  // så suggestWarmupOverride læses igen efter en gemt rettelse.
  const [warmupSetEditing, setWarmupSetEditing] = useState(null)
  const [warmupOverrideTick, setWarmupOverrideTick] = useState(0)
  const [warmupPhase, setWarmupPhase] = useState('focus')
  const [warmupFocus, setWarmupFocus] = useState(null)
  const [warmupSubtype, setWarmupSubtype] = useState(null)
  const [warmupProblems, setWarmupProblems] = useState(new Set())
  const [warmupExercises, setWarmupExercises] = useState([])
  const [warmupStep, setWarmupStep] = useState(0)
  // Valgt øvelses-option pr. slot i opvarmnings-guiden (slot-index → option-index).
  // Nulstilles ved hver guide-start, så default altid er den første variant.
  const [warmupChoice, setWarmupChoice] = useState({})
  const [timerSeconds, setTimerSeconds] = useState(0)
  const [timerActive, setTimerActive] = useState(false)
  const [timerDone, setTimerDone] = useState(false)
  // G5: { remainingAtStart, startedAt } for det aktive segment — læses kun
  // inde i effekten nedenfor, aldrig under selve renderet.
  const timerStartRef = useRef(null)

  // Mobilitet-hub state — fanen er en intent-landing (null) med tre døre
  const [mobilityMode, setMobilityMode] = useState(null) // null=landing | 'opvarmning' | 'mobilitet'

  // Mobilitets-session (on-demand: byg en session nu, ingen persistens/streak)
  const [mobilityPhase, setMobilityPhase] = useState('design')  // 'design' | 'guide' | 'done' (intake-porten droppet)
  const [mobilityIntake, setMobilityIntake] = useState({ time: 10, sitting: 'med', lifts: [], problems: [], soreAreas: [] })
  const [mobilitySlots, setMobilitySlots] = useState([])        // valgte øvelser: [{ area, choiceIdx }]
  const [mobilityStep, setMobilityStep] = useState(0)

  // Stævnedag state
  const [hasMeetPlan, setHasMeetPlan] = useState(false)
  const [meetType, setMeetType] = useState('sbd')
  const [meetPlanNotes, setMeetPlanNotes] = useState('')
  const [meetWarmupEditing, setMeetWarmupEditing] = useState(null)
  const [meetWarmupDraft, setMeetWarmupDraft] = useState([])
  const [meetWarmupOverrides, setMeetWarmupOverrides] = useState({})
  const [meetResults, setMeetResults] = useState([])
  const [meetAttempts, setMeetAttempts] = useState({
    squat:    [{ w: '', r: null }, { w: '', r: null }, { w: '', r: null }],
    bench:    [{ w: '', r: null }, { w: '', r: null }, { w: '', r: null }],
    deadlift: [{ w: '', r: null }, { w: '', r: null }, { w: '', r: null }],
  })

  // Onboarding — klik-guiden ved foerste login. onboardingDone kommer fra
  // athletes.onboarding_completed_at (server-side, pr. bruger). guideOpen lader
  // guiden genaabnes manuelt fra kontomenuen uden at paavirke den gemte tilstand.
  const [onboardingDone, setOnboardingDone] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const [guideStep, setGuideStep] = useState(0)

  // Readiness state
  const [readinessLog, setReadinessLog] = useState(null)
  const [lastReadiness, setLastReadiness] = useState(null) // seneste tidligere log → "samme som i går"
  const [readinessHistory, setReadinessHistory] = useState([]) // op til 14 forudgående dage → dagens svar + kurve (ORDRE 100)
  const [readinessInput, setReadinessInput] = useState({ sleep: '', energy: null, motivation: null, stress: null, soreness: null, soreZones: [] })
  const [savingReadiness, setSavingReadiness] = useState(false)
  const [readinessError, setReadinessError] = useState(null)
  // G12: parathedsudkastet skal overleve en lukket fane. restoredForAthleteRef
  // holder styr på hvilken atlet vi allerede har forsøgt at genindsætte et
  // udkast for, så gem-effekten nedenfor ikke rydder det udkast den lige har
  // hentet, før genindsættelsen har nået at slå igennem i state.
  const readinessDraftRestoredForRef = useRef(null)

  // G1: fælles fejlvisning for baggrundslæsninger (fetchPRs, fetchWeightLogs,
  // ...). Logger detaljen til frontend_errors og viser en oversat, ærlig
  // linje — samme sprog som skrivefejlene (showFlash, se athleteWriteGuard-
  // kaldene). Kalderen skal IKKE opdatere sin state når denne kaldes, så det
  // sidst kendte indhold forbliver på skærmen.
  function onReadError(label, athleteId) {
    return (error) => {
      logFrontendError(`${label} kunne ikke hentes`, error, athleteId)
      showFlash(`${label} kunne ikke hentes. Tjek din forbindelse og prøv igen.`, 'error')
    }
  }

  /* eslint-disable react-hooks/refs -- fabrikkerne får ref-objekterne med, men læser .current kun i hændelses- og effekt-callbacks, præcis som før ordre 373 */
  const {
    fetchWeightLogs, logWeight, fetchAthleteMessages, markTrackRead, sendAthleteMessage, formatMsgTime, renderSharedFeedbackCards,
  } = lavBeskederOgVaegt({
    athlete, messageInput, msgTrack, onReadError, openSharedVideoId, setMessageInput, setMessages, setOpenSharedVideoId,
    setSavingWeight, setSharedVideoAnalyses, setUnreadMsgCount, setWeightInput, setWeightLogs, sharedVideoAnalyses, showFlash, weightInput,
    weightLogs,
  })

  const {
    fetchLogs, fetchHistoricalMealLogs, fetchFrequentFoods, quickLogFood, fetchMealTemplates, copyYesterday, saveTemplate, logTemplate,
    deleteTemplate, fetchCustomFoods, onSearchInput, selectFood, addFromSearch, quickAddSearchFood, saveCustomFood, deleteLog,
    undoDelete, parseLoggedGrams, startEditLog, saveEditLog, totKcal, totProtein, totCarb, totFat,
    kcalPct, proteinPct, pKcal, cKcal, fKcal, macroTotal, circ, pLen,
    cLen, fLen, tdeeEstimate,
  } = lavKostHandlinger({
    amount, athlete, createFood, customFoods, editGrams, editMacros, historicalMealLogs, kostDate,
    logs, onReadError, selectedFood, setAmount, setCreateFood, setCustomFoods, setEditGrams, setEditMacros,
    setEditingLogId, setFrequentFoods, setHistoricalMealLogs, setLogs, setMealTemplates, setSearchQuery, setSearchResults, setSelectedFood,
    setShowCreateFood, setShowSaveTemplate, setShowTemplates, setTemplateNameInput, setUndoPending, setUndoToast, setUnitIdx, shareFood,
    showFlash, templateNameInput, undoPending, undoTimerRef, undoToast, unitIdx, weightLogs,
  })

  const {
    fetchAthlete, fetchSharedVideoAnalyses, fetchMeetPlan, fetchVolumeLogs, fetchFremgangLogs, fetchForloebLogs, fetchMeetResults, suggestNextWeight,
    saveReadiness, fetchProgram, openSession, openReadiness, completeOnboardingGuide, advanceOnboardingGuide, restartOnboardingGuide, fetchPastLogs,
    fetchExerciseLogs,
  } = lavLaesninger({
    athlete, coachAthleteId, currentWeek, exerciseHistory, fetchAthleteMessages, fetchCustomFoods, fetchFrequentFoods, fetchHistoricalMealLogs,
    fetchLogs, fetchMealTemplates, fetchWeightLogs, guideStep, mountedRef, onReadError, readinessCardRef, readinessInput,
    role, session, sessionRefs, setAllWeeks, setAthlete, setCurrentWeek, setExerciseHistory, setExerciseLogs,
    setForloebLoading, setForloebLogs, setFremgangLoading, setFremgangLogs, setGuideOpen, setGuideStep, setHasMeetPlan, setLastLogByExerciseName,
    setLastReadiness, setLiftProgress, setLoadError, setLoading, setLogInputs, setMeetAttempts, setMeetPlanNotes, setMeetResults,
    setMeetType, setMereOpen, setOnboardingDone, setOpenSharedVideoId, setPastLogs, setProgOpenSession, setProgramError, setPrs,
    setPrsError, setReadinessError, setReadinessHistory, setReadinessLog, setRestPause, setSavingReadiness, setSharedVideoAnalyses, setSharedVideoError,
    setSharedVideoLoading, setTab, setViewingWeekIdx, setVolumeLoading, setVolumeLogs, setWarmupTemplates, setWeeklyTonnage,
  })

  const {
    logSet, logDagensPasSet, flushOfflineSets, undoLoggedSet, updateLoggedSet, skipSet, skipExercise, unskipSet,
    saveFeedback, autoCompleteSession, skipRemainingSets,
  } = lavSaetSkrivning({
    allWeeks, athlete, currentWeek, exerciseLogs, feedbackInputs, fetchExerciseLogs, fetchPastLogs, lastLogByExerciseName,
    logInputs, setAllWeeks, setExerciseLogs, setLastLoggedSet, setLogInputs, setPendingSessionAction, setPendingSyncCount, setPrToast,
    setPrToastFading, setRestPause, setSetConfirm, setWriteRef, showFlash, viewingWeekIdx,
  })
  /* eslint-enable react-hooks/refs */

  function showFlash(message, kind = 'info') {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
    setFlash({ message, kind })
    flashTimerRef.current = setTimeout(() => setFlash(null), 3000)
  }

  function askConfirm(message, onConfirm) {
    setConfirmDialog({ message, onConfirm })
  }

  useEffect(() => {
    if (!athlete?.id) return
    if (readinessDraftRestoredForRef.current !== athlete.id) {
      readinessDraftRestoredForRef.current = athlete.id
      const draft = loadReadinessDraft(athlete.id, today())
      if (draft && !isEmptyReadinessDraft(draft)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- uændret fra før ordre 373; lint ser det først nu (se RAPPORT-373)
        setReadinessInput(draft)
        return
      }
    }
    if (isEmptyReadinessDraft(readinessInput)) clearReadinessDraft(athlete.id, today())
    else saveReadinessDraft(athlete.id, today(), readinessInput)
  }, [readinessInput, athlete?.id])

  // ORDRE 267 · commit 1 — "to minutter": det eneste felt appen reelt kan
  // udlede er "sandsynligvis som sidst" (atletens egen seneste log). Før
  // krævede det et eksplicit tryk på "↺ Samme som sidst"; nu forudfyldes
  // formularen automatisk, første gang lastReadiness er hentet — stadig frit
  // at rette hvert felt bagefter. Et påbegyndt, ikke-tomt udkast (draft-
  // effekten ovenfor) har forrang og forhindrer denne forudfyldning.
  const readinessPrefillDoneForRef = useRef(null)
  useEffect(() => {
    if (!athlete?.id || !lastReadiness) return
    if (readinessPrefillDoneForRef.current === athlete.id) return
    readinessPrefillDoneForRef.current = athlete.id
    if (!isEmptyReadinessDraft(readinessInput)) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- uændret fra før ordre 373; lint ser det først nu (se RAPPORT-373)
    setReadinessInput({
      sleep: lastReadiness.sleep_hours != null ? String(lastReadiness.sleep_hours) : '',
      energy: lastReadiness.energy ?? null,
      motivation: lastReadiness.motivation ?? null,
      stress: lastReadiness.stress ?? null,
      soreness: lastReadiness.soreness_level ?? null,
      soreZones: lastReadiness.sore_zones || [],
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- readinessInput bevidst ikke i deps, kun læst ved selve kaldet (samme mønster som draft-effekten ovenfor)
  }, [athlete?.id, lastReadiness])

  useEffect(() => {
    athleteVideoCoachRef.current = athlete
    if (!athlete?.id) return
    const config = { type: `${ATHLETE_VIDEOCOACH_PREFIX}:config`,
      athletes: [{ id: athlete.id, name: athlete.name }], selectedAthleteId: athlete.id,
      submissionMode: 'athlete' }
    for (const client of athleteVideoCoachClientsRef.current) {
      if (!client || client.closed) { athleteVideoCoachClientsRef.current.delete(client); continue }
      try { client.postMessage(config, window.location.origin) }
      catch { athleteVideoCoachClientsRef.current.delete(client) }
    }
  }, [athlete])

  useEffect(() => {
    const onAthleteVideoCoachMessage = async event => {
      if (event.origin !== window.location.origin || !event.source) return
      const message = event.data || {}
      const currentAthlete = athleteVideoCoachRef.current
      if (message.type === `${ATHLETE_VIDEOCOACH_PREFIX}:close`) {
        const frameWindow = athleteVideoCoachFrameRef.current?.contentWindow
        if (event.source !== frameWindow && !athleteVideoCoachClientsRef.current.has(event.source)) return
        athleteVideoCoachClientsRef.current.delete(event.source)
        setAthleteVideoCoachOpen(false)
        setAthleteVideoCoachInstant(false)
        return
      }
      if (message.type === `${ATHLETE_VIDEOCOACH_PREFIX}:ready`) {
        if (!currentAthlete?.id) return
        athleteVideoCoachClientsRef.current.add(event.source)
        event.source.postMessage({ type: `${ATHLETE_VIDEOCOACH_PREFIX}:config`,
          athletes: [{ id: currentAthlete.id, name: currentAthlete.name }],
          selectedAthleteId: currentAthlete.id, submissionMode: 'athlete' }, event.origin)
        window.dispatchEvent(new Event(ATHLETE_VIDEOCOACH_QUEUE_CHANGED))
        return
      }
      // ORDRE 61 · commit 2: atleten kan fortryde, mens filen stadig overføres.
      // Selve fetch-kaldet afbrydes (se upload-and-go nedenfor) - ikke bare
      // ventetiden - så en abort her giver ALDRIG en afventende række.
      if (message.type === `${ATHLETE_VIDEOCOACH_PREFIX}:abort-upload`) {
        const controller = athleteVideoUploadAbortsRef.current.get(message.requestId)
        if (controller) controller.abort()
        return
      }
      // ORDRE 57 · commit 1: "upload og gå" - atleten sender selve videoen,
      // ikke sporede tal. Kun appen har en autentificeret Supabase-klient
      // (VideoCoach har ingen), så både storage-uploaden og rækkens indsættelse
      // sker her. Filen rejser i selve beskeden (File/Blob er struktur-klonbar).
      if (message.type === `${ATHLETE_VIDEOCOACH_PREFIX}:upload-and-go`) {
        // G16 (ordre 131): reply() er det ENESTE sted der er sikret at køre for
        // ethvert bekræftet udfald (succes, fejl, annullering) - marker-oprydning
        // sker derfor her, ét sted, i stedet for ved hvert enkelt return nedenfor.
        const reply = result => {
          if (currentAthlete?.id) clearUploadInflight(currentAthlete.id)
          try { event.source.postMessage({ type: `${ATHLETE_VIDEOCOACH_PREFIX}:upload-result`,
            requestId: message.requestId, ...result }, event.origin); return true }
          catch { return false }
        }
        if (!athleteVideoCoachClientsRef.current.has(event.source) || !currentAthlete?.id) {
          reply({ ok: false, error: 'VideoCoach-forbindelsen er ikke registreret' })
          return
        }
        const file = message.file
        const requestError = validateVideoUploadRequest({
          athleteId: currentAthlete.id, clientAnalysisId: message.clientAnalysisId,
          lift: message.lift, variation: message.variation, mimeType: message.mimeType,
          fileSize: file?.size, loadKg: message.loadKg, rpe: message.rpe,
          athleteNote: message.athleteNote, plateCalibration: message.plateCalibration,
        })
        if (requestError || !(file instanceof Blob)) {
          reply({ ok: false, error: requestError || 'Ugyldig video' })
          return
        }
        const path = buildVideoUploadPath(currentAthlete.id, message.clientAnalysisId, message.mimeType)
        if (!path) { reply({ ok: false, error: 'Videoformatet kunne ikke gemmes' }); return }
        // ORDRE 61 · commit 2: supabase-js's storage.upload() tager ikke en
        // AbortSignal (ingen af FileOptions dækker det), så selve fetch-kaldet
        // skal afbrydes via klientens fetch-option i stedet - se
        // createAbortableUploadClient. En engangsklient her, ikke den delte
        // `supabase`, så en afbrudt upload aldrig kan afbryde andre samtidige kald.
        const controller = new AbortController()
        athleteVideoUploadAbortsRef.current.set(message.requestId, controller)
        // G16 (ordre 131): sat FØR selve overførslen, ryddet af reply() ovenfor
        // ved ethvert bekræftet udfald - se athleteSilentFailLog.js.
        markUploadInflight(currentAthlete.id, message.requestId)
        let upload
        try {
          upload = await createAbortableUploadClient(controller.signal).storage
            .from(VIDEOCOACH_UPLOAD_BUCKET)
            .upload(path, file, { contentType: message.mimeType, upsert: false })
        } finally {
          athleteVideoUploadAbortsRef.current.delete(message.requestId)
        }
        if (upload.error) {
          if (controller.signal.aborted) {
            reply({ ok: false, aborted: true, error: 'Annulleret · intet blev sendt' })
            return
          }
          if (!videoUploadAlreadyExistsError(upload.error)) {
            reply({ ok: false, error: `Video kunne ikke uploades: ${upload.error.message || 'ukendt fejl'}` })
            return
          }
        }
        const row = buildAwaitingAnalysisRow({
          athleteId: currentAthlete.id, athleteName: currentAthlete.name,
          clientAnalysisId: message.clientAnalysisId, lift: message.lift, variation: message.variation,
          loadKg: message.loadKg, rpe: message.rpe, athleteNote: message.athleteNote, videoPath: path,
          plateCalibration: message.plateCalibration,
        })
        // ORDRE 131 · commit 3: rid coachen med en videorække der reelt bliver
        // gemt - ventende stille-fejl-koder (G14/G15/G16) lægges kun ind her,
        // rydningen sker nedenfor FØRST når gemningen er bekræftet, så en
        // fejlet gemning ikke selv taber koderne.
        row.session_context = attachPendingSilentFails(row.session_context, currentAthlete.id)
        const saved = await saveVideoCoachDraft(supabase, row, { athleteSubmission: true })
        if (saved.error) {
          // Videoen er allerede lagt i bucket'en (idempotent sti pr. client_analysis_id) -
          // kun selve rækken mangler. Et nyt tryk på "Prøv at sende igen" er nok.
          reply({ ok: false, error: saved.error.message || 'Videoen blev uploadet, men analysen kunne ikke oprettes · prøv igen' })
          return
        }
        clearPendingSilentFails(currentAthlete.id)
        reply({ ok: true, data: { ...saved.data, duplicate: saved.duplicate } })
        window.dispatchEvent(new Event(ATHLETE_VIDEOCOACH_QUEUE_CHANGED))
        return
      }
      if (message.type !== `${ATHLETE_VIDEOCOACH_PREFIX}:save-draft`) return
      const reply = result => {
        try { event.source.postMessage({ type: `${ATHLETE_VIDEOCOACH_PREFIX}:save-result`,
          requestId: message.requestId, ...result }, event.origin); return true }
        catch { return false }
      }
      if (!athleteVideoCoachClientsRef.current.has(event.source) || !currentAthlete?.id) {
        reply({ ok: false, error: 'VideoCoach-forbindelsen er ikke registreret' })
        return
      }
      const validationError = validateAthleteVideoCoachRow(message.row, currentAthlete.id)
      if (validationError) { reply({ ok: false, error: validationError }); return }
      const safeRow = {
        ...message.row,
        athlete_id: currentAthlete.id,
        athlete_name: currentAthlete.name,
        source_mode: 'athlete_submission',
        status: 'draft',
        coach_note: null,
        bias_note: null,
        session_context: {
          training_session_id: null,
          program_item_id: null,
          coach_note_snapshot: null,
          baseline_snapshot: [],
          athlete_note: typeof message.row.session_context?.athlete_note === 'string'
            ? (message.row.session_context.athlete_note.trim().slice(0, 1000) || null)
            : null,
          feedback_evidence: sanitizeVideoCoachFeedbackEvidence(
            message.row.session_context?.feedback_evidence),
        },
      }
      // ORDRE 131 · commit 3: samme mønster som upload-and-go ovenfor - ventende
      // koder følger med i selve rækken (også hvis den ender i den lokale
      // retry-kø nedenfor), og ryddes kun ved en BEKRÆFTET gemning.
      safeRow.session_context = attachPendingSilentFails(safeRow.session_context, currentAthlete.id)
      const result = await saveVideoCoachDraft(supabase, safeRow, { athleteSubmission: true })
      if (result.error) {
        if (isRetryableVideoCoachError(result.error) &&
            queueVideoCoachDraft(safeRow, globalThis.localStorage, session.user.id)) {
          // Koderne er nu bagt ind i safeRow, som selve kø-funktionen persisterer
          // lokalt til senere automatisk afsendelse (flushVideoCoachDraftQueue) -
          // trygt at rydde den ADSKILTE ventekø her, de er ikke tabt.
          clearPendingSilentFails(currentAthlete.id)
          window.dispatchEvent(new Event(ATHLETE_VIDEOCOACH_QUEUE_CHANGED))
          reply({ ok: true, data: { client_analysis_id: safeRow.client_analysis_id,
            athlete_id: currentAthlete.id, status: 'draft', queued: true } })
          return
        }
        reply({ ok: false, error: result.error.message || 'Analysen kunne ikke sendes' })
        return
      }
      clearPendingSilentFails(currentAthlete.id)
      reply({ ok: true, data: { ...result.data, duplicate: result.duplicate } })
    }
    window.addEventListener('message', onAthleteVideoCoachMessage)
    return () => window.removeEventListener('message', onAthleteVideoCoachMessage)
  }, [session.user.id])

  useEffect(() => {
    if (!athlete?.id) return undefined
    let cancelled = false
    let retryTimer = null
    let retryAttempt = 0
    let inFlight = false
    const maxRetries = 5

    const notifyVideoCoachQueue = result => {
      const message = { type: `${ATHLETE_VIDEOCOACH_PREFIX}:queue-status`, ...result }
      for (const client of athleteVideoCoachClientsRef.current) {
        if (!client || client.closed) { athleteVideoCoachClientsRef.current.delete(client); continue }
        try { client.postMessage(message, window.location.origin) }
        catch { athleteVideoCoachClientsRef.current.delete(client) }
      }
      if (result.sent > 0) {
        if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
        setFlash({ message: 'Din gemte videoanalyse er nu sendt til coachen.', kind: 'info' })
        flashTimerRef.current = setTimeout(() => setFlash(null), 4500)
      } else if (result.expired > 0 || result.invalid > 0) {
        if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
        setFlash({ message: 'En lokalt gemt videoanalyse kunne ikke sendes. Åbn VideoCoach og send den igen.', kind: 'error' })
        flashTimerRef.current = setTimeout(() => setFlash(null), 6500)
      }
    }

    const flushPendingVideoCoach = async () => {
      if (cancelled || inFlight) return
      inFlight = true
      const result = await flushVideoCoachDraftQueue(
        supabase, athlete.id, globalThis.localStorage, session.user.id)
      inFlight = false
      if (cancelled) return
      notifyVideoCoachQueue(result)
      if (result.remaining > 0 && retryAttempt < maxRetries) {
        const delay = Math.min(80_000, 5000 * (2 ** retryAttempt))
        retryAttempt++
        retryTimer = setTimeout(flushPendingVideoCoach, delay)
      } else if (result.remaining > 0) {
        if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
        setFlash({ message: 'Videoanalysen er stadig gemt lokalt. Vi prøver igen næste gang VideoCoach åbnes.', kind: 'error' })
        flashTimerRef.current = setTimeout(() => setFlash(null), 6500)
      } else {
        retryAttempt = 0
      }
    }
    flushPendingVideoCoach()
    const retryWhenOnline = () => {
      retryAttempt = 0
      if (retryTimer) clearTimeout(retryTimer)
      flushPendingVideoCoach()
    }
    const retryWhenQueueChanges = () => {
      retryAttempt = 0
      if (retryTimer) clearTimeout(retryTimer)
      retryTimer = setTimeout(flushPendingVideoCoach, 5000)
    }
    window.addEventListener('online', retryWhenOnline)
    window.addEventListener(ATHLETE_VIDEOCOACH_QUEUE_CHANGED, retryWhenQueueChanges)
    return () => {
      cancelled = true
      if (retryTimer) clearTimeout(retryTimer)
      window.removeEventListener('online', retryWhenOnline)
      window.removeEventListener(ATHLETE_VIDEOCOACH_QUEUE_CHANGED, retryWhenQueueChanges)
    }
  }, [athlete?.id, session.user.id])

  // eslint-disable-next-line react-hooks/exhaustive-deps -- kører bevidst kun ved mount; coachAthleteId/role/session er faste for denne AthleteView-instans (nyt preview = nyt mount, se App.jsx)
  useEffect(() => { fetchAthlete() }, [])
  // G16 (ordre 131): opdager en videoupload der blev afbrudt af at fanen/appen
  // lukkede eller genindlæste midt i overførslen (ingen kode når at køre
  // færdig i det tilfælde, så intet andet sted kan vise fejlen). Kører kun
  // ved en reel app-åbning (athlete.id sat første gang), ikke ved genrender.
  useEffect(() => {
    if (!athlete?.id) return
    if (!takeStaleUploadInflight(athlete.id)) return
    recordSilentFail(athlete.id, 'silent:video-upload-interrupted')
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- uændret fra før ordre 373; lint ser det først nu (se RAPPORT-373)
    setFlash({ message: 'Din seneste video blev muligvis afbrudt, mens den blev sendt. Åbn VideoCoach og send den igen for at være sikker.', kind: 'error' })
    flashTimerRef.current = setTimeout(() => setFlash(null), 6500)
  }, [athlete?.id])
  // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchLogs er ren ift. sine parametre (athleteId, dato), begge allerede i deps
  useEffect(() => { if (athlete?.id) fetchLogs(athlete.id, kostDate) }, [kostDate, athlete?.id])
  // ORDRE 280 · commit 4 — ventende sæt (offlineSetQueue.js) sendes igen ved
  // app-åbning og hver gang forbindelsen kommer tilbage ('online'-event).
  useEffect(() => {
    if (!athlete?.id) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- uændret fra før ordre 373; lint ser det først nu (se RAPPORT-373)
    setPendingSyncCount(countOfflineSets(athlete.id))
    flushOfflineSets()
    window.addEventListener('online', flushOfflineSets)
    return () => window.removeEventListener('online', flushOfflineSets)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- flushOfflineSets læser kun athlete/currentWeek/exerciseLogs, alle friske ved kald (samme mønster som fetchAthlete ovenfor)
  }, [athlete?.id])
  useEffect(() => {
    if (role === 'athlete' && athlete?.id) fetchSharedVideoAnalyses()
  // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchSharedVideoAnalyses er ren ift. role/athlete.id, som er i deps; uændret fra før ordre 373
  }, [role, athlete?.id])
  // eslint-disable-next-line react-hooks/exhaustive-deps -- begge kaldes synkront i denne kørsel og læser kun athlete/msgTrack, som allerede er i deps
  useEffect(() => { if (tab === 'beskeder' && athlete?.id) { fetchAthleteMessages(); markTrackRead(msgTrack); if (msgTrack === 'teknik') fetchSharedVideoAnalyses() } }, [tab, athlete?.id, msgTrack])
  useEffect(() => { if (tab === 'beskeder') messagesEndRef.current?.scrollIntoView({ block: 'end' }) }, [messages, tab])
  // eslint-disable-next-line react-hooks/exhaustive-deps -- begge er rene ift. athlete.id, som allerede er i deps
  useEffect(() => { if (tab === 'stævnedag' && athlete?.id) { fetchMeetPlan(athlete.id); fetchMeetResults(athlete.id) } }, [tab, athlete?.id])
  // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchVolumeLogs er ren ift. athleteId, som allerede er i deps
  useEffect(() => { if (tab === 'volumen' && athlete?.id) fetchVolumeLogs(athlete.id) }, [tab, athlete?.id])
  // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchFremgangLogs er ren ift. athleteId, som allerede er i deps
  useEffect(() => { if (tab === 'fremgang' && athlete?.id) fetchFremgangLogs(athlete.id) }, [tab, athlete?.id])

  useEffect(() => {
    if (tab === 'mobilisering' && mobilityMode === 'opvarmning' && currentWeek && warmupPhase === 'focus' && !warmupFocus) {
      for (const session of currentWeek.sessions || []) {
        for (const ex of session.exercises || []) {
          const n = (ex.name || '').toLowerCase()
          // eslint-disable-next-line react-hooks/set-state-in-effect -- uændret fra før ordre 373; lint ser det først nu (se RAPPORT-373)
          if (n.includes('squat')) { setWarmupFocus('Squat'); return }
          if (n.includes('bænk') || n.includes('bench')) { setWarmupFocus('Bænkpres'); return }
          if (n.includes('sumo')) { setWarmupFocus('Dødløft'); setWarmupSubtype('Sumo'); return }
          if (n.includes('dødl') || n.includes('deadlift')) { setWarmupFocus('Dødløft'); return }
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- skal kun forsøge auto-detektion når fanen/uge/tilstand ændres, ikke når seedingen selv sætter warmupFocus
  }, [tab, currentWeek, mobilityMode])

  useEffect(() => {
    // G5: regn ud fra tidsstempler (hvornår segmentet startede, og hvornår
    // "nu" faktisk er), ikke ud fra hvor mange ticks der nåede at køre — en
    // låst skærm/baggrundsfane throttler eller pauser setTimeout-kæder, men
    // uret går videre. genregner desuden med det samme ved visibilitychange,
    // så en genoptaget fane ikke venter på næste 250ms-tick for at rette sig.
    if (!timerActive) return
    timerStartRef.current = { remainingAtStart: timerSeconds, startedAt: Date.now() }
    const recompute = () => {
      const live = remainingSeconds(timerStartRef.current.remainingAtStart, timerStartRef.current.startedAt)
      setTimerSeconds(live)
      if (live <= 0) { setTimerActive(false); setTimerDone(true) }
    }
    recompute()
    const id = setInterval(recompute, 250)
    const onVisible = () => { if (document.visibilityState === 'visible') recompute() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible) }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- kun ved start/stop af segmentet; 'timerSeconds' bruges kun som startpunkt for DET segment
  }, [timerActive])

  useEffect(() => {
    if (!loading) return
    const timer = setTimeout(() => setLoadError(true), 10000)
    return () => clearTimeout(timer)
  }, [loading])

  const now = new Date()
  const days = ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag']
  const months = ['januar', 'februar', 'marts', 'april', 'maj', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'december']

  // Ferie: atleten er sat på ferie (ingen slutdato, eller slutdato i dag/fremtid).
  const onHoliday = athlete?.status === 'ferie' && (!athlete.vacation_until || athlete.vacation_until >= today())
  const holidayReturn = athlete?.vacation_until
    ? (() => { const d = new Date(athlete.vacation_until + 'T12:00:00'); return `${d.getDate()}. ${months[d.getMonth()]}` })()
    : null

  const backBtn = onExitPreview && (
    <button
      onClick={onExitPreview}
      style={{ background: 'rgba(200,146,58,0.12)', color: '#c8923a', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', border: '1px solid rgba(200,146,58,0.35)', padding: '0.35rem 0.85rem', cursor: 'pointer' }}
    >← Coach view</button>
  )

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#141410', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1.5rem', color: '#4a4844', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
      {loadError ? (
        <>
          <div style={{ color: '#7a7770' }}>Kunne ikke indlæse data.</div>
          {backBtn || <button style={s.btnGhost} onClick={() => window.location.reload()}>Prøv igen</button>}
        </>
      ) : 'Indlæser...'}
      {!loadError && backBtn}
    </div>
  )

  if (!athlete) {
    // Første skærm en atlet møder hvis mailen ikke matcher en profil. Rolig,
    // menneskelig, handlingsanvisende — ingen teknisk fejltekst.
    const stuckEmail = session?.user?.email || ''
    const coachMail = `mailto:coach@entropicoaching.dk?subject=${encodeURIComponent('Kobl min konto til min atletprofil')}&body=${encodeURIComponent(`Hej coach\n\nJeg er logget ind i Entropi som ${stuckEmail || '(min mail)'}, men min konto er ikke koblet til min atletprofil endnu. Kan du koble mig til?\n\nTak!`)}`
    return (
      <div style={{ minHeight: '100vh', background: '#141410', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
        <div style={{ maxWidth: 430, width: '100%', textAlign: 'center' }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#c8923a', marginBottom: '0.9rem' }}>Entropi Coaching</div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.9rem', fontWeight: 400, color: '#edeae2', lineHeight: 1.15, marginBottom: '1rem' }}>Næsten klar.</h1>
          <p style={{ color: '#b8b4a8', fontSize: '0.92rem', lineHeight: 1.65, marginBottom: '1.35rem' }}>
            Din konto er endnu ikke koblet til en atletprofil. Det sker automatisk, når du logger ind med den mail, du fik invitationen på.
          </p>
          <div style={{ background: '#1c1c18', border: '1px solid rgba(237,234,226,0.1)', borderRadius: 8, padding: '0.85rem 1rem', marginBottom: '1.35rem' }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7a7770', marginBottom: '0.35rem' }}>Du er logget ind som</div>
            <div style={{ color: '#edeae2', fontSize: '0.9rem', wordBreak: 'break-all' }}>{stuckEmail || '—'}</div>
          </div>
          <p style={{ color: '#7a7770', fontSize: '0.8rem', lineHeight: 1.65, marginBottom: '1.6rem' }}>
            Brugte du en anden mail end den fra invitationen? Log ud og prøv igen. Er du i tvivl, så skriv til din coach — så kobler han dig til.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <a href={coachMail} style={{ ...s.btnPrimary, textDecoration: 'none', display: 'block', padding: '0.85rem 1rem' }}>Skriv til din coach</a>
            {backBtn || <button style={s.btnGhost} onClick={() => signOutHard()}>Log ud og skift mail</button>}
          </div>
        </div>
      </div>
    )
  }

  const progressBars = (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
      {[
        { label: 'Kalorier', val: totKcal, target: athlete.kcal_target, unit: 'kcal', pct: kcalPct, color: '#c8923a' },
        { label: 'Protein', val: totProtein, target: athlete.protein_target, unit: 'g', pct: proteinPct, color: '#6cba6c' },
      ].map(({ label, val, target, unit, pct, color }) => (
        <div key={label} style={s.card}>
          <div style={s.cardLabel}>{label}</div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.3rem', color: '#edeae2', lineHeight: 1, marginBottom: '0.6rem' }}>
            {val} <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '0.8rem', color: '#7a7770', fontWeight: 300 }}>/ {target || '?'} {unit}</span>
          </div>
          <div style={{ height: '3px', background: '#242420', borderRadius: '2px' }}>
            <div style={{ height: '3px', width: pct + '%', background: color, borderRadius: '2px', transition: 'width 0.4s ease' }} />
          </div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#4a4844', marginTop: '0.35rem' }}>{pct}%</div>
        </div>
      ))}
    </div>
  )

  // Kompakt kost-status til forsiden: ét slankt, klikbart kort i stedet for to
  // store. Fylder minimalt når der ikke er logget noget ("mindre in your face"),
  // og viser tal + tynde bars når dagen er i gang. Kost-fanen har den fulde visning.
  const kostCompact = (
    <div
      onClick={() => setTab('kost')}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(200,146,58,0.3)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(237,234,226,0.07)'}
      style={{ ...s.card, cursor: 'pointer', padding: '0.7rem 1rem', marginBottom: '1.5rem' }}
    >
      {(totKcal > 0 || totProtein > 0) ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <span style={{ ...s.cardLabel, marginBottom: 0, flexShrink: 0 }}>Kost i dag</span>
          {[
            { val: totKcal, target: athlete.kcal_target, unit: 'kcal', pct: kcalPct, color: '#c8923a' },
            { val: totProtein, target: athlete.protein_target, unit: 'g protein', pct: proteinPct, color: '#6cba6c' },
          ].map(({ val, target, unit, pct, color }) => (
            <span key={unit} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.62rem', color: '#edeae2', whiteSpace: 'nowrap' }}>
                {val}<span style={{ color: '#7a7770' }}> / {target || '?'} {unit}</span>
              </span>
              <span style={{ width: 44, height: 3, background: '#242420', borderRadius: 2, flexShrink: 0 }}>
                <span style={{ display: 'block', width: `${Math.min(pct, 100)}%`, height: 3, background: color, borderRadius: 2 }} />
              </span>
            </span>
          ))}
          <span style={{ marginLeft: 'auto', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.55rem', color: '#4a4844' }}>→</span>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ ...s.cardLabel, marginBottom: 0 }}>Kost</span>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', color: '#4a4844', letterSpacing: '0.05em' }}>
            Ingen måltider logget i dag
          </span>
          <span style={{ marginLeft: 'auto', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.55rem', color: '#4a4844' }}>→</span>
        </div>
      )}
    </div>
  )

  if ((!onboardingDone || guideOpen) && !coachAthleteId) {
    return (
      <OnboardingGuide
        {...{
          advanceOnboardingGuide, athlete, completeOnboardingGuide, currentWeek, guideStep,
        }}
      />
    )
  }

  // ORDRE 339 · blok 1 (F5 fra KRITIK-330-326) — PR-toasten og den
  // almindelige toast lå fast (position: fixed) 10 px under topbaren og
  // dækkede derfor overskriften ("Tirsdag · Dag 2 …") og strimlen i de ~3 s
  // lige efter et logget sæt, også når siden var rullet lidt. Nu ligger de i
  // en plads i sidens flow (sticky under topbaren). På forsiden står pladsen
  // EFTER overskrift + strimmel: et sticky element kan kun glide ned over
  // indhold der kommer efter det, så dagen kan aldrig dækkes. På de andre
  // faner står den lige under topbaren.
  const toastSlot = (prToast || flash) ? (
    <div data-toast-plads="" style={{ position: 'sticky', top: '52px', zIndex: 49, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 0', pointerEvents: 'none' }}>
      {prToast && (
        <div style={{
          background: '#1c1c18', border: '1px solid rgba(200,146,58,0.55)',
          padding: '0.65rem 1.1rem', maxWidth: '100%', boxSizing: 'border-box', textAlign: 'center',
          fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.7rem',
          color: '#c8923a', letterSpacing: '0.08em',
          boxShadow: '0 4px 24px rgba(0,0,0,0.55)',
          opacity: prToastFading ? 0 : 1, transition: 'opacity 0.6s ease',
        }}>
          {prToast.type === 'vægt' ? '🏆 Ny personlig rekord (vægt)' : prToast.type === 'rep' ? '🔥 Ny personlig rekord (reps)' : '⚡ Stærkeste sæt'} på {prToast.name}
        </div>
      )}
      {flash && (
        <div role="status" style={{
          background: '#1c1c18', border: `1px solid ${flash.kind === 'error' ? 'rgba(224,85,85,0.55)' : 'rgba(200,146,58,0.55)'}`,
          padding: '0.65rem 1.4rem', maxWidth: '100%', boxSizing: 'border-box', textAlign: 'center',
          fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.62rem', letterSpacing: '0.06em',
          color: flash.kind === 'error' ? '#e05555' : '#c8923a', boxShadow: '0 4px 24px rgba(0,0,0,0.55)',
        }}>{flash.message}</div>
      )}
    </div>
  ) : null

  return (
    <div style={s.wrap}>
      <Ramme
        {...{
          accountMenuOpen, askConfirm, athleteVideoCoachFrameRef, athleteVideoCoachInstant, athleteVideoCoachOpen, backBtn, confirmDialog, handleRecheckRole,
          onExitPreview, onRecheckRole, openRpePicker, recheckingRole, restartOnboardingGuide, role, setAccountMenuOpen, setConfirmDialog,
          setOpenRpePicker, setShowRpeGuide, showRpeGuide, undoDelete, undoPending, undoToast,
        }}
      />
      {/* Toast-pladsen (ORDRE 339 · F5): under topbaren på alle faner undtagen
          forsiden, hvor den ligger under overskrift + strimmel (se toastSlot). */}
      {!(tab === 'hjem' && !onHoliday) && toastSlot}
      {recheckMsg && !onExitPreview && (
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', letterSpacing: '0.04em', color: '#7a7770', textAlign: 'right', padding: '0.4rem 1.5rem 0' }}>{recheckMsg}</div>
      )}

      {/* Page content */}
      <div style={s.page}>

        {/* HJEM */}
        <HjemTab
          {...{
            allWeeks, athlete, currentWeek, days, exerciseHistory, exerciseLogs, fetchForloebLogs, fetchSharedVideoAnalyses,
            forloebLoading, forloebLogs, formatMsgTime, holidayReturn, kostCompact, lastLoggedSet, lastReadiness, liftProgress,
            logDagensPasSet, logInputs, logWeight, mereOpen, messages, months, now, onHoliday,
            openReadiness, openSession, pendingSyncCount, prs, prsError, readinessCardRef, readinessError, readinessHistory,
            readinessInput, readinessLog, renderSharedFeedbackCards, restPause, role, saveReadiness, savingReadiness, savingWeight,
            setAthleteVideoCoachInstant, setAthleteVideoCoachOpen, setLogInputs, setMereOpen, setReadinessInput, setRestPause, setTab, setWeightInput,
            sharedVideoAnalyses, sharedVideoError, sharedVideoLoading, skipSet, suggestNextWeight, tab, toastSlot, undoLoggedSet,
            unreadMsgCount, updateLoggedSet, weeklyTonnage, weightInput, weightLogs,
          }}
        />

        {/* PROGRAM */}
        {tab === 'program' && (
          <LazyBoundary
            factory={programFactory} label="Program" loading={<div style={s.page}>Indlæser…</div>}
            componentProps={{
              WEEKDAYS_LONG, allWeeks, applyWarmupCorrection, askConfirm, athlete, autoCompleteSession,
              calcWarmupSets, computeActiveWeekIdx, currentWeek, dismissedFeedback, exWarmupExpanded,
              exWarmupWeightEditing, exWarmupWeightOverride, exerciseHistory, exerciseLogs, feedbackInputs,
              fetchPastLogs, fetchProgram, fmtWeekRange, lastLogByExerciseName, logInputs, logSet,
              openReadiness, openRpePicker, openSession, parsePlannedRpe, pastLogs, pendingSessionAction,
              progOpenSession, programError, readinessLog, saveFeedback, saveWarmupOverride, sessionRefs,
              setConfirm, setDismissedFeedback, setExWarmupExpanded, setExWarmupWeightEditing,
              setExWarmupWeightOverride, setFeedbackInputs, setLogInputs, setOpenRpePicker, setPastLogs,
              setProgOpenSession, setShowRpeGuide, setSkipConfirmEx, setViewingWeekIdx, setWarmupChecked,
              setWarmupOverrideTick, setWarmupSetEditing, skipConfirmEx, skipExercise, skipRemainingSets,
              skipSet, suggestNextWeight, suggestWarmupOverride, unskipSet, viewingWeekIdx, warmupChecked,
              warmupOverrideTick, warmupSetEditing, weekStartDate,
            }}
          />
        )}

        {/* VOLUMEN */}
        {tab === 'volumen' && (
          <LazyBoundary
            factory={volumenFactory} label="Volumen" loading={<div style={s.page}>Indlæser…</div>}
            componentProps={{ volumeLogs, volumeLoading }}
          />
        )}

        {/* FREMGANG */}
        {tab === 'fremgang' && (
          <LazyBoundary
            factory={fremgangFactory} label="Fremgang" loading={<div style={s.page}>Indlæser…</div>}
            componentProps={{ fremgangLogs, fremgangLoading, allWeeks }}
          />
        )}

        {/* KOST */}
        {tab === 'kost' && (
          <LazyBoundary
            factory={kostFactory} label="Kost" loading={<div style={s.page}>Indlæser…</div>}
            componentProps={{
              addFromSearch, amount, athlete, cKcal, cLen, circ, copyYesterday, createFood,
              deleteLog, deleteTemplate, editGrams, editMacros, editingLogId, fKcal, fLen,
              frequentFoods, kostDate, logTemplate, logs, macroTotal, mealTemplates,
              onSearchInput, pKcal, pLen, parseLoggedGrams, progressBars, quickAddSearchFood,
              quickLogFood, saveCustomFood, saveEditLog, saveTemplate, searchQuery,
              searchResults, selectFood, selectedFood, setAmount, setCreateFood, setEditGrams,
              setEditMacros, setEditingLogId, setKostDate, setSearchQuery, setSelectedFood,
              setShareFood, setShowCreateFood, setShowSaveTemplate, setShowTdee,
              setShowTemplates, setTemplateNameInput, setUnitIdx, shareFood, showCreateFood,
              showSaveTemplate, showTdee, showTemplates, startEditLog, tdeeEstimate,
              templateNameInput, totCarb, totFat, totKcal, totProtein, unitIdx,
            }}
          />
        )}

        {/* BESKEDER */}
        {tab === 'beskeder' && (
          <LazyBoundary
            factory={beskederFactory} label="Beskeder" loading={<div style={s.page}>Indlæser…</div>}
            componentProps={{
              fetchSharedVideoAnalyses, formatMsgTime, messageInput, messagesEndRef, messages,
              msgTrack, renderSharedFeedbackCards, sendAthleteMessage, setMessageInput, setMsgTrack,
              sharedVideoAnalyses, sharedVideoError, sharedVideoLoading,
            }}
          />
        )}

        {/* MOBILITET */}
        {tab === 'mobilisering' && (
          <LazyBoundary
            factory={mobiliseringFactory} label="Mobilitet" loading={<div style={s.page}>Indlæser…</div>}
            componentProps={{
              currentWeek, mobilityIntake, mobilityMode, mobilityPhase, mobilitySlots, mobilityStep,
              readinessLog, setMobilityIntake, setMobilityMode, setMobilityPhase, setMobilitySlots,
              setMobilityStep, setTimerActive, setTimerDone, setTimerSeconds, setWarmupChoice,
              setWarmupExercises, setWarmupFocus, setWarmupPhase, setWarmupProblems, setWarmupStep,
              setWarmupSubtype, timerActive, timerDone, timerSeconds, warmupChoice, warmupExercises,
              warmupFocus, warmupPhase, warmupProblems, warmupStep, warmupSubtype, warmupTemplates,
            }}
          />
        )}

        {/* STÆVNEDAG */}
        {tab === 'stævnedag' && (
          <LazyBoundary
            factory={staevnedagFactory} label="Stævnedag" loading={<div style={s.page}>Indlæser…</div>}
            componentProps={{
              athlete, coachAthleteId, hasMeetPlan, meetAttempts, meetPlanNotes, meetResults,
              meetType, meetWarmupDraft, meetWarmupEditing, meetWarmupOverrides, setAthlete,
              setMeetAttempts, setMeetType, setMeetWarmupDraft, setMeetWarmupEditing,
              setMeetWarmupOverrides, showFlash,
            }}
          />
        )}
      </div>

      {/* Bottom navigation — Stævne vises kun når den er relevant (stævnedato/plan),
          ellers fylder den en fast plads for de 7/8 atleter uden et stævne på vej. */}
      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#1c1c18', borderTop: '1px solid rgba(237,234,226,0.07)', display: 'flex', zIndex: 100 }}>
        {NAV_ITEMS.filter(n => n.key !== 'stævnedag' || athlete?.competition_date || hasMeetPlan).map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.3rem',
              padding: '0.7rem 0',
              color: tab === key ? '#c8923a' : '#4a4844',
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '0.46rem',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              transition: 'color 0.15s ease',
            }}
          >
            <div style={{ position: 'relative' }}>
              {icon}
              {key === 'beskeder' && (unreadMsgCount + sharedVideoAnalyses.filter(a => !a.athlete_seen_at).length) > 0 && (
                <div style={{ position: 'absolute', top: -3, right: -4, width: '8px', height: '8px', borderRadius: '50%', background: '#c8923a', border: '1.5px solid #1c1c18' }} />
              )}
            </div>
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
