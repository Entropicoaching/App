import { readMeetSource } from './coachMeetSource.mjs'
import { readCoachActivity } from './coachInactive.mjs'
import { readBlockLogs } from '../blokFremgang.mjs'
import { readFourWeekSource } from './coachFourWeeks.mjs'
import { COACH_NOTE_SIGNAL_ENABLED } from '../coachNoteSignal.js'
import { dataAllowed } from '../dataEnough.mjs'
import { rpeSignalEvidence, rpeSignalDescription } from '../dataEvidence.mjs'
import { readMorningSource } from './coachMorningSource.mjs'
import { attachVideoReferences } from '../videoEvidence.mjs'
import { dataEnoughEnabled } from '../dataEnough.mjs'
import { addWeekRpe, readWeekData, plannedSetCount, isThisCoachWeek } from './coachWeekOverview.mjs'
// ORDRE 377: flyttet uændret fra src/Dashboard.jsx (se docs/DASHBOARD-KORT.md).
// Alt coachens side henter: atleter, kalender, indbakke (signaler, videoer,
// automatiseringsfejl, set-markeringer, beskeder), program, logs, VideoCoach-
// historik, vægt, parathed, PR, stævner, opvarmning. Handler-fabrik som i
// src/athlete/laesninger.js (ordre 373): Dashboard kalder den i hvert render
// med de navne funktionerne bruger, så det er de samme closures som før.
import { summarizeRefreshResults, filterDraftVideoReviews, filterOpenTrainingSignals, summarizeCoachMessages } from '../coachInboxState.js'
import { supabase, withRetry } from '../supabase.js'
import { filterOpenAutomationAlerts } from '../automationAlerts.js'
import { saetSmerteSignaler, medSaetSmerte } from '../saetSmerte.js'
import { ATHLETE_LOGS_LIMIT } from './coachKonstanter.js'
import { planlagteReps, taellerIKg, logTegn } from './afvigelse.js'
import { VIDEOCOACH_BASELINE_VERSION } from '../videoCoachVersion.js'
import { normaliserRekorder, bedsteRekorder, tungeRekorder } from '../personalRecords.js'
import { danskDag } from '../danskDato.js'
import { COACH_ACTIONS_ENABLED, coachActionsEnabled, actionSessions } from './coachActions.mjs'

// Read receipts travel with existing props; the legacy/OFF readers never call this boundary.
const requests = new WeakMap()
// Last athlete whose rows were confirmed per setter: a refresh of the same athlete keeps those rows
// visible (no blank "Henter …" after every program edit) until the new answer or an error arrives.
const shownReady = new WeakMap()

function beginCoachTabRead({ setter, athleteId, retry, current = () => true }) {
  const token = {}
  requests.set(setter, token)
  const isCurrent = () => requests.get(setter) === token && current()
  const receipt = state => ({ athleteId, state, retry, current })
  return {
    current: isCurrent,
    rows: (rows, state = 'ready') => Object.assign([...rows], { coachRead: receipt(state) }),
    form: (form, state) => ({ ...form, coachRead: receipt(state) }),
  }
}

async function readCoachTabRows(options) {
  const { setter, query, map = rows => rows, limit = Infinity, publish = setter } = options
  const read = beginCoachTabRead(options)
  if (shownReady.get(setter) !== options.athleteId) publish(read.rows([], 'loading'))
  try {
    const { data, error } = await query()
    if (!read.current()) return false
    if (error || !Array.isArray(data)) throw Error('unconfirmed read')
    if (data.some(row => row.athlete_id != null && row.athlete_id !== options.athleteId)) throw Error('wrong athlete')
    const state = data.length >= limit ? 'incomplete' : 'ready'
    if (state === 'ready') shownReady.set(setter, options.athleteId); else shownReady.delete(setter)
    publish(read.rows(map(data), state))
    return true
  } catch {
    if (read.current()) { shownReady.delete(setter); publish(read.rows([], 'error')) }
    return false
  }
}

// Entropi 2: flaggeneration pr. Dashboard, nøglet på den stabile setCalendarWeeks. Den øges, når
// læseren bygges med en anden flagtilstand end sidst (et flagskift på samme instans). Et svar fra
// en læsning, der startede før skiftet, kasseres derfor i begge tilstande. Ændres flaget aldrig,
// ændres generationen aldrig, og læserne er uændrede.
const e2Generations = new WeakMap()
function e2Generation(owner, on) {
  if (typeof owner !== 'function') return null
  let generation = e2Generations.get(owner)
  if (!generation) { generation = { on, n: 0 }; e2Generations.set(owner, generation) }
  else if (generation.on !== on) { generation.on = on; generation.n++ }
  return generation
}

export function lavLaesninger({
  coachTabCleanup = false, blokFremgang = false,
  coachMeetSoon = false, setCoachMeetData = () => {},
  fourWeekCapture, profileWeekCapture, coachMorning = false, setCoachMorningData = () => {},
  coachWeekEnabled = false, setCoachWeekDataStatus = () => {},

  coachActions = COACH_ACTIONS_ENABLED, setCoachActionsStatus = () => {}, entropi2CalendarRead, entropi2ReadGate,
  inboxRefreshRunnerRef, messageThreadAthleteRef, session, setAthleteCurrentWeek, setAthleteLastLogs, setAthleteLogs,
  setAthletePRHistory, setAthletePRs, setAthleteReadiness, setAthletes, setAthleteWeekCompletion, setAthleteWeekSummary,
  setAthleteWeightLogs, setAutomationAlerts, setAutomationAlertsError, setCalendarWeeks, setCoachBriefingSeen, setExerciseLibrary,
  setHiddenAthleteIds, setInboxRefreshing, setInboxRefreshStatus, setLastBackup, setLatestByTrack, setLoadError, setPendingByTrack,
  setLoading, setMeetPlan, setMeetPlanForm, setMeetResults, setMessageInboxError, setMessageInput,
  setMessages, setMessageSendError, setMessageThreadError, setProfilesLastSeen, setSnoozedAthletes, setTodayData,
  setTrainingSignals, setTrainingSignalsError, setUnreadByTrack, setUnreadCounts, setVideoAnalyses, setVideoAnalysisError,
  setVideoAnalysisLoading, setVideoBaselines, setVideoReviewQueue, setVideoReviewQueueError, setWarmupTemplates, setWeeklyActivity,
  setWeeks, videoCoachAthletesRef, currentProgramAthleteRef,
}) {
  const e2Gen = e2Generation(setCalendarWeeks, typeof entropi2CalendarRead === 'function')
  // Entropi 2 runde 13: Entropi 2 seams are only passed with the flag ON; the legacy ?coachMorgen=1 path keeps its day contract.
  const morningStartDay = { startDay: typeof entropi2CalendarRead === 'function' || typeof entropi2ReadGate === 'function' }
  // Den senest byggede læser på samme instans; en genstart efter et flagskift går altid gennem den.
  if (e2Gen) e2Gen.fetchAthletes = fetchAthletes
  const e2Started = () => e2Gen?.n
  const e2Replaced = started => e2Gen !== null && e2Gen.n !== started
  const tabReads = coachTabCleanup === true && typeof entropi2CalendarRead === 'function'
  function tabOptions(setter, athleteId, retry) {
    const generation = e2Started()
    return { setter, athleteId, retry: () => retry(athleteId),
      current: () => !e2Replaced(generation) && (!currentProgramAthleteRef || currentProgramAthleteRef.current === athleteId) }
  }
  async function refreshCoachInbox() {
    return inboxRefreshRunnerRef.current(async () => {
      setInboxRefreshing(true)
      try {
        const athleteIds = videoCoachAthletesRef.current.map(athlete => athlete.id)
        const requests = [fetchTodayActivity(), fetchVideoReviewQueue(), fetchTrainingSignals(), fetchAutomationAlerts(), fetchCoachBriefingSeen()]
        if (athleteIds.length) {
          requests.push(fetchLatestMessages(athleteIds))
          if (dataEnoughEnabled()) requests.push(fetchCalendarWeeks(athleteIds), fetchCalendarProgress(athleteIds))
        }
        // Entropi 2 (kun når Dashboard giver læseren kontekstfunktionen): coachskærmens øvrige grundlag
        // fornyes ved hver indbakkeopdatering, også med en tom atletliste og efter midnat.
        // De indgår ikke i den gamle opdateringsstatus.
        const e2Requests = []
        if (typeof entropi2CalendarRead === 'function') {
          if (!athleteIds.length || !dataEnoughEnabled()) e2Requests.push(fetchCalendarWeeks(athleteIds))
          if (athleteIds.length && !dataEnoughEnabled()) e2Requests.push(fetchCalendarProgress(athleteIds))
          if (athleteIds.length) e2Requests.push(fetchAthleteActivityLogs(athleteIds))
        }
        const results = await Promise.allSettled(requests)
        setInboxRefreshStatus(summarizeRefreshResults(results))
        await Promise.allSettled(e2Requests)
      } finally {
        setInboxRefreshing(false)
      }
    })
  }

  async function fetchLastBackup() {
    const { data } = await supabase.from('profiles').select('last_backup_at').eq('id', session.user.id).maybeSingle()
    if (data?.last_backup_at) setLastBackup(data.last_backup_at)
  }

  async function fetchAthletes() {
    // Entropi 2: kun den senest startede atletlæsning må sætte atleter, skjulte, fejl og indlæsning.
    const e2Gate = typeof entropi2ReadGate === 'function' ? entropi2ReadGate(setLoading, 'athletes') : null
    const generation = e2Started()
    // Fælles læseidentitet på tværs af flagtilstande: kun den senest startede atletlæsning må sætte state.
    const athleteRead = e2Gen ? (e2Gen.athleteRead = (e2Gen.athleteRead || 0) + 1) : 0
    setLoadError(false)
    const { data, error } = await withRetry(() => supabase.from('athletes').select('*').order('name'))
    if (e2Gate && !e2Gate.current()) return
    // Svaret er fra før et flagskift og kasseres. Atletlæsningen startes kun ved mount, så der startes
    // straks en ny, ellers kunne loading blive stående true.
    if (e2Replaced(generation)) return (e2Gen.fetchAthletes || fetchAthletes)()
    // Uden flagskift og med flaget slukket er adfærden uændret; ellers kasseres en afløst læsning.
    if (e2Gen && (e2Gen.on || e2Gen.n > 0) && e2Gen.athleteRead !== athleteRead) return
    // Reel fejl efter retries: vis fejl/retry i stedet for misvisende "ingen atleter".
    if (error) { setLoadError(true); setLoading(false); return }
    setAthletes(data || [])
    setHiddenAthleteIds(new Set((data || []).filter(a => a.hidden).map(a => a.id)))
    // Snooze synces nu via athletes.snooze_until i DB (cross-device), ikke localStorage.
    setSnoozedAthletes(Object.fromEntries((data || []).filter(a => a.snooze_until).map(a => [a.id, a.snooze_until])))
    if (data?.length) {
      // ORDRE 184: fetchLatestMessages hentes IKKE her længere. Appens
      // startvisning er altid enten 'list' eller 'inbox' (coachInboxEntryIntent
      // har ingen tredje mulighed), og refreshCoachInbox() henter beskeder for
      // ALLE atleter ved præcis samme mount (linje ~736 nedenfor) — kaldet her
      // var derfor et rent duplikat af samme forespørgsel ved HVER sideindlæsning,
      // ikke kun ved faneskift (se docs/VALG-184.md). markMessagesRead() og
      // andre skrive-stier kalder allerede fetchLatestMessages eksplicit selv
      // bagefter, så ingen anden sti mister sin opdatering.
      fetchProfilesLastSeen(data)
      fetchAthleteWeekSummaries(data.map(a => a.id))
      fetchAthleteActivityLogs(data.map(a => a.id))
    }
    setLoading(false)
  }

  // Mandag i indeværende ISO-uge (lokal tid), som Date kl. 00:00.
  function isoMonday(d = new Date()) {
    const x = new Date(d)
    const day = (x.getDay() + 6) % 7 // 0=mandag
    x.setDate(x.getDate() - day)
    x.setHours(0, 0, 0, 0)
    return x
  }

  // ORDRE 193: fetchWeeklyActivity og fetchAthleteLastLogs hentede hver sin
  // variant af PRÆCIS samme tabel/kolonner (exercise_logs, athlete_id +
  // logged_at, samme athlete_id/skipped-filter) — kun tidsvinduet var
  // forskelligt, og den ubegrænsede (fetchAthleteLastLogs, "alle logs,
  // nyeste først") er allerede en overmængde af den anden ("kun denne uges
  // logs"). Slået sammen til ét kald; begge tal udledes client-side af
  // samme rækker. Fjerner én hel rundtur (forespørgsel + dens CORS-preflight)
  // fra forsidens kritiske kæde uden at ændre hvad der vises.
  async function fetchAthleteActivityLogs(athleteIds) {
    if (!athleteIds.length) return
    const { data } = await readCoachActivity(coachActions, athleteIds, setCoachActionsStatus, () => readMorningSource(coachMorning, 'logs', athleteIds, setCoachMorningData, () => supabase
      .from('exercise_logs')
      .select('athlete_id, logged_at')
      .in('athlete_id', athleteIds)
      .eq('skipped', false)
      .order('logged_at', { ascending: false }), morningStartDay))
    if (!data) return
    const lastLogMap = {}
    for (const log of data) {
      // ORDRE 456 (A8): dagen i dansk tid, ikke UTC.
      if (!lastLogMap[log.athlete_id]) lastLogMap[log.athlete_id] = danskDag(log.logged_at)
    }
    setAthleteLastLogs(lastLogMap)

    const mondayIso = isoMonday().toISOString()
    const weekMap = {}
    for (const log of data) {
      if (log.logged_at < mondayIso) continue
      const aid = log.athlete_id
      if (!weekMap[aid]) weekMap[aid] = { dates: new Set(), sets: 0 }
      weekMap[aid].dates.add(danskDag(log.logged_at))
      weekMap[aid].sets++
    }
    const weekSummary = {}
    for (const aid in weekMap) weekSummary[aid] = { sessions: weekMap[aid].dates.size, sets: weekMap[aid].sets }
    setWeeklyActivity(weekSummary)
  }

  async function fetchAthleteWeekSummaries(athleteIds) {
    if (!athleteIds.length) return
    const { data } = await supabase
      .from('weeks')
      .select('athlete_id, week_number, block_name, start_date, sessions(id)')
      .in('athlete_id', athleteIds)
    if (!data) return
    const summary = {}
    for (const w of data) {
      const aid = w.athlete_id
      const sessionCount = (w.sessions || []).length
      if (!summary[aid]) {
        summary[aid] = { week_number: w.week_number, block_name: w.block_name, start_date: w.start_date, session_count: sessionCount }
      } else {
        // Prefer latest week with sessions; if tie or no sessions anywhere, prefer highest week_number
        const cur = summary[aid]
        const curHasSess = cur.session_count > 0
        const newHasSess = sessionCount > 0
        if (newHasSess && (!curHasSess || w.week_number > cur.week_number)) {
          summary[aid] = { week_number: w.week_number, block_name: w.block_name, start_date: w.start_date, session_count: sessionCount }
        } else if (!newHasSess && !curHasSess && w.week_number > cur.week_number) {
          summary[aid] = { week_number: w.week_number, block_name: w.block_name, start_date: w.start_date, session_count: sessionCount }
        }
      }
    }
    setAthleteWeekSummary(summary)
  }

  async function fetchCalendarWeeks(athleteIds) {
    // Entropi 2: ejer, anmodede atlet-id'er og afslutningsdag bindes til netop denne læsnings resultat.
    // Funktionen gives kun med flaget tændt (Dashboard, via entropi2/coachEntry.mjs); ellers er læseren uændret.
    const e2Read = typeof entropi2CalendarRead === 'function' && coachActionsEnabled(coachActions)
      ? entropi2CalendarRead({ enabled: true, coachId: session?.user?.id, athleteIds, setStatus: setCoachActionsStatus }) : null
    const generation = e2Started()
    if (!athleteIds.length) {
      if (coachActionsEnabled(coachActions)) {
        const empty = {}
        setCalendarWeeks(empty)
        setCoachActionsStatus(prev => ({ ...prev, calendar: 'ready' }))
        e2Read?.done(empty)
      }
      return
    }
    const status = value => { if (coachActionsEnabled(coachActions)) setCoachActionsStatus(prev => ({ ...prev, calendar: value })) }
    status('loading')
    try {
    // ORDRE 277 · commit 1: `sets`/`recommended_weight` tilføjet til selectet
    // (samme forespørgsel, ingen ny rundtur) — giver "planlagt denne uge"
    // (sæt + tonnage, src/dashboard/afvigelse.js) uden at ændre hvad
    // kalender-tidslinjen selv viser (session_count/exercise_count uændret).
    if (dataEnoughEnabled()) setCalendarWeeks(prev => Object.fromEntries(Object.entries(prev || {}).map(([id, rows]) => [id, rows.map(w => ({ ...w, readEvidence: { athleteId: id, complete: false } }))])))
    const query = supabase
      .from('weeks')
      .select('id, athlete_id, week_number, block_name, start_date, sessions(id, session_order, athlete_rating, athlete_comment, exercises(id, sets, reps, recommended_weight))')
      .in('athlete_id', athleteIds)
    const { data, error } = await readMeetSource(coachMeetSoon, 'plan', athleteIds, setCoachMeetData, () => readWeekData(coachWeekEnabled, () => (dataEnoughEnabled() ? query.limit(1000) : query), setCoachWeekDataStatus, 'plan'))
    // Entropi 2: et svar fra en læsning, som en nyere har afløst, overskriver hverken kalender eller status.
    if (e2Read && !e2Read.current()) { e2Read.settle(); return dataEnoughEnabled() ? false : undefined }
    if (e2Replaced(generation)) { e2Read?.settle(); return dataEnoughEnabled() ? false : undefined }
    if (!data || ((dataEnoughEnabled() || coachActionsEnabled(coachActions)) && error)) { status('error'); e2Read?.settle(); return dataEnoughEnabled() ? false : undefined }
    const map = coachActionsEnabled(coachActions) ? Object.fromEntries(athleteIds.map(id => [id, []])) : {}
    for (const w of data) {
      if (!map[w.athlete_id]) map[w.athlete_id] = []
      const sessions = w.sessions || []
      const exercises = sessions.flatMap(sess => sess.exercises || [])
      let plannedSets = 0
      let plannedTonnage = 0
      for (const ex of exercises) {
        const sets = Number(ex.sets) || 0
        plannedSets += sets
        // Tonnage kan kun regnes for øvelser med en anbefalet vægt — uden
        // den er der intet kg-tal at sammenligne imod (samme grænse som
        // src/dashboard/afvigelse.js's egen dokumentation).
        // ORDRE 428 (C3): sæt × reps × vægt, samme regning som gennemført
        // (vægt × reps pr. sæt) og kun for de samme øvelser (taellerIKg).
        if (taellerIKg(ex)) plannedTonnage += sets * planlagteReps(ex.reps) * Number(ex.recommended_weight)
      }
      map[w.athlete_id].push({
        id: w.id,
        ...(dataEnoughEnabled() ? { planSessions: sessions, readEvidence: { athleteId: w.athlete_id, complete: data.length < 1000 } } : {}),
        week_number: w.week_number,
        block_name: w.block_name,
        start_date: w.start_date,
        ...(coachActionsEnabled(coachActions) ? { actionSessions: actionSessions(sessions) } : {}),
        session_count: sessions.length,
        exercise_count: exercises.length,
        planned_sets: plannedSets,
        ...(coachWeekEnabled ? { coachWeekPlannedSets: exercises.every(ex => plannedSetCount(ex.sets) != null) && Number.isSafeInteger(plannedSets) ? plannedSets : null } : {}),
        planned_tonnage: plannedTonnage,
        // ORDRE 428 (C2): ugens pas med atletens vurdering og kommentar.
        session_voices: sessions.map(sess => ({ order: sess.session_order, rating: sess.athlete_rating, comment: sess.athlete_comment })),
      })
    }
    // Sortér uger pr. atlet efter ugenummer (stigende)
    for (const aid in map) map[aid].sort((a, b) => a.week_number - b.week_number)
    setCalendarWeeks(map)
    status('ready')
    e2Read?.done(map)
    return dataEnoughEnabled() ? data.length < 1000 : undefined
    } catch (error) {
      if (!coachActionsEnabled(coachActions)) throw error
      if (e2Read && !e2Read.current()) { e2Read.settle(); return }
      if (e2Replaced(generation)) { e2Read?.settle(); return }
      status('error')
      e2Read?.settle()
    }
  }

  async function fetchCalendarProgress(athleteIds) {
    if (!athleteIds.length) {
      if (coachActionsEnabled(coachActions)) {
        setAthleteCurrentWeek({}); setAthleteWeekCompletion({})
        setCoachActionsStatus(prev => ({ ...prev, progress: 'ready' }))
      }
      return
    }
    const status = value => { if (coachActionsEnabled(coachActions)) setCoachActionsStatus(prev => ({ ...prev, progress: value })) }
    // Entropi 2: et afløst svar sætter hverken fremdrift eller status (heller ikke fejl).
    const e2Gate = typeof entropi2ReadGate === 'function' && coachActionsEnabled(coachActions) ? entropi2ReadGate(setCoachActionsStatus, 'progress') : null
    const generation = e2Started()
    status('loading')
    try {
    const since = new Date(); since.setDate(since.getDate() - 180)
    // ORDRE 277 · commit 1: weight/reps_completed/skipped tilføjet til
    // selectet (samme forespørgsel som allerede fandt "hvilken uge er
    // atleten i nu" via seneste log) — giver "gennemført denne uge" (sæt +
    // tonnage, pr. programuge) uden endnu en rundtur.
    if (dataEnoughEnabled()) setAthleteWeekCompletion(prev => Object.fromEntries(Object.entries(prev || {}).map(([id, byWeek]) => [id, Object.fromEntries(Object.entries(byWeek).map(([wn, c]) => [wn, { ...c, readEvidence: { athleteId: id, complete: false } }]))])))
    const query = supabase
      .from('exercise_logs')
      .select((coachWeekEnabled ? 'rpe_actual, rpe_planned, ' : '') + (dataEnoughEnabled() ? 'athlete_id, exercise_id, set_number, logged_at, weight, reps_completed, skipped, note, exercises(reps, recommended_weight, sessions(id, session_order, weeks(' + (coachWeekEnabled ? 'id, ' : '') + 'week_number)))' : 'athlete_id, logged_at, weight, reps_completed, skipped, note, exercises(reps, recommended_weight, sessions(id, session_order, weeks(' + (coachWeekEnabled ? 'id, ' : '') + 'week_number)))'))
      .in('athlete_id', athleteIds)
      .gte('logged_at', since.toISOString())
      .order('logged_at', { ascending: false })
    const { data, error } = await readMeetSource(coachMeetSoon, 'logs', athleteIds, setCoachMeetData, () => readWeekData(coachWeekEnabled, () => (dataEnoughEnabled() ? query.limit(1000) : query), setCoachWeekDataStatus, 'logs'))
    if (e2Gate && !e2Gate.current()) return dataEnoughEnabled() ? false : undefined
    if (e2Replaced(generation)) return dataEnoughEnabled() ? false : undefined
    if (!data || ((dataEnoughEnabled() || coachActionsEnabled(coachActions)) && error)) { status('error'); return dataEnoughEnabled() ? false : undefined }
    const overviewToday = new Date()
    const map = {}
    const completion = coachActionsEnabled(coachActions) ? Object.fromEntries(athleteIds.map(id => [id, {}])) : {}
    for (const log of data) {
      if (map[log.athlete_id] == null) { // har allerede den seneste for denne atlet
        const wn = log.exercises?.sessions?.weeks?.week_number
        if (wn != null) map[log.athlete_id] = wn
      }
      const wn = log.exercises?.sessions?.weeks?.week_number
      if (wn == null) continue
      const aid = log.athlete_id
      if (!completion[aid]) completion[aid] = {}
      const weekId = log.exercises?.sessions?.weeks?.id
      const keys = coachWeekEnabled && weekId != null ? [wn, `id:${weekId}`] : [wn]
      for (const key of keys) {
      if (!completion[aid][key]) completion[aid][key] = { sets: 0, tonnage: 0, pas: 0, sprungneSaet: 0, saetUnderPlan: 0, sessionIds: {}, notes: [] }
      const c = completion[aid][key]
      if (coachWeekEnabled) {
        if (isThisCoachWeek(log.logged_at, overviewToday)) {
          if (!log.skipped) c.coachWeekSets = (c.coachWeekSets || 0) + 1
        }
        addWeekRpe(c, log)
      }
      if (dataEnoughEnabled()) {
        c.readEvidence = { athleteId: aid, complete: data.length < 1000 }
        c.evidenceRows = [...(c.evidenceRows || []), log]
      }
      // ORDRE 428 (C2): sæt-noter tælles også fra sprungne sæt (atleten
      // skriver ofte hvorfor).
      if (log.note) c.notes.push({ order: log.exercises?.sessions?.session_order, note: log.note })
      // ORDRE 1588: RPE-uafhængige tegn (skip, færre reps end planlagt).
      const tegn = logTegn(log)
      if (tegn.sprunget) c.sprungneSaet += 1
      if (tegn.underPlan) c.saetUnderPlan += 1
      if (log.skipped) continue
      c.sets += 1
      // ORDRE 428 (C3): kun øvelser der også tæller i planlagt kg.
      if (taellerIKg(log.exercises)) c.tonnage += (Number(log.weight) || 0) * (Number(log.reps_completed) || 0)
      const sid = log.exercises?.sessions?.id
      if (sid && !c.sessionIds[sid]) { c.sessionIds[sid] = true; c.pas += 1 }
      }
    }
    setAthleteCurrentWeek(map)
    setAthleteWeekCompletion(completion)
    status('ready')
    return dataEnoughEnabled() ? data.length < 1000 : undefined
    } catch (error) {
      if (!coachActionsEnabled(coachActions)) throw error
      if (e2Gate && !e2Gate.current()) return
      if (e2Replaced(generation)) return
      status('error')
    }
  }

  async function fetchProfilesLastSeen(athletesList) {
    const userIds = athletesList.map(a => a.user_id).filter(Boolean)
    if (!userIds.length) return
    const { data } = await supabase.from('profiles').select('id, last_seen').in('id', userIds)
    if (data) {
      const map = {}
      for (const p of data) map[p.id] = p.last_seen
      setProfilesLastSeen(map)
    }
  }

  // Kun dagens træningslogs. Beskedindbakken drives af fetchLatestMessages,
  // så vi ikke henter de samme beskeder gennem to parallelle dataveje.
  async function fetchTodayActivity() {
    const todayStr = new Date().toISOString().slice(0, 10)
    const { data, error } = await supabase.from('exercise_logs')
      .select('athlete_id, logged_at')
      .gte('logged_at', todayStr)
      .limit(2000)
    if (error) return false
    setTodayData({ logs: data || [] })
    return true
  }

  // Coachens samlede VideoCoach-indbakke. Kun kladder hentes, og listen
  // indeholder kun metadata nok til at finde den rigtige atlet og måling.
  // ORDRE 266 · commit 1: rep_details/metrics/bar_path tilføjet til selectet
  // (ingen migration - samme kolonner AnalyseTabs "Gennemgå måling" allerede
  // læser), så videoCoachMeasurementSummary kan vise en allerede-sporet
  // måling i atletlisten uden en ekstra Supabase-forespørgsel.
  async function fetchVideoReviewQueue() {
    setVideoReviewQueueError(null)
    const { data, error } = await readMorningSource(coachMorning, 'videos', null, setCoachMorningData, () => supabase.from('video_analyses')
      .select('id,client_analysis_id,athlete_id,lift,variation,load_kg,reps_count,rep_details,metrics,bar_path,analyzed_at,created_at,source_mode,status,session_context,analysis_state,video_path')
      .eq('status', 'draft')
      .order('created_at', { ascending: false })
      .limit(50), morningStartDay)
    if (error) {
      setVideoReviewQueueError(error.message || 'VideoCoach-køen kunne ikke hentes')
      return false
    }
    setVideoReviewQueue(filterDraftVideoReviews(data))
    return true
  }

  // Forklarlige signaler fra den fælles SQL-motor. Indbakken viser kun forhold,
  // der har nok datagrundlag og fortjener et kig; "ok" og "insufficient" støjer ikke.
  async function fetchTrainingSignals() {
    setTrainingSignalsError(null)
    const [signalsResult, actionsResult] = await Promise.all([
      supabase.rpc('entropi_training_signals_v1'),
      supabase.from('coach_signal_actions')
        .select('athlete_id,detector,signal_fingerprint,snoozed_until'),
    ])
    if (signalsResult.error) {
      setTrainingSignalsError(signalsResult.error.message || 'Træningssignaler kunne ikke hentes')
      return false
    }
    if (actionsResult.error) {
      setTrainingSignalsError(actionsResult.error.message || 'Signalhandlinger kunne ikke hentes')
      return false
    }
    // Ordre 1560: smerte i saet-noter (14 dage) som signal med loeft og dato; en fejl her laesser aldrig de andre signaler.
    let saetSignaler = []
    try {
      const siden = new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString()
      const noteResult = await supabase.from('exercise_logs')
        .select('athlete_id,note,logged_at,exercise_id,exercises(name)')
        .not('note', 'is', null).gte('logged_at', siden).limit(2000)
      if (!noteResult.error) saetSignaler = saetSmerteSignaler(noteResult.data, videoCoachAthletesRef.current)
    } catch { /* signalerne uden saet-note-smerte vises stadig */ }
    let signals = signalsResult.data || []
    if (dataEnoughEnabled()) {
      const today = new Date().toLocaleDateString('en-CA')
      const since = new Date(Date.now() - 22 * 86400000).toISOString()
      signals = await Promise.all(signals.map(async item => {
        if (!['rpe_drift', 'data_conflict'].includes(item.o_detector)) return item
        try {
          const history = await supabase.from('exercise_logs')
            .select('id,athlete_id,exercise_id,set_number,weight,reps_completed,note,rpe_actual,rpe_planned,logged_at,skipped,exercises(name,session_id)')
            .eq('athlete_id', item.o_athlete_id).gte('logged_at', since).limit(2000)
          const checks = item.o_detector === 'data_conflict' ? await supabase.from('readiness_logs')
            .select('*').eq('athlete_id', item.o_athlete_id).gte('logged_date', since.slice(0, 10)).limit(100) : { data: [] }
          if (history.error || checks.error || !Array.isArray(history.data) || history.data.length >= 2000) return item
          const evidence = rpeSignalEvidence(history.data, checks.data || [], today, item.o_metrics?.top_lift, item.o_detector === 'data_conflict')
          return dataAllowed('D16', evidence) ? { ...item, data_evidence: evidence,
            o_headline: 'Registreret RPE-afvigelse', o_detail: rpeSignalDescription(evidence) } : item
        } catch { return item }
      }))
    }
    setTrainingSignals(filterOpenTrainingSignals(medSaetSmerte(signals, saetSignaler), actionsResult.data))
    return true
  }

  // ORDRE 301: uløste automatiseringsfejl. RLS lader authenticated læse
  // tabellen; ingen atlet i rækkerne, kun workflow/node/tidspunkt.
  async function fetchAutomationAlerts() {
    setAutomationAlertsError(null)
    const { data, error } = await supabase.from('automation_alerts')
      .select('id,workflow_id,workflow_name,failed_node,execution_id,mode,occurred_at,resolved_at')
      .is('resolved_at', null)
      .order('occurred_at', { ascending: false })
      .limit(50)
    if (error) {
      setAutomationAlertsError(error.message || 'Automatiseringsfejl kunne ikke hentes')
      return false
    }
    setAutomationAlerts(filterOpenAutomationAlerts(data))
    return true
  }

  // ORDRE 325: coach_briefing_seen findes ikke i produktion endnu (SQL-filen
  // koeres foerst efter Marcs ja) — en fejlet HENTNING her er derfor det
  // forventede normaltilstand indtil da, ikke noget der skal larme ved hver
  // opdatering (Set-KNAPPEN fejler synligt for sig, se handleCoachBriefingSeen).
  async function fetchCoachBriefingSeen() {
    const { data, error } = await supabase.from('coach_briefing_seen')
      .select('point_key,seen_at')
      .eq('coach_id', session.user.id)
    if (error) {
      setCoachBriefingSeen({})
      return true
    }
    setCoachBriefingSeen(Object.fromEntries((data || []).map(row => [row.point_key, row.seen_at])))
    return true
  }

  async function fetchWeeks(athleteId) {
    if (tabReads) return readCoachTabRows({ ...tabOptions(setWeeks, athleteId, fetchWeeks),
      limit: 1000,
      query: () => readFourWeekSource(fourWeekCapture, 'weeks', athleteId, () => supabase
        .from('weeks').select('*, sessions(*, exercises(*))').eq('athlete_id', athleteId).order('week_number').limit(1000)),
      map: rows => rows.map(w => ({ ...w, sessions: (w.sessions || [])
        .sort((a, b) => (a.session_order - b.session_order) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
        .map(s => ({ ...s, exercises: (s.exercises || []).sort((a, b) => (a.exercise_order - b.exercise_order) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)) })) })),
      publish: rows => setWeeks(dataEnoughEnabled() ? Object.assign(rows, {
        readEvidence: { athleteId, complete: rows.coachRead.state === 'ready' } }) : rows),
    })
    if (dataEnoughEnabled()) setWeeks(prev => Object.assign([...prev], { readEvidence: { athleteId, complete: false } }))
    const { data, error } = await readFourWeekSource(fourWeekCapture, 'weeks', athleteId, () => {
      const query = supabase
      .from('weeks')
      .select('*, sessions(*, exercises(*))')
      .eq('athlete_id', athleteId)
      .order('week_number')
      return dataEnoughEnabled() ? query.limit(1000) : query
    })
    if (currentProgramAthleteRef && currentProgramAthleteRef.current !== athleteId) return
    const readWeeks = (data || []).map(w => ({
      ...w,
      sessions: (w.sessions || [])
        // Sekundær sortering på id giver dage med ens session_order en STABIL,
        // deterministisk rækkefølge — samme som reorderSession bruger, så ↑↓
        // altid flytter den dag man tror.
        .sort((a, b) => (a.session_order - b.session_order) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
        .map(s => ({ ...s, exercises: (s.exercises || []).sort((a, b) => (a.exercise_order - b.exercise_order) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)) }))
    }))
    setWeeks(dataEnoughEnabled() ? Object.assign(readWeeks, { readEvidence: { athleteId, complete: !error && Array.isArray(data) && data.length < 1000 } }) : readWeeks)
  }

  async function fetchExerciseLibrary() {
    const { data } = await supabase.from('exercise_library').select('*').order('category').order('name')
    setExerciseLibrary(data || [])
  }

  async function fetchLatestMessages(athleteIds) {
    try {
      const { data, error } = await readMorningSource(coachMorning, 'messages', athleteIds, setCoachMorningData, () => supabase.from('messages').select('*').in('athlete_id', athleteIds).order('created_at', { ascending: false }), morningStartDay)
      if (error) throw error

      const summary = summarizeCoachMessages(data, { noteSignalEnabled: COACH_NOTE_SIGNAL_ENABLED })
      setUnreadCounts(summary.unreadCounts)
      setUnreadByTrack(summary.unreadByTrack)
      setLatestByTrack(summary.latestByTrack)
      if (COACH_NOTE_SIGNAL_ENABLED) setPendingByTrack(summary.pendingByTrack)
      setMessageInboxError(null)
      return true
    } catch {
      // Behold sidste kendte indbakke, så en kort forbindelsesfejl ikke ligner nul beskeder.
      setMessageInboxError('Beskeder kunne ikke opdateres. Prøv igen.')
      return false
    }
  }

  async function fetchMessages(athleteId) {
    if (messageThreadAthleteRef.current !== athleteId) {
      messageThreadAthleteRef.current = athleteId
      setMessages([])
      setMessageInput('')
      setMessageThreadError(null)
      setMessageSendError(null)
    }

    try {
      const { data, error } = await readFourWeekSource(profileWeekCapture, 'messages', athleteId, () => supabase.from('messages').select('*').eq('athlete_id', athleteId).order('created_at'))
      if (messageThreadAthleteRef.current !== athleteId) return
      if (error) throw error
      setMessages(data || [])
      setMessageThreadError(null)
    } catch {
      if (messageThreadAthleteRef.current !== athleteId) return
      setMessageThreadError('Samtalen kunne ikke opdateres. Prøv igen.')
    }
  }

  async function fetchAthleteLogs(athleteId) {
    if (tabReads) return readCoachTabRows({ ...tabOptions(setAthleteLogs, athleteId, fetchAthleteLogs),
      limit: ATHLETE_LOGS_LIMIT,
      query: () => readFourWeekSource(fourWeekCapture, 'logs', athleteId, () => blokFremgang === true
        ? readBlockLogs(supabase, athleteId)
        : supabase.from('exercise_logs')
          .select('id, athlete_id, set_number, weight, reps_completed, note, logged_at, rpe_actual, rpe_planned, skipped, exercise_id, exercises(id, name, sets, reps, intensity, recommended_weight, session_id, sessions(id, title, athlete_rating, athlete_comment, weeks(week_number, block_name)))')
          .eq('athlete_id', athleteId).order('logged_at', { ascending: false }).limit(ATHLETE_LOGS_LIMIT)),
      publish: rows => setAthleteLogs(dataEnoughEnabled() ? Object.assign(rows, {
        readEvidence: { athleteId, complete: rows.coachRead.state === 'ready' } }) : rows),
    })
    if (dataEnoughEnabled()) setAthleteLogs(prev => Object.assign([...prev], { readEvidence: { athleteId, complete: false } }))
    if (blokFremgang === true) {
      // Both opt-ins share the same scoped read and its error state.
      const { data, error } = await readFourWeekSource(fourWeekCapture, 'logs', athleteId,
        () => readBlockLogs(supabase, athleteId))
      setAthleteLogs(dataEnoughEnabled() ? Object.assign(error ? [] : data, { readEvidence: { athleteId, complete: !error && Array.isArray(data) && data.length < ATHLETE_LOGS_LIMIT } }) : error ? [] : data)
      return
    }
    const { data, error } = await readFourWeekSource(fourWeekCapture, 'logs', athleteId, () => supabase
      .from('exercise_logs')
      .select('id, athlete_id, set_number, weight, reps_completed, note, logged_at, rpe_actual, rpe_planned, skipped, exercise_id, exercises(id, name, sets, reps, intensity, recommended_weight, session_id, sessions(id, title, athlete_rating, athlete_comment, weeks(week_number, block_name)))')
      .eq('athlete_id', athleteId)
      .order('logged_at', { ascending: false })
      .limit(ATHLETE_LOGS_LIMIT))
    setAthleteLogs(dataEnoughEnabled() ? Object.assign(data || [], { readEvidence: { athleteId, complete: !error && Array.isArray(data) && data.length < ATHLETE_LOGS_LIMIT } }) : data || [])
  }

  async function fetchVideoCoachHistory(athleteId) {
    if (tabReads) {
      const read = beginCoachTabRead(tabOptions(setVideoAnalyses, athleteId, fetchVideoCoachHistory))
      setVideoAnalysisLoading(true)
      setVideoAnalysisError(null)
      setVideoAnalyses([])
      setVideoBaselines([])
      try {
        const [history, baseline] = await Promise.all([
          readFourWeekSource(fourWeekCapture, 'videos', athleteId, () => supabase.from('video_analyses')
            .select('id,client_analysis_id,athlete_id,source_mode,lift,variation,load_kg,rpe,reps_count,status,analyzed_at,created_at,low_conf_pct,position_quality_pct,quality_flags,metrics,session_context,athlete_feedback,findings,engine_version,tracker_version,analysis_state,video_path,bar_path')
            .eq('athlete_id', athleteId).order('analyzed_at', { ascending: false }).limit(30)),
          supabase.from('athlete_baselines_v3')
            .select('lift,variation,metric_key,metric_method,baseline_version,median,mad,n_analyses,n_reps,last_analyzed_at')
            .eq('athlete_id', athleteId).eq('baseline_version', VIDEOCOACH_BASELINE_VERSION).order('last_analyzed_at', { ascending: false }),
        ])
        if (!read.current()) return
        if (history.error || baseline.error || !Array.isArray(history.data) || !Array.isArray(baseline.data)) throw Error('unconfirmed video read')
        setVideoAnalyses(history.data)
        setVideoBaselines(dataEnoughEnabled() ? attachVideoReferences(baseline.data, history.data) : baseline.data)
      } catch {
        if (read.current()) setVideoAnalysisError('Videoanalyserne kunne ikke hentes. Prøv igen.')
      } finally {
        if (read.current()) setVideoAnalysisLoading(false)
      }
      return
    }
    setVideoAnalysisLoading(true)
    setVideoAnalysisError(null)
    const [historyResult, baselineResult] = await Promise.all([
      readFourWeekSource(fourWeekCapture, 'videos', athleteId, () => supabase.from('video_analyses')
        .select('id,client_analysis_id,athlete_id,source_mode,lift,variation,load_kg,rpe,reps_count,status,analyzed_at,created_at,low_conf_pct,position_quality_pct,quality_flags,metrics,session_context,athlete_feedback,findings,engine_version,tracker_version,analysis_state,video_path,bar_path')
        .eq('athlete_id', athleteId)
        .order('analyzed_at', { ascending: false })
        .limit(30)),
      supabase.from('athlete_baselines_v3')
        .select('lift,variation,metric_key,metric_method,baseline_version,median,mad,n_analyses,n_reps,last_analyzed_at')
        .eq('athlete_id', athleteId)
        .eq('baseline_version', VIDEOCOACH_BASELINE_VERSION)
        .order('last_analyzed_at', { ascending: false }),
    ])
    if (historyResult.error || baselineResult.error) {
      setVideoAnalysisError(historyResult.error?.message || baselineResult.error?.message ||
        'Videoanalyserne kunne ikke hentes')
      setVideoAnalyses(historyResult.data || [])
      setVideoBaselines(dataEnoughEnabled() ? attachVideoReferences(baselineResult.data || [], historyResult.error ? [] : historyResult.data || []) : baselineResult.data || [])
    } else {
      setVideoAnalyses(historyResult.data || [])
      setVideoBaselines(dataEnoughEnabled() ? attachVideoReferences(baselineResult.data || [], historyResult.error ? [] : historyResult.data || []) : baselineResult.data || [])
    }
    setVideoAnalysisLoading(false)
  }

  async function fetchAthleteWeightLogs(athleteId) {
    const { data } = await supabase
      .from('weight_logs')
      .select('*')
      .eq('athlete_id', athleteId)
      .order('logged_at', { ascending: false })
      .limit(90)
    setAthleteWeightLogs(data || [])
  }

  async function fetchAthleteReadiness(athleteId) {
    if (tabReads) return readCoachTabRows({ ...tabOptions(setAthleteReadiness, athleteId, fetchAthleteReadiness),
      // This is a deliberate recent window, not a claim about the athlete's entire history.
      query: () => supabase.from('readiness_logs').select('*').eq('athlete_id', athleteId)
        .order('logged_date', { ascending: false }).limit(90),
    })
    const { data } = await supabase
      .from('readiness_logs')
      .select('*')
      .eq('athlete_id', athleteId)
      .order('logged_date', { ascending: false })
      .limit(90)
    setAthleteReadiness(data || [])
  }

  async function fetchAthletePRs(athleteId) {
    if (tabReads) return readCoachTabRows({ ...tabOptions(setAthletePRs, athleteId, fetchAthletePRs),
      query: () => supabase.from('personal_records').select('*').eq('athlete_id', athleteId).order('logged_at', { ascending: false }),
      publish: rows => {
        const heavy = tungeRekorder(rows)
        setAthletePRs(Object.assign(bedsteRekorder(heavy), { coachRead: rows.coachRead }))
        setAthletePRHistory(Object.assign(normaliserRekorder(heavy), { coachRead: rows.coachRead }))
      },
    })
    const { data } = await supabase
      .from('personal_records')
      .select('*')
      .eq('athlete_id', athleteId)
      .order('logged_at', { ascending: false })
    if (!data) { setAthletePRs([]); setAthletePRHistory([]); return }
    // ORDRE 456 (A5): dubletter fra før 456 vises kun én gang (personalRecords.js).
    const tunge = tungeRekorder(data)
    setAthletePRHistory(normaliserRekorder(tunge))
    // Vis den tungeste registrering pr. øvelse som rekord — ikke blot den seneste —
    // så et lavere (fx stævne-)løft aldrig vises som aktuel rekord.
    setAthletePRs(bedsteRekorder(tunge))
  }

  async function fetchMeetResults(athleteId) {
    if (tabReads) return readCoachTabRows({ ...tabOptions(setMeetResults, athleteId, fetchMeetResults),
      query: () => supabase.from('meet_results').select('*').eq('athlete_id', athleteId).order('meet_date', { ascending: false }),
    })
    const { data } = await supabase
      .from('meet_results')
      .select('*')
      .eq('athlete_id', athleteId)
      .order('meet_date', { ascending: false })
    setMeetResults(data || [])
  }

  async function fetchMeetPlan(athleteId) {
    if (tabReads) {
      const read = beginCoachTabRead(tabOptions(setMeetPlanForm, athleteId, fetchMeetPlan))
      setMeetPlanForm(prev => read.form(prev, 'loading'))
      try {
        const { data, error } = await supabase.from('meet_plans').select('*').eq('athlete_id', athleteId).maybeSingle()
        if (!read.current()) return
        if (error || data?.athlete_id && data.athlete_id !== athleteId) throw Error('unconfirmed plan read')
        setMeetPlan(data || null)
        setMeetPlanForm(read.form({ meet_type: data?.meet_type || 'sbd',
          squat1: data?.squat1 ?? '', squat2: data?.squat2 ?? '', squat3: data?.squat3 ?? '',
          bench1: data?.bench1 ?? '', bench2: data?.bench2 ?? '', bench3: data?.bench3 ?? '',
          dead1: data?.dead1 ?? '', dead2: data?.dead2 ?? '', dead3: data?.dead3 ?? '', notes: data?.notes || '',
        }, 'ready'))
      } catch {
        if (read.current()) setMeetPlanForm(prev => read.form(prev, 'error'))
      }
      return
    }
    const { data } = await supabase.from('meet_plans').select('*').eq('athlete_id', athleteId).maybeSingle()
    setMeetPlan(data || null)
    setMeetPlanForm({
      meet_type: data?.meet_type || 'sbd',
      squat1: data?.squat1 ?? '', squat2: data?.squat2 ?? '', squat3: data?.squat3 ?? '',
      bench1: data?.bench1 ?? '', bench2: data?.bench2 ?? '', bench3: data?.bench3 ?? '',
      dead1: data?.dead1 ?? '', dead2: data?.dead2 ?? '', dead3: data?.dead3 ?? '',
      notes: data?.notes || '',
    })
  }

  async function fetchWarmupTemplates(athleteId) {
    const { data } = await supabase
      .from('warmup_templates')
      .select('*')
      .or(`athlete_id.eq.${athleteId},athlete_id.is.null`)
    setWarmupTemplates(data || [])
  }

  return {
    refreshCoachInbox, fetchLastBackup, fetchAthletes, isoMonday, fetchAthleteActivityLogs, fetchAthleteWeekSummaries,
    fetchCalendarWeeks, fetchCalendarProgress, fetchProfilesLastSeen, fetchTodayActivity, fetchVideoReviewQueue, fetchTrainingSignals,
    fetchAutomationAlerts, fetchCoachBriefingSeen, fetchWeeks, fetchExerciseLibrary, fetchLatestMessages, fetchMessages,
    fetchAthleteLogs, fetchVideoCoachHistory, fetchAthleteWeightLogs, fetchAthleteReadiness, fetchAthletePRs, fetchMeetResults,
    fetchMeetPlan, fetchWarmupTemplates,
  }
}
