// Exact self-training hotfix delta only. The historic OFF inversions and hashes stay intact.
import assert from 'node:assert/strict'
// Exact initial-presentation feature only, before the unchanged historic inversions.
export const previewInitialSourceDeltas = [
  [
    "  }, [props.enabled, props.athlete, props.date, props.client, props.foods, props.weightLogs, props.weightStatus, props.retryWeight])\n  return props.enabled === true ? createElement('div', { ref: root, 'data-entropi2-kost': '' },\n    createElement('p', { role: 'status' }, 'Henter kostloggen… Her kan du se kost og vejning for den valgte dag. Registrering sker fra atletens egen visning.')) : null\n}\n",
    "  }, [props.enabled, props.athlete, props.date, props.client, props.foods, props.weightLogs, props.weightStatus, props.retryWeight])\n  return props.enabled === true ? createElement('div', { ref: root, 'data-entropi2-kost': '' }) : null\n}\n"
  ],
  [
    "\n  if ((!onboardingDone || guideOpen) && !coachAthleteId && !e2ReadOnly) {\n    return (\n",
    "\n  if ((!onboardingDone || guideOpen) && !coachAthleteId) {\n    return (\n"
  ],
  [
    "            <p>Senest hentede beskeder og delte videoer. Læst-kvitteringer er slået fra i forhåndsvisningen.</p>\n            <Conversation key={athlete.id} enabled={true} readOnly={true} createController={e2PreviewConversation}\n              initial={{ athleteId: athlete.id, messages, analyses: sharedVideoAnalyses }} />\n          </section>\n",
    "            <p>Senest hentede beskeder og delte videoer. Læst-kvitteringer er slået fra i forhåndsvisningen.</p>\n            <Conversation key={athlete.id} enabled={true} createController={e2PreviewConversation} />\n          </section>\n"
  ],
  [
    "            enabled: true, session, athlete, coachAthleteId: e2EgenCoach ? null : coachAthleteId, inboxDatabase,\n            messages, sharedVideoAnalyses,\n            setAthleteVideoCoachInstant, setAthleteVideoCoachOpen, setOpenSharedVideoId, renderSharedFeedbackCards,\n",
    "            enabled: true, session, athlete, coachAthleteId: e2EgenCoach ? null : coachAthleteId, inboxDatabase,\n            setAthleteVideoCoachInstant, setAthleteVideoCoachOpen, setOpenSharedVideoId, renderSharedFeedbackCards,\n"
  ]
]
export function invertPreviewInitialPresentation(source) {
  let restored = source.replace(/\r\n/g, '\n')
  for (const [added, previous] of previewInitialSourceDeltas) {
    assert.equal(restored.split(added).length, 2, 'Exact coach self-training / preview initial-presentation source delta: ' + added.slice(0, 90))
    restored = restored.replace(added, previous)
  }
  return restored
}

export const coachSelfSourceDeltas = [
  // Invert the E2-only skip bridge exactly; the historic OFF hash stays unchanged.
  ["            readOnly={e2ReadOnly} pendingSessionAction={pendingSessionAction}\n            {...(!e2ReadOnly ? { onSkipSet: skipSet, onSkipExercise: skipExercise, onUnskipSet: unskipSet } : {})}\n", ""],
  [
    "import { readInitialAnalysisWeight } from './entropi2/analysis/analysisWeight.mjs'\nimport { isCoachSelfTraining, guardTrainingActions, createTrainingLifetime } from './coachSelfTraining.mjs'\n\n",
    "import { readInitialAnalysisWeight } from './entropi2/analysis/analysisWeight.mjs'\n\n"
  ],
  [
    "\nexport default function AthleteView({ opvarmStige = false, hviledageListe = false, programNaesteUge = false, videoSetSelection = VIDEO_SET_SELECTION_ENABLED, mobilitetCoach = false, mobilitetHjemme = false, mobilitetOpfoelgning = false, mobilitetHjalp = false, session, onExitPreview, role, coachAthleteId, coachSelfTraining, trainingAccess, onRecheckRole, enkelPrototype = false, forenklinger = false, programUgeFoerst = false, programBlokOversigt = false, fremgangFokus = false, naesteTraening = false, personalRecords = false, repRecords = false, staevnedagFokus = false, staevneHjem = false, fremgangLinjer = false, mobilitetFoerPas = false, hviledagMobilitet = false, mobilitetFokus = false, kostPerAtlet, kostValg, blokStyrke = false, blokFremgang = false, vaerdF6 = false, ugeLogget = false , previewInitialTab = 'hjem', programIntensityHelp = false, hjemoevKompakt = false, rel1101 = false, entropi2}) {\n  const indbakke2 = indbakke2Enabled(typeof window === 'undefined' ? '' : window.location.search)\n",
    "\nexport default function AthleteView({ opvarmStige = false, hviledageListe = false, programNaesteUge = false, videoSetSelection = VIDEO_SET_SELECTION_ENABLED, mobilitetCoach = false, mobilitetHjemme = false, mobilitetOpfoelgning = false, mobilitetHjalp = false, session, onExitPreview, role, coachAthleteId, onRecheckRole, enkelPrototype = false, forenklinger = false, programUgeFoerst = false, programBlokOversigt = false, fremgangFokus = false, naesteTraening = false, personalRecords = false, repRecords = false, staevnedagFokus = false, staevneHjem = false, fremgangLinjer = false, mobilitetFoerPas = false, hviledagMobilitet = false, mobilitetFokus = false, kostPerAtlet, kostValg, blokStyrke = false, blokFremgang = false, vaerdF6 = false, ugeLogget = false , previewInitialTab = 'hjem', programIntensityHelp = false, hjemoevKompakt = false, rel1101 = false, entropi2}) {\n  const indbakke2 = indbakke2Enabled(typeof window === 'undefined' ? '' : window.location.search)\n"
  ],
  [
    "  const mountedRef = useRef(true)\n  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false } }, [])\n  async function handleRecheckRole() {\n",
    "  const mountedRef = useRef(true)\n  useEffect(() => () => { mountedRef.current = false }, [])\n  async function handleRecheckRole() {\n"
  ],
  [
    "  const [athlete, setAthlete] = useState(null)\n  const ownCoach = role === 'coach' && !!athlete?.id &&\n    typeof session?.user?.id === 'string' && !!session.user.id &&\n    (!coachAthleteId || coachAthleteId === athlete.id) &&\n    (athlete.user_id === session.user.id || isCoachSelfTraining(coachSelfTraining, { session, role, athlete, coachAthleteId }))\n  const e2EgenCoach = e2 && ownCoach\n  const e2ReadOnly = e2 && !!athlete?.id && !e2EgenCoach &&\n",
    "  const [athlete, setAthlete] = useState(null)\n  // MIN TRÆNING and Se som atlet share coachAthleteId; only the loaded user's profile is writable.\n  const e2EgenCoach = e2 && role === 'coach' && !!athlete?.id &&\n    typeof session?.user?.id === 'string' && !!session.user.id && athlete.user_id === session.user.id &&\n    (!coachAthleteId || coachAthleteId === athlete.id)\n  const e2ReadOnly = e2 && !!athlete?.id && !e2EgenCoach &&\n"
  ],
  [
    "  const route = enkelRoute === 'kost' && !visKost ? 'traening' : enkelRoute\n  const trainingLifetime = useMemo(() => createTrainingLifetime({ ownerId: session?.user?.id, role, coachAthleteId, coachSelfTraining, trainingAccess, athlete }),\n    [session?.user?.id, role, coachAthleteId, coachSelfTraining, trainingAccess, athlete])\n  const trainingCurrentRef = useRef(null)\n  // eslint-disable-next-line react-hooks/refs -- event-time identity fence, updated before callbacks can run\n  trainingCurrentRef.current = trainingLifetime\n  useEffect(() => { trainingLifetime.activate(); return () => trainingLifetime.dispose() }, [trainingLifetime])\n  const canUseTrainingSession = () => trainingLifetime.isActive() && trainingCurrentRef.current === trainingLifetime && mountedRef.current &&\n    (trainingAccess === undefined || trainingAccess?.isActive?.() === true)\n  const canWriteTraining = () => canUseTrainingSession() && !!athlete?.id && !!session?.user?.id && (role === 'coach'\n      ? ownCoach && (athlete.user_id === session.user.id || isCoachSelfTraining(coachSelfTraining, { session, role, athlete, coachAthleteId }))\n      : role === 'athlete' && !coachAthleteId && !onExitPreview && athlete.user_id === session.user.id)\n  const guardWrite = client => trainingLifetime.guardClient(client, canWriteTraining)\n  const guardSession = client => trainingLifetime.guardSessionClient(client, canUseTrainingSession)\n  // ORDRE 263 · commit 2: den automatiske pause mellem sæt (null = ingen\n",
    "  const route = enkelRoute === 'kost' && !visKost ? 'traening' : enkelRoute\n  // ORDRE 263 · commit 2: den automatiske pause mellem sæt (null = ingen\n"
  ],
  [
    "    sendUgeLinje,\n  } = guardTrainingActions(lavBeskederOgVaegt({\n    athlete, messageInput, msgTrack, onReadError, openSharedVideoId, setMessageInput, setMessages, setOpenSharedVideoId,\n",
    "    sendUgeLinje,\n  } = lavBeskederOgVaegt({\n    athlete, messageInput, msgTrack, onReadError, openSharedVideoId, setMessageInput, setMessages, setOpenSharedVideoId,\n"
  ],
  [
    "    ...(e2 ? { setWeightStatus, weightReadRef } : {}),\n    guardWrite,\n  }), canWriteTraining, [\"logWeight\", \"markTrackRead\", \"sendAthleteMessage\", \"sendUgeLinje\"])\n\n",
    "    ...(e2 ? { setWeightStatus, weightReadRef } : {}),\n  })\n\n"
  ],
  [
    "    cLen, fLen, tdeeEstimate,\n  } = guardTrainingActions(lavKostHandlinger({\n    amount, athlete, createFood, customFoods, editGrams, editMacros, historicalMealLogs, kostDate,\n",
    "    cLen, fLen, tdeeEstimate,\n  } = lavKostHandlinger({\n    amount, athlete, createFood, customFoods, editGrams, editMacros, historicalMealLogs, kostDate,\n"
  ],
  [
    "    showFlash, templateNameInput, undoPending, undoTimerRef, undoToast, unitIdx, weightLogs,\n    guardWrite,\n  }), canWriteTraining, [\"confirmCompleteDay\", \"quickLogFood\", \"copyYesterday\", \"saveTemplate\", \"logTemplate\", \"deleteTemplate\", \"addFromSearch\", \"quickAddSearchFood\", \"saveCustomFood\", \"deleteLog\", \"undoDelete\", \"saveEditLog\"])\n\n",
    "    showFlash, templateNameInput, undoPending, undoTimerRef, undoToast, unitIdx, weightLogs,\n  })\n\n"
  ],
  [
    "    fetchExerciseLogs, fetchProgramBlockLogs,\n  } = guardTrainingActions(lavLaesninger({\n    indbakke2,\n",
    "    fetchExerciseLogs, fetchProgramBlockLogs,\n  } = lavLaesninger({\n    indbakke2,\n"
  ],
  [
    "    ...(e2 ? { setExerciseLogsStatus, exerciseLogsReadRef } : {}),\n    guardWrite, guardSession, isSessionCurrent: canUseTrainingSession,\n  }), canWriteTraining, [\"saveReadiness\", \"completeOnboardingGuide\", \"advanceOnboardingGuide\"])\n  // Read the latest athlete/week without replacing the open session or its draft.\n",
    "    ...(e2 ? { setExerciseLogsStatus, exerciseLogsReadRef } : {}),\n  })\n  // Read the latest athlete/week without replacing the open session or its draft.\n"
  ],
  [
    "    saveFeedback, autoCompleteSession, skipRemainingSets,\n  } = guardTrainingActions(lavSaetSkrivning({\n    allWeeks, athlete, currentWeek, exerciseLogs, feedbackInputs, fetchExerciseLogs, fetchPastLogs, lastLogByExerciseName,\n",
    "    saveFeedback, autoCompleteSession, skipRemainingSets,\n  } = lavSaetSkrivning({\n    allWeeks, athlete, currentWeek, exerciseLogs, feedbackInputs, fetchExerciseLogs, fetchPastLogs, lastLogByExerciseName,\n"
  ],
  [
    "    rekordGrundlagFoer, setRekordFejring, fejredeRef,\n    guardWrite,\n  }), canWriteTraining, [\"logSet\", \"logDagensPasSet\", \"flushOfflineSets\", \"undoLoggedSet\", \"updateLoggedSet\", \"skipSet\", \"skipExercise\", \"unskipSet\", \"saveFeedback\", \"autoCompleteSession\", \"skipRemainingSets\"])\n  // ORDRE 406 (O1 i docs/kritik-403): lytterne nedenfor registreres én gang pr.\n",
    "    rekordGrundlagFoer, setRekordFejring, fejredeRef,\n  })\n  // ORDRE 406 (O1 i docs/kritik-403): lytterne nedenfor registreres én gang pr.\n"
  ]
]
export function invertCoachSelfTraining(source) {
  let restored = invertPreviewInitialPresentation(source)
  for (const [added, previous] of coachSelfSourceDeltas) {
    assert.equal(restored.split(added).length, 2, 'Exact coach self-training source delta: ' + added.slice(0, 90))
    restored = restored.replace(added, previous)
  }
  return restored.replace(/\n/g, '\r\n')
}

export const coachSelfSetDeltas = [
  [
    "// som en fabrik, samme moenster som kostHandlinger.js.\nimport { supabase as database, queueWrite } from '../supabase.js'\nimport { nextAthleteSetInput } from '../athleteTrainingInputs.js'\n",
    "// som en fabrik, samme moenster som kostHandlinger.js.\nimport { supabase, queueWrite } from '../supabase.js'\nimport { nextAthleteSetInput } from '../athleteTrainingInputs.js'\n"
  ],
  [
    "  rekordGrundlagFoer, setRekordFejring, fejredeRef,\n  guardWrite = client => client,\n}) {\n  const supabase = guardWrite(database)\n  // ORDRE 439 · blok 1: er sættet en ny rekord? Regnes mod alle ANDRE sæt:\n",
    "  rekordGrundlagFoer, setRekordFejring, fejredeRef,\n}) {\n  // ORDRE 439 · blok 1: er sættet en ny rekord? Regnes mod alle ANDRE sæt:\n"
  ]
]
export function invertTrainingSetWrites(source) {
  let restored = source.replace(/\r\n/g, '\n')
  for (const [added, previous] of coachSelfSetDeltas) {
    assert.equal(restored.split(added).length, 2, 'Exact coach self-training writer delta: ' + added.slice(0, 90))
    restored = restored.replace(added, previous)
  }
  return restored
}
