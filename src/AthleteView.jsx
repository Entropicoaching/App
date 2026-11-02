import NytIAppen, { nytAthleteNavigation } from './nytIAppen.mjs'
import { contactLatestEnabled, enterContact, scrollContactEnd } from './athlete/contactLatest.mjs'
import { VIDEO_SET_SELECTION_ENABLED, videoOptionsForDay, resolveVideoSet } from './athlete/videoSetSelection.mjs'
import { findDagensPas } from './nextSet.js'
import { indbakke2Enabled } from './indbakke2.mjs'
import TrainingFullscreen from './athlete/TrainingFullscreen.mjs'
import { rel1101Enabled } from './rel1101.mjs'
import { MobilityHomeworkProgress } from './mobilityAdherence.mjs'
import { CoachMobilitySummary } from './athlete/CoachMobility.jsx'
import { MobilityHomeworkHome } from './mobilityHomework.mjs'
import { renderMobilityShortcut } from './athlete/mobilityFocus.mjs'
import { kostSynlig, kostDestination } from './athlete/kostValg.mjs'
const enkelHjemFactory = () => import('./athlete/EnkelHjemTab.jsx')
import { readinessNavigation } from './athlete/readinessShortcut.mjs'
const enkelFremgangFactory = () => import('./athlete/EnkelFremgangTab.jsx')
import { previewNavigation, renderControls, renderTrainingLinks, renderMore, renderNav } from './athlete/enkelPrototype.mjs'
import { useState, useEffect, useRef, useMemo, createElement } from 'react'
import { remainingSeconds } from './restTimer.js'
import { countOfflineSets, pendingSetKeys, loadParkedSets } from './offlineSetQueue.js'
import { browserSaysOffline, seemsOffline } from './offlineSession.js'
import IngenForbindelse from './athlete/IngenForbindelse.jsx'
import { calcWarmupSets } from './warmup.js'
import { applyWarmupCorrection, saveWarmupOverride, suggestWarmupOverride } from './warmupOverride.js'
import LazyBoundary from './LazyBoundary.jsx'
import { s, today } from './athleteShared.js'
import { computeActiveWeekIdx, weekStartDate, fmtWeekRange,
  WEEKDAYS_LONG, parsePlannedRpe, logFrontendError } from './athlete/ugeHjaelp.js'
import HjemTab from './athlete/HjemTab.jsx'
import OnboardingGuide from './athlete/OnboardingGuide.jsx'
import Ramme from './athlete/Ramme.jsx'
import IkkeKoblet from './athlete/IkkeKoblet.jsx'
import Indlaeser from './athlete/Indlaeser.jsx'
import { KostCompact, ProgressBars } from './athlete/KostKort.jsx'
import ToastPlads from './athlete/ToastPlads.jsx'
import BundNav from './athlete/BundNav.jsx'
import { lavSaetSkrivning } from './athlete/saetSkrivning.js'
import { lavLaesninger } from './athlete/laesninger.js'
import { udenForslagVedSmerte } from './athlete/smerteStop.js'
import { lavBeskederOgVaegt } from './athlete/beskederOgVaegt.jsx'
import { lavKostHandlinger } from './athlete/kostHandlinger.js'
import { useVideoCoachBro, useAfbrudtUploadVarsel } from './athlete/useVideoCoachBro.js'
import { useParathedUdkast } from './athlete/useParathedUdkast.js'
import { bygGrundlag, ugensSaet } from './athlete/rekorder.js'
import { tomtIndeks, loadRekordIndeks, saveRekordIndeks, laegRaekkerTil, medUgensSaet, grundlagFoer, hentSiden } from './athlete/rekordIndeks.js'
import { compactHomeworkEnabled, renderHomeworkEntry, renderHomeworkHome } from './athlete/hjemoevKompakt.mjs'
import { entropi2Enabled, loadEntropi2Styles, HomeSession, Entropi2Kost, ConversationEntry, Entropi2Mobility, Entropi2Analysis, LOCAL_FOODS } from './entropi2/athleteEntry.mjs'

// Indlæses via LazyBoundary (ordre 232 · commit 2), samme mønster som Dashboard.jsx's fire faner.
const mobiliseringFactory = () => import('./athlete/MobiliseringTab.jsx')
const staevnedagFactory = () => import('./athlete/StaevnedagTab.jsx')
const programFactory = () => import('./athlete/ProgramTab.jsx')
// ORDRE 259 · commit 1: samme lazy-chunk-mønster, ny fane.
const volumenFactory = () => import('./athlete/VolumenTab.jsx')
// ORDRE 284 · commit 1: samme lazy-chunk-mønster, ny fane.
const fremgangFactory = () => import('./athlete/FremgangTab.jsx')
const fremgangFokusFactory = () => import('./athlete/fremgangFokus.mjs')
const kostFactory = () => import('./athlete/KostTab.jsx')
const indbakke2Factory = () => import('./athlete/Indbakke2Tab.mjs')
const beskederFactory = () => import('./athlete/BeskederTab.jsx')

function LazyEnkelHjemTab(props) {
  return createElement(LazyBoundary, { factory: enkelHjemFactory, label: 'Hjem', componentProps: props })
}

// RO2: presentation-only Home entry. Original Home/lazy modules remain intact.
function homeRo2Order(tree, enabled) {
  if (enabled !== true) return tree
  let chips
  function move(node) {
    if (Array.isArray(node)) return node.map(move)
    if (!node || typeof node !== 'object' || !node.props) return node
    if (Object.hasOwn(node.props, 'data-sekundaer')) { chips = node; return null }
    if (!Object.hasOwn(node.props, 'children')) return node
    const children = Array.isArray(node.props.children) ? node.props.children : [node.props.children]
    return createElement(node.type, { ...node.props, ...(node.key == null ? {} : { key: node.key }) }, ...children.map(move))
  }
  const body = move(tree)
  return chips ? createElement(tree.type, null, chips, body) : tree
}
function Ro2HjemTab(props) {
  return homeRo2Order(HjemTab(props), !props.onHoliday)
}
const ro2EnkelHjemFactory = () => enkelHjemFactory().then(module => ({
  default: homeProps => homeRo2Order(module.default(homeProps), !homeProps.onHoliday),
}))
function Ro2EnkelHjemTab(props) {
  return createElement(LazyBoundary, { factory: ro2EnkelHjemFactory, label: 'Hjem', componentProps: props })
}

export default function AthleteView({ opvarmStige = false, hviledageListe = false, programNaesteUge = false, videoSetSelection = VIDEO_SET_SELECTION_ENABLED, mobilitetCoach = false, mobilitetHjemme = false, mobilitetOpfoelgning = false, mobilitetHjalp = false, session, onExitPreview, role, coachAthleteId, onRecheckRole, enkelPrototype = false, forenklinger = false, programUgeFoerst = false, programBlokOversigt = false, fremgangFokus = false, naesteTraening = false, personalRecords = false, repRecords = false, staevnedagFokus = false, staevneHjem = false, fremgangLinjer = false, mobilitetFoerPas = false, hviledagMobilitet = false, mobilitetFokus = false, kostPerAtlet, kostValg, blokStyrke = false, blokFremgang = false, vaerdF6 = false, ugeLogget = false , previewInitialTab = 'hjem', programIntensityHelp = false, hjemoevKompakt = false, rel1101 = false, entropi2 = false}) {
  const indbakke2 = indbakke2Enabled(typeof window === 'undefined' ? '' : window.location.search)
  const [requestedTab, setLegacyTab] = useState(() => role === 'coach' && coachAthleteId && ['hjem', 'program', 'mobilisering', 'fremgang'].includes(previewInitialTab) ? previewInitialTab : 'hjem')
  const [enkelRoute, setEnkelRoute] = useState('traening')
  const homeRo2 = rel1101Enabled(rel1101, typeof window === 'undefined' ? '' : window.location.search)
  const e2 = entropi2Enabled(entropi2) === true
  useEffect(() => { if (e2) loadEntropi2Styles() }, [e2])
  const enkelOn = enkelPrototype === true
  const HjemVisning = enkelOn ? LazyEnkelHjemTab : HjemTab
  const HjemIndgang = homeRo2 ? (enkelOn ? Ro2EnkelHjemTab : Ro2HjemTab) : HjemVisning
  // Explicit preview prop only; no storage, URL or environment activation.
  const navigate = previewNavigation(enkelOn, setLegacyTab, setEnkelRoute)
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
  const visKost = kostSynlig(athlete, kostPerAtlet, kostValg)
  const tab = kostDestination(requestedTab, visKost)
  const route = enkelRoute === 'kost' && !visKost ? 'traening' : enkelRoute
  // ORDRE 263 · commit 2: den automatiske pause mellem sæt (null = ingen
  // aktiv pause). Se restPause.js.
  const [restPause, setRestPause] = useState(null)
  // ORDRE 280 · commit 4: antal sæt der ligger lokalt og venter på net (se
  // offlineSetQueue.js). Kun til "Dagens pas"-kortets linje — Program-fanens
  // Log-knap er urørt.
  const [pendingSyncCount, setPendingSyncCount] = useState(0)
  // ORDRE 397: tidspunktet for det øjebliksbillede af Dagens pas der vises,
  // fordi serveren ikke kunne nås (null = data er frisk fra serveren). Se
  // athlete/offlineSnapshot.js og docs/OFFLINE-PAS.md.
  const [offlineSnapshotAt, setOfflineSnapshotAt] = useState(null)
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
  // ORDRE 439: null = endnu ikke hentet. ORDRE 450: hentes igen kun når
  // fanen åbnes; rekorderne klarer sig med rekord-indekset nedenfor.
  const [fremgangLogs, setFremgangLogs] = useState(null)
  const [fremgangLoading, setFremgangLoading] = useState(false)
  // ORDRE 439 · blok 1: rekord-fejringen på Dagens pas-kortet ({ id, key, tekst })
  // og de sæt der allerede er fejret i denne åbning (fejres kun én gang).
  const [rekordFejring, setRekordFejring] = useState(null)
  const fejredeRef = useRef(new Set())
  // ORDRE 450 · blok 1: rekord-indekset (src/athlete/rekordIndeks.js) i
  // stedet for hele historikken ved hver åbning. Ligger på telefonen (kun
  // atletens egen visning; coachens forhåndsvisning har det kun i hukommelsen).
  const [rekordIndeks, setRekordIndeks] = useState(() => (!coachAthleteId && session?.user?.id ? loadRekordIndeks(session.user.id) : null))
  // Id på den uge, hvis sæt er hentet fra serveren i denne åbning: så er
  // Dagens pas brugbart, og først da hentes rekord-rækkerne.
  const [ugensLogsHentet, setUgensLogsHentet] = useState(null)
  const rekordHentetRef = useRef(null)
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
  const [readinessOpen, setReadinessOpen] = useState(false)
  const setTab = readinessNavigation(destination => navigate(kostDestination(destination, visKost)), setReadinessOpen)
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

  const [restFocus, setRestFocus] = useState(null)
  const restMobility = hviledagMobilitet === true ? { enabled: true, athleteId: athlete?.id, notes: athlete?.notes, coachEnabled: mobilitetCoach, homeworkEnabled: mobilitetHjemme, focus: restFocus?.athleteId === athlete?.id ? restFocus : null } : undefined

  // Mobilitet-hub state — fanen er en intent-landing (null) med tre døre
  const [mobilityMode, setMobilityMode] = useState(null) // null=landing | 'opvarmning' | 'mobilitet'
  const compactHomework = compactHomeworkEnabled(mobilitetHjemme, hjemoevKompakt)
  const openHomework = () => { setMobilityMode('hjemmeoevelser'); setTab('mobilisering') }
  const homeworkEntry = homeRo2 && tab === 'hjem' && (!enkelOn || route !== 'mere') ? null : renderHomeworkEntry(createElement, { enabled: compactHomework, athleteId: athlete?.id, onOpen: openHomework })

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

  // G1: fælles fejlvisning for baggrundslæsninger (fetchPRs, fetchWeightLogs,
  // ...). Logger detaljen til frontend_errors og viser en oversat, ærlig
  // linje — samme sprog som skrivefejlene (showFlash, se athleteWriteGuard-
  // kaldene). Kalderen skal IKKE opdatere sin state når denne kaldes, så det
  // sidst kendte indhold forbliver på skærmen.
  function onReadError(label, athleteId) {
    return (error) => {
      // ORDRE 397: uden net står der én rolig linje øverst (IngenForbindelse)
      // i stedet for en rød toast pr. kort; loggen ville heller ikke nå frem.
      if (seemsOffline()) return
      logFrontendError(`${label} kunne ikke hentes`, error, athleteId)
      showFlash(`${label} kunne ikke hentes. Tjek din forbindelse og prøv igen.`, 'error')
    }
  }

  // ORDRE 439 · blok 1: rekord-grundlaget fra tidligere uger (maksima pr.
  // øvelse). Ugens egne sæt lægges til ved hver logning (saetSkrivning.js).
  // ORDRE 450: læses af rekord-indekset (alle andre uger end den aktive).
  const indeksForAtlet = rekordIndeks && athlete?.id && rekordIndeks.athleteId && rekordIndeks.athleteId !== athlete.id ? null : rekordIndeks
  const rekordGrundlagFoer = useMemo(() => grundlagFoer(indeksForAtlet, currentWeek), [indeksForAtlet, currentWeek])

  /* eslint-disable react-hooks/refs -- fabrikkerne får ref-objekterne med, men læser .current kun i hændelses- og effekt-callbacks, præcis som før ordre 373 */
  const {
    inboxDatabase,
    fetchWeightLogs, logWeight, fetchAthleteMessages, markTrackRead, sendAthleteMessage, formatMsgTime, renderSharedFeedbackCards,
    sendUgeLinje,
  } = lavBeskederOgVaegt({
    athlete, messageInput, msgTrack, onReadError, openSharedVideoId, setMessageInput, setMessages, setOpenSharedVideoId,
    setSavingWeight, setSharedVideoAnalyses, setUnreadMsgCount, setWeightInput, setWeightLogs, sharedVideoAnalyses, showFlash, weightInput,
    weightLogs, setMsgTrack, setTab,
  })

  const {
    confirmCompleteDay, fetchLogs, fetchHistoricalMealLogs, fetchFrequentFoods, quickLogFood, fetchMealTemplates, copyYesterday, saveTemplate, logTemplate,
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
    fetchAthlete, fetchSharedVideoAnalyses, fetchMeetPlan, fetchVolumeLogs, fetchFremgangLogs, fetchRekordRaekker, fetchForloebLogs, fetchMeetResults, suggestNextWeight: suggestNextWeightRaa,
    saveReadiness, fetchProgram, openSession, openReadiness: legacyOpenReadiness, completeOnboardingGuide, advanceOnboardingGuide, restartOnboardingGuide, fetchPastLogs,
    fetchExerciseLogs, fetchProgramBlockLogs,
  } = lavLaesninger({
    indbakke2,
    athlete, coachAthleteId, currentWeek, exerciseHistory, fetchAthleteMessages, fetchCustomFoods, fetchFrequentFoods, fetchHistoricalMealLogs,
    fetchLogs, fetchMealTemplates, fetchWeightLogs, guideStep, mountedRef, onReadError, readinessCardRef, readinessInput,
    role, session, sessionRefs, setAllWeeks, setAthlete, setCurrentWeek, setExerciseHistory, setExerciseLogs,
    setForloebLoading, setForloebLogs, setFremgangLoading, setFremgangLogs, setGuideOpen, setGuideStep, setHasMeetPlan, setLastLogByExerciseName,
    setLastReadiness, setLiftProgress, setLoadError, setLoading, setLogInputs, setMeetAttempts, setMeetPlanNotes, setMeetResults,
    setMeetType, setMereOpen, setReadinessOpen, setOnboardingDone, setOpenSharedVideoId, setPastLogs, setProgOpenSession, setProgramError, setPrs,
    setPrsError, setReadinessError, setReadinessHistory, setReadinessLog, setRestPause, setSavingReadiness, setSharedVideoAnalyses, setSharedVideoError,
    setSharedVideoLoading, setTab, setViewingWeekIdx, setVolumeLoading, setVolumeLogs, setWarmupTemplates, setWeeklyTonnage,
    setOfflineSnapshotAt, setUgensLogsHentet,
  })
  // Ordre 1502: en smerte-note i seneste uger standser appens stigningsforslag (D3, V10 3A).
  const suggestNextWeight = udenForslagVedSmerte(suggestNextWeightRaa, allWeeks, exerciseHistory)

  const {
    logSet, logDagensPasSet, flushOfflineSets, undoLoggedSet, updateLoggedSet, skipSet, skipExercise, unskipSet,
    saveFeedback, autoCompleteSession, skipRemainingSets,
  } = lavSaetSkrivning({
    allWeeks, athlete, currentWeek, exerciseLogs, feedbackInputs, fetchExerciseLogs, fetchPastLogs, lastLogByExerciseName,
    logInputs, setAllWeeks, setExerciseLogs, setLastLoggedSet, setLogInputs, setPendingSessionAction, setPendingSyncCount, setPrToast,
    setPrToastFading, setRestPause, setSetConfirm, setWriteRef, showFlash, viewingWeekIdx,
    rekordGrundlagFoer, setRekordFejring, fejredeRef,
  })
  // ORDRE 406 (O1 i docs/kritik-403): lytterne nedenfor registreres én gang pr.
  // atlet, men flushOfflineSets er en ny lukning i hvert render. Kaldte de den
  // fra første render, var currentWeek null, og afsendelsen sluttede med at
  // tømme Dagens pas. De kalder derfor altid den nyeste via denne ref (sat
  // efter hvert render, før effekterne nedenfor kører).
  const flushRef = useRef(flushOfflineSets)
  useEffect(() => { flushRef.current = flushOfflineSets })
  /* eslint-enable react-hooks/refs */

  function showFlash(message, kind = 'info') {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
    setFlash({ message, kind })
    flashTimerRef.current = setTimeout(() => setFlash(null), 3000)
  }

  function askConfirm(message, onConfirm) {
    setConfirmDialog({ message, onConfirm })
  }

  useParathedUdkast({ athlete, readinessInput, setReadinessInput, lastReadiness })

  const [videoSetChoice, setVideoSetChoice] = useState(null)
  const [videoSetReady, setVideoSetReady] = useState(false)
  const videoSetRef = useRef(null)
  const videoSetEnabled = videoSetSelection === true && role === 'athlete' && !coachAthleteId
  const videoPas = videoSetEnabled ? findDagensPas(allWeeks, currentWeek, exerciseLogs) : null
  const videoOptions = videoSetEnabled ? videoOptionsForDay(videoPas, currentWeek, exerciseLogs, today()) : []
  const selectedVideoSet = resolveVideoSet(videoOptions, videoSetChoice)
  // The listener reads the latest render; never retain another athlete's selection.
  videoSetRef.current = { enabled: videoSetEnabled, athleteId: athlete?.id,
    selected: athleteVideoCoachOpen && videoSetReady ? selectedVideoSet : null }
  useEffect(() => { setVideoSetChoice(null); setVideoSetReady(false) }, [athleteVideoCoachOpen, athlete?.id])

  // Entropi 2: samtalen får besked om bekræftede indsendelser fra upload-broen.
  const e2ConversationRef = useRef(null)
  useVideoCoachBro({
    conversationRef: e2ConversationRef,
    conversationHandover: e2,
    videoSetRef, videoOptag2: arguments[0]?.videoOptag2 === true,
    athlete, athleteVideoCoachClientsRef, athleteVideoCoachFrameRef, athleteVideoCoachRef, athleteVideoUploadAbortsRef, flashTimerRef, session, setAthleteVideoCoachInstant,
    setAthleteVideoCoachOpen, setFlash,
  })

  // eslint-disable-next-line react-hooks/exhaustive-deps -- kører bevidst kun ved mount; coachAthleteId/role/session er faste for denne AthleteView-instans (nyt preview = nyt mount, se App.jsx)
  useEffect(() => { fetchAthlete() }, [])
  useAfbrudtUploadVarsel({ athlete, flashTimerRef, setFlash })
  // Entropi 2: stabile props, så skærmene ikke monteres om ved hver gengivelse.
  const e2Day = today()
  // eslint-disable-next-line react-hooks/exhaustive-deps -- nyt tidspunkt kun ved dagsskifte eller atletskift
  const e2MobilityNow = useMemo(() => new Date(), [e2Day, athlete?.id])
  const e2SetTabRef = useRef(setTab)
  useEffect(() => { e2SetTabRef.current = setTab })
  const e2GoProgram = useMemo(() => () => e2SetTabRef.current('program'), [])
  const e2Foods = useMemo(() => [...(Array.isArray(customFoods) ? customFoods : []), ...(Array.isArray(LOCAL_FOODS) ? LOCAL_FOODS : [])], [customFoods])
  // Entropi 2: kostskærmen viser vægten; hent den eksisterende vægtlog, når kostfanen åbnes.
  const e2KostAaben = e2 && role === 'athlete' && !coachAthleteId && !onExitPreview && !!athlete?.id && visKost && tab === 'kost'
  // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchWeightLogs er ren ift. atlet-id'et, som er i deps
  useEffect(() => { if (e2KostAaben) fetchWeightLogs(athlete.id) }, [e2KostAaben, athlete?.id])
  // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchLogs er ren ift. sine parametre (athleteId, dato), begge allerede i deps
  useEffect(() => { if (athlete?.id) fetchLogs(athlete.id, kostDate) }, [kostDate, athlete?.id])
  // ORDRE 280 · commit 4 — ventende sæt (offlineSetQueue.js) sendes igen ved
  // app-åbning og hver gang forbindelsen kommer tilbage ('online'-event).
  useEffect(() => {
    if (!athlete?.id) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- uændret fra før ordre 373; lint ser det først nu (se RAPPORT-373)
    setPendingSyncCount(countOfflineSets(athlete.id))
    flushRef.current()
    // ORDRE 397: også når et kald lykkes igen efter "nettet er dødt" (ingen
    // 'online'-event, når browseren aldrig troede det var væk).
    const onOnline = () => flushRef.current()
    const onForbindelse = (e) => { if (!e.detail?.offline) flushRef.current() }
    window.addEventListener('online', onOnline)
    window.addEventListener('entropi:forbindelse', onForbindelse)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('entropi:forbindelse', onForbindelse)
    }
  }, [athlete?.id])
  // ORDRE 397: vises Dagens pas fra øjebliksbilledet (ingen forbindelse ved
  // åbning), hentes alt igen fra serveren når nettet kommer.
  // ORDRE 397: ligger der sæt og venter, prøves der igen hvert 20. sekund.
  // Et lykket forsøg er selv det der opdager at nettet er tilbage.
  useEffect(() => {
    if (!athlete?.id || (pendingSyncCount === 0 && !offlineSnapshotAt)) return
    const id = setInterval(() => {
      if (pendingSyncCount > 0) flushRef.current()
      else if (offlineSnapshotAt && !browserSaysOffline()) fetchAthlete()
    }, 20000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- flushOfflineSets/fetchAthlete læser friske værdier ved kald; genstartes når der er/ikke er noget at sende
  }, [athlete?.id, pendingSyncCount, offlineSnapshotAt])
  useEffect(() => {
    if (!offlineSnapshotAt) return
    const refetch = (e) => { if (!e?.detail?.offline) fetchAthlete() }
    window.addEventListener('online', refetch)
    window.addEventListener('entropi:forbindelse', refetch)
    return () => { window.removeEventListener('online', refetch); window.removeEventListener('entropi:forbindelse', refetch) }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchAthlete læser kun faste props (session/role/coachAthleteId), samme mønster som mount-effekten ovenfor
  }, [offlineSnapshotAt])
  useEffect(() => {
    if (role === 'athlete' && athlete?.id) fetchSharedVideoAnalyses()
  // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchSharedVideoAnalyses er ren ift. role/athlete.id, som er i deps; uændret fra før ordre 373
  }, [role, athlete?.id])
  const contactLatest = contactLatestEnabled() || indbakke2
  const openReadiness = enkelOn ? () => setTab('dagsform') : legacyOpenReadiness

  // Entropi 2: samtalen kvitterer selv ved eksplicit åbning; den gamle automatiske læst-markering må ikke køre.
  const e2SelvKvittering = e2 && role === 'athlete' && !coachAthleteId && !onExitPreview && !!athlete?.id
  // eslint-disable-next-line react-hooks/exhaustive-deps -- begge kaldes synkront i denne kørsel og læser kun athlete/msgTrack, som allerede er i deps
  useEffect(() => { if (tab === 'beskeder' && athlete?.id) enterContact({ enabled: contactLatest, fetchMessages: fetchAthleteMessages, markRead: e2SelvKvittering ? () => {} : markTrackRead, fetchVideos: fetchSharedVideoAnalyses, track: msgTrack }) }, [tab, athlete?.id, msgTrack, contactLatest, e2SelvKvittering])
  useEffect(() => { if (tab === 'beskeder') scrollContactEnd(contactLatest, messagesEndRef) }, [messages, tab, contactLatest])
  // eslint-disable-next-line react-hooks/exhaustive-deps -- begge er rene ift. athlete.id, som allerede er i deps
  useEffect(() => { if (tab === 'stævnedag' && athlete?.id) { fetchMeetPlan(athlete.id); fetchMeetResults(athlete.id) } }, [tab, athlete?.id])
  // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchVolumeLogs er ren ift. athleteId, som allerede er i deps
  useEffect(() => { if (tab === 'volumen' && athlete?.id) fetchVolumeLogs(athlete.id) }, [tab, athlete?.id])
  // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchFremgangLogs er ren ift. athleteId, som allerede er i deps
  useEffect(() => { if (tab === 'fremgang' && athlete?.id) fetchFremgangLogs(athlete.id) }, [tab, athlete?.id])
  // ORDRE 450 · blok 1: rekord-indekset holdes ajour.
  // (a) Den aktive uges spand er præcis ugens sæt, som telefonen kender dem
  //     (også køens og uden fortrudte); uger der er forbi, foldes ned i base.
  useEffect(() => {
    if (!athlete?.id || !currentWeek?.id) return
    const ugens = bygGrundlag(ugensSaet(exerciseLogs, currentWeek, allWeeks))
    // eslint-disable-next-line react-hooks/set-state-in-effect -- afledt af exerciseLogs; uændret indhold giver samme objekt, så React stopper her
    setRekordIndeks(prev => {
      const start = prev && prev.athleteId === athlete.id ? prev : tomtIndeks(athlete.id)
      const naeste = medUgensSaet(start, ugens, allWeeks, currentWeek)
      return prev && JSON.stringify(naeste) === JSON.stringify(prev) ? prev : naeste
    })
  }, [athlete?.id, currentWeek, allWeeks, exerciseLogs])
  // (b) Rækker nyere end indekset (første gang: hele historikken, én gang)
  //     hentes kun, når Dagens pas er vist (ugens sæt er hentet), og efter
  //     næste frame, så hentningen ikke står i vejen for kortet.
  useEffect(() => {
    if (!athlete?.id || !currentWeek?.id || ugensLogsHentet !== currentWeek.id || rekordHentetRef.current === athlete.id) return
    rekordHentetRef.current = athlete.id
    const athleteId = athlete.id
    const siden = hentSiden(indeksForAtlet)
    let stop = false
    let startet = false
    const raf = requestAnimationFrame(() => setTimeout(async () => {
      if (stop) return
      startet = true
      const rows = await fetchRekordRaekker(athleteId, siden)
      if (!mountedRef.current) return
      if (!rows) { rekordHentetRef.current = null; return }
      setRekordIndeks(prev => laegRaekkerTil(prev && prev.athleteId === athleteId ? prev : tomtIndeks(athleteId), rows, allWeeks, currentWeek))
    }, 0))
    return () => { if (startet) return; stop = true; cancelAnimationFrame(raf); if (rekordHentetRef.current === athleteId) rekordHentetRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- kører én gang pr. atlet, når ugens sæt er hentet; indekset læses ved start
  }, [athlete?.id, currentWeek, ugensLogsHentet])
  // (c) Åbnes Fremgang, er hele historikken der alligevel: den lægges også i indekset.
  useEffect(() => {
    if (!athlete?.id || !currentWeek?.id || !fremgangLogs) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- afledt af den netop hentede historik
    setRekordIndeks(prev => laegRaekkerTil(prev && prev.athleteId === athlete.id ? prev : tomtIndeks(athlete.id), fremgangLogs, allWeeks, currentWeek))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- kun når historikken er (gen)hentet
  }, [fremgangLogs])
  // (d) ... og gemmes på telefonen, så det også findes uden net.
  useEffect(() => {
    if (coachAthleteId || !session?.user?.id || !rekordIndeks) return
    saveRekordIndeks(session.user.id, rekordIndeks)
  }, [rekordIndeks, coachAthleteId, session?.user?.id])

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
    <Indlaeser {...{ backBtn, loadError }} />
  )

  if (!athlete) {
    return <IkkeKoblet {...{ backBtn, session }} />
  }

  const progressBars = (
    <ProgressBars {...{ athlete, kcalPct, proteinPct, totKcal, totProtein }} />
  )

  // Kompakt kost-status til forsiden: ét slankt, klikbart kort i stedet for to
  // store. Fylder minimalt når der ikke er logget noget ("mindre in your face"),
  // og viser tal + tynde bars når dagen er i gang. Kost-fanen har den fulde visning.
  const kostCompact = visKost && (
    <KostCompact {...{ athlete, kcalPct, proteinPct, setTab, totKcal, totProtein }} />
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
  // ORDRE 397: hvilke sæt der venter på net (markering pr. sæt i Dagens pas),
  // og sæt der aldrig kan gemmes, fordi coachen har slettet øvelsen.
  const pendingSyncKeys = pendingSyncCount > 0 ? pendingSetKeys(athlete.id) : []
  const parkedSets = Object.values(loadParkedSets(athlete.id))

  // Entropi 2: atletens egen forside erstatter den gamle hjem-visning og passtart.
  const e2Atlet = e2 && role === 'athlete' && !coachAthleteId && !onExitPreview && !!athlete?.id
  const e2Home = e2Atlet && tab === 'hjem'
  const toastSlot = (prToast || flash) ? (
    <ToastPlads {...{ flash, prToast, prToastFading }} />
  ) : null

  return (
    <div {...(forenklinger === true ? { 'data-app-375': 'athlete' } : {})} {...(e2Atlet ? { 'data-entropi2-athlete': '' } : {})} style={s.wrap}>
      <Ramme
        videoSetEnabled={videoSetEnabled}
        videoSetReady={videoSetReady && !!selectedVideoSet}
        videoSetPicker={{ options: videoOptions, choice: videoSetChoice, onChange: setVideoSetChoice,
          onContinue: () => setVideoSetReady(true), onClose: () => setAthleteVideoCoachOpen(false) }}
        {...{
          accountMenuOpen, askConfirm, athleteId: athlete?.id, athleteVideoCoachFrameRef, athleteVideoCoachInstant, athleteVideoCoachOpen, backBtn, confirmDialog, handleRecheckRole,
          onExitPreview, onRecheckRole, openRpePicker, recheckingRole, restartOnboardingGuide, role, setAccountMenuOpen, setConfirmDialog,
          setOpenRpePicker, setShowRpeGuide, showRpeGuide, undoDelete, undoPending, undoToast,
        }}
      />
      {/* Toast-pladsen (ORDRE 339 · F5): under topbaren på alle faner undtagen
          forsiden, hvor den ligger under overskrift + strimmel (se toastSlot). */}
      <IngenForbindelse {...{ offlineSnapshotAt }} />
      {(!(tab === 'hjem' && !onHoliday) || (enkelOn && ['uge', 'dagsform'].includes(route))) && toastSlot}
      {recheckMsg && !onExitPreview && (
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', letterSpacing: '0.04em', color: '#7a7770', textAlign: 'right', padding: '0.4rem 1.5rem 0' }}>{recheckMsg}</div>
      )}

      {/* Page content */}
      <div {...(forenklinger === true ? { 'data-app-375-page': '' } : {})} style={s.page}>

        {e2Home && (
          <HomeSession key={athlete.id} enabled={true} athlete={athlete} messages={messages} formatMsgTime={formatMsgTime}
            setTab={setTab} allWeeks={allWeeks} currentWeek={currentWeek} exerciseLogs={exerciseLogs} onHoliday={onHoliday}
            programError={programError} offlineSnapshotAt={offlineSnapshotAt} logInputs={logInputs} setLogInputs={setLogInputs}
            onLogSet={logDagensPasSet} parsePlannedRpe={parsePlannedRpe} setConfirm={setConfirm}
            pendingSyncKeys={pendingSyncKeys} parkedSets={parkedSets} restPause={restPause} />
        )}
        {!e2Home && tab === 'hjem' && !onHoliday && role === 'athlete' && !coachAthleteId && athlete?.id &&
          (!enkelOn || ['traening', 'alle'].includes(route)) &&
          rel1101Enabled(rel1101, typeof window === 'undefined' ? '' : window.location.search) &&
          <TrainingFullscreen key={athlete.id} allWeeks={allWeeks} currentWeek={currentWeek}
            exerciseLogs={exerciseLogs} logInputs={logInputs} setLogInputs={setLogInputs}
            onLogSet={logDagensPasSet} restPause={restPause} />}
        <NytIAppen rel1101={rel1101} search={typeof window === 'undefined' ? '' : window.location.search}
          role={role === 'athlete' && !coachAthleteId && !onExitPreview ? 'athlete' : null}
          profileId={session?.user?.id}
          onNavigate={nytAthleteNavigation({ setTab, setMsgTrack, setMobilityMode })} />

        {enkelOn && renderControls(createElement, { route, go: setTab })}
        {enkelOn && route === 'mere' && renderMore(createElement, { athlete, hasMeetPlan, go: setTab, visKost })}
        {enkelOn && route === 'mere' && homeworkEntry}
        {enkelOn && route === 'kontakt' && msgTrack === 'teknik' && role === 'athlete' && (
          <button type="button" style={{ ...s.btnPrimary, minHeight: 44 }} onClick={() => {
            if (!athlete?.id) return
            setAthleteVideoCoachInstant(true); setAthleteVideoCoachOpen(true)
          }}>Film et sæt</button>
        )}
        {enkelOn && route === 'uge' && !currentWeek && <p>Ingen programuge endnu.</p>}
        {/* HJEM */}
        {!homeRo2 && (<>
        {!compactHomework && (<>
        <MobilityHomeworkProgress enabled={mobilitetOpfoelgning === true && !coachAthleteId} athleteId={athlete?.id}>
        {tab === 'hjem' && (!enkelOn || ['traening', 'alle'].includes(route)) && <MobilityHomeworkHome key={athlete?.id} enabled={mobilitetHjemme} athleteId={athlete?.id} />}
        </MobilityHomeworkProgress>
        </>)}
        {compactHomework && renderHomeworkHome(createElement, { compact: compactHomework, tab, enkelOn, route, enabled: mobilitetHjemme, athleteId: athlete?.id, onOpen: openHomework, Home: MobilityHomeworkHome })}
        </>)}
        {renderMobilityShortcut(createElement, { enabled: mobilitetFokus === true || mobilitetCoach === true, tab, enkelOn, route, setMobilityMode, setTab, coachSummary: createElement(CoachMobilitySummary, { enabled: mobilitetCoach, athleteId: athlete?.id, notes: athlete?.notes }) })}

        {!e2Home && (!enkelOn || ['traening', 'uge', 'dagsform', 'alle'].includes(route)) && <HjemIndgang
          homeRo2={homeRo2}
          hviledageListe={hviledageListe === true}
          restMobility={restMobility}
          ugeLogget={ugeLogget === true}
          enkelDel={enkelOn && route !== 'alle' ? route : null}
          mobilitetFoerPas={mobilitetFoerPas === true}
          staevneHjem={staevneHjem === true}
          naesteTraening={naesteTraening === true}
          taskShortcuts={forenklinger === true && !enkelOn}
          setMsgTrack={setMsgTrack}
          {...{
            allWeeks, athlete, currentWeek, days, exerciseHistory, exerciseLogs, fetchForloebLogs, fetchSharedVideoAnalyses,
            forloebLoading, forloebLogs, formatMsgTime, holidayReturn, kostCompact, lastLoggedSet, lastReadiness, liftProgress,
            logDagensPasSet, logInputs, logWeight, mereOpen, messages, months, now, onHoliday, readinessOpen, setReadinessOpen,
            openReadiness, openSession, parkedSets, pendingSyncCount, pendingSyncKeys, prs, prsError, readinessCardRef, readinessError, readinessHistory,
            readinessInput, readinessLog, renderSharedFeedbackCards, restPause, role, saveReadiness, savingReadiness, savingWeight,
            setAthleteVideoCoachInstant, setAthleteVideoCoachOpen, setLogInputs, setMereOpen, setReadinessInput, setRestPause, setTab, setMobilityMode, setWeightInput,
            sharedVideoAnalyses, sharedVideoError, sharedVideoLoading, skipSet, suggestNextWeight, tab, toastSlot, undoLoggedSet,
            unreadMsgCount, updateLoggedSet, weeklyTonnage, weightInput, weightLogs, saveFeedback,
            rekordFejring, rekordGrundlagFoer, sendUgeLinje,
          }}
          homeworkEntry={homeworkEntry}
        />}
        {enkelOn && route === 'traening' && renderTrainingLinks(createElement, {
          messages, sharedVideoAnalyses, go: setTab, setMsgTrack,
        })}

        {/* PROGRAM */}
        {tab === 'program' && (
          <LazyBoundary
            factory={programFactory} label="Program" loading={<div style={s.page}>Indlæser…</div>}
            componentProps={{
              hviledageListe: hviledageListe === true, restMobility, WEEKDAYS_LONG, allWeeks, applyWarmupCorrection, askConfirm, athlete, autoCompleteSession,
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
              warmupOverrideTick, warmupSetEditing, weekStartDate, programIntensityHelp, programUgeFoerst, programNaesteUge, programBlokOversigt, fetchProgramBlockLogs, vaerdF6, opvarmStige,
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
        {e2Atlet && tab === 'fremgang' && (
          <Entropi2Analysis entropi2={true} athlete={athlete} currentWeek={currentWeek} exerciseLogs={exerciseLogs}
            fremgangLogs={fremgangLogs} fremgangLoading={fremgangLoading} setTab={setTab} />
        )}
        {tab === 'fremgang' && (
          <LazyBoundary
            factory={fremgangFokus === true ? fremgangFokusFactory : enkelOn ? enkelFremgangFactory : fremgangFactory} label="Fremgang" loading={<div style={s.page}>Indlæser…</div>}
            componentProps={repRecords === true ? (fremgangFokus === true ? { blokStyrke: blokStyrke === true, blokFremgang: blokFremgang === true, personalRecords: personalRecords === true, repRecords: repRecords === true, fremgangLinjer: fremgangLinjer === true, key: athlete?.id, enkelOn, weightLogs, enkelDel: enkelOn ? route : null, fremgangLogs, fremgangLoading, allWeeks, exerciseLogs, currentWeek } : { blokStyrke: blokStyrke === true, blokFremgang: blokFremgang === true, personalRecords: personalRecords === true, repRecords: repRecords === true, fremgangLinjer: fremgangLinjer === true, enkelDel: enkelOn ? route : null, fremgangLogs, fremgangLoading, allWeeks, exerciseLogs, currentWeek }) : fremgangFokus === true ? { blokStyrke: blokStyrke === true, blokFremgang: blokFremgang === true, personalRecords: personalRecords === true, fremgangLinjer: fremgangLinjer === true, key: athlete?.id, enkelOn, weightLogs, enkelDel: enkelOn ? route : null, fremgangLogs, fremgangLoading, allWeeks, exerciseLogs, currentWeek } : { blokStyrke: blokStyrke === true, blokFremgang: blokFremgang === true, personalRecords: personalRecords === true, fremgangLinjer: fremgangLinjer === true, enkelDel: enkelOn ? route : null, fremgangLogs, fremgangLoading, allWeeks, exerciseLogs, currentWeek }}
          />
        )}

        {/* KOST */}
        {e2Atlet && visKost && tab === 'kost' && (
          <Entropi2Kost enabled={true} athlete={athlete} date={kostDate} client={inboxDatabase} foods={e2Foods}
            onNavigate={route => setTab(route === 'analyse' ? 'fremgang' : route)} onCoach={() => setTab('beskeder')}
            weightLogs={weightLogs} weightInput={weightInput} savingWeight={savingWeight}
            {...(kostDate === e2Day ? { onWeightInput: setWeightInput, logWeight } : {})} />
        )}
        {!e2Atlet && visKost && tab === 'kost' && (
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
              confirmCompleteDay, showSaveTemplate, showTdee, showTemplates, startEditLog, tdeeEstimate,
              templateNameInput, totCarb, totFat, totKcal, totProtein, unitIdx,
            }}
          />
        )}

        {/* BESKEDER */}
        {e2Atlet && tab === 'beskeder' && (
          <ConversationEntry enabled={true} role="athlete" controllerRef={e2ConversationRef} getEntry={() => ({
            enabled: true, session, athlete, coachAthleteId, inboxDatabase,
            setAthleteVideoCoachInstant, setAthleteVideoCoachOpen, setOpenSharedVideoId, renderSharedFeedbackCards,
            storage: () => localStorage,
          })} />
        )}
        {!e2Atlet && tab === 'beskeder' && (
          <LazyBoundary
            factory={indbakke2 ? indbakke2Factory : beskederFactory} label="Beskeder" loading={<div style={s.page}>Indlæser…</div>}
            componentProps={{
              fetchSharedVideoAnalyses, formatMsgTime, messageInput, messagesEndRef, messages,
              msgTrack, renderSharedFeedbackCards, sendAthleteMessage, setMessageInput, setMsgTrack,
              sharedVideoAnalyses, sharedVideoError, sharedVideoLoading, contactLatest,
              inboxDatabase, athleteId: athlete?.id, inboxReadEnabled: indbakke2 && role === 'athlete' && !coachAthleteId,
              setMessages, setUnreadMsgCount,
            }}
          />
        )}

        {/* MOBILITET */}
        {e2Atlet && tab === 'mobilisering' && (
          <Entropi2Mobility enabled={true} athlete={athlete} allWeeks={allWeeks} currentWeek={currentWeek}
            exerciseLogs={exerciseLogs} now={e2MobilityNow} homeworkEnabled={mobilitetHjemme === true}
            coachEnabled={mobilitetCoach === true} storage={typeof localStorage === 'undefined' ? undefined : localStorage}
            onProgram={e2GoProgram} />
        )}
        {!e2Atlet && compactHomework && tab === 'mobilisering' && mobilityMode === 'hjemmeoevelser' && (
          <section aria-label="Dine hjemmeøvelser">
            <button type="button" style={{ minHeight: 44 }} onClick={() => setMobilityMode(null)}>← Til Mobilitet</button>
            <MobilityHomeworkProgress enabled={mobilitetOpfoelgning === true && !coachAthleteId} athleteId={athlete?.id}>
              <MobilityHomeworkHome key={athlete?.id} enabled={mobilitetHjemme} athleteId={athlete?.id} />
            </MobilityHomeworkProgress>
          </section>
        )}
        {!e2Atlet && tab === 'mobilisering' && !(compactHomework && mobilityMode === 'hjemmeoevelser') && (
          <LazyBoundary
            factory={mobiliseringFactory} label="Mobilitet" loading={<div style={s.page}>Indlæser…</div>}
            componentProps={{
              onFocusSelected: hviledagMobilitet === true ? focus => setRestFocus({ ...focus, athleteId: athlete?.id }) : undefined,
              mobilitetCoach: mobilitetCoach === true, coachNotes: athlete?.notes, mobilitetHjalp: mobilitetHjalp === true && !coachAthleteId, athleteId: athlete?.id, mobilityDate: today(), mobilitetFokus: mobilitetFokus === true, currentWeek, mobilityIntake, mobilityMode, mobilityPhase, mobilitySlots, mobilityStep,
              readinessLog, setTab, setMobilityIntake, setMobilityMode, setMobilityPhase, setMobilitySlots,
              setMobilityStep, setTimerActive, setTimerDone, setTimerSeconds, setWarmupChoice,
              setWarmupExercises, setWarmupFocus, setWarmupPhase, setWarmupProblems, setWarmupStep,
              setWarmupSubtype, timerActive, timerDone, timerSeconds, warmupChoice, warmupExercises,
              warmupFocus, warmupPhase, warmupProblems, warmupStep, warmupSubtype, warmupTemplates,
              homeworkEntry,
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
              setMeetWarmupOverrides, showFlash, staevnedagFokus,
            }}
          />
        )}
      </div>

      {enkelOn ? renderNav(createElement, { route, go: setTab, unreadMsgCount, sharedVideoAnalyses }) :
        <BundNav {...{ athlete, hasMeetPlan, setTab, sharedVideoAnalyses, tab, unreadMsgCount, visKost }} />}
    </div>
  )
}
