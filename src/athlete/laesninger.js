// Laesningerne (atlet, program, saet-logs, historik, parathed, PR, staevne,
// volumen, fremgang, forloeb, opvarmning, delte videoer), parathed-gem,
// vaegtforslag, navigation (openSession/openReadiness) og onboarding-guidens
// handlere — flyttet uaendret ud af AthleteView.jsx (ordre 373) som en fabrik,
// samme moenster som kostHandlinger.js.
import { supabase, withRetry, queueWrite } from '../supabase'
import { mergeAthleteSetInputs } from '../athleteTrainingInputs'
import { hasCompletedOnboardingGuide, isLastOnboardingGuideStep } from '../athleteOnboardingGuide'
import { runGuardedRead } from '../athleteReadGuard'
import { clearReadinessDraft } from '../readinessDraft'
import { loadRestPause } from '../restPause'
import { estimatedOneRepMax, HOVEDLOEFT_FAMILIER } from '../exerciseProgress'
import { fremgangLogsQuery, fremgangLogsKronologisk } from '../fremgangLogs'
import { today } from '../athleteShared'
import { computeActiveWeekIdx, weekFullyLogged, parsePlannedRpe, logFrontendError } from './ugeHjaelp'
import { isUuid } from './videoCoachBro'

export function lavLaesninger({
  athlete, coachAthleteId, currentWeek, exerciseHistory, fetchAthleteMessages, fetchCustomFoods, fetchFrequentFoods, fetchHistoricalMealLogs,
  fetchLogs, fetchMealTemplates, fetchWeightLogs, guideStep, mountedRef, onReadError, readinessCardRef, readinessInput,
  role, session, sessionRefs, setAllWeeks, setAthlete, setCurrentWeek, setExerciseHistory, setExerciseLogs,
  setForloebLoading, setForloebLogs, setFremgangLoading, setFremgangLogs, setGuideOpen, setGuideStep, setHasMeetPlan, setLastLogByExerciseName,
  setLastReadiness, setLiftProgress, setLoadError, setLoading, setLogInputs, setMeetAttempts, setMeetPlanNotes, setMeetResults,
  setMeetType, setMereOpen, setOnboardingDone, setOpenSharedVideoId, setPastLogs, setProgOpenSession, setProgramError, setPrs,
  setPrsError, setReadinessError, setReadinessHistory, setReadinessLog, setRestPause, setSavingReadiness, setSharedVideoAnalyses, setSharedVideoError,
  setSharedVideoLoading, setTab, setViewingWeekIdx, setVolumeLoading, setVolumeLogs, setWarmupTemplates, setWeeklyTonnage,
}) {
  async function fetchAthlete() {
    if (!coachAthleteId && role !== 'athlete') { setLoading(false); return }
    let data
    let error
    if (coachAthleteId) {
      ({ data, error } = await withRetry(() =>
        supabase.from('athletes').select('*').eq('id', coachAthleteId).maybeSingle()
      ))
    } else {
      ({ data, error } = await withRetry(() =>
        supabase.from('athletes').select('*').eq('user_id', session.user.id).maybeSingle()
      ))
      if (!error && !data) {
        const claim = await withRetry(() => supabase.rpc('claim_athlete_profile_v3'))
        if (claim.error || !isUuid(claim.data)) {
          setLoadError(true)
          return
        }
        ({ data, error } = await withRetry(() =>
          supabase.from('athletes').select('*')
            .eq('user_id', session.user.id)
            .eq('id', claim.data)
            .maybeSingle()
        ))
        if (!error && !data) {
          setLoadError(true)
          return
        }
      }
    }
    // Reel fejl: vis fejl/retry-skærmen i stedet for misvisende "ikke tilknyttet".
    // (Bliver i loading-tilstanden, som renderer loadError-grenen med "Prøv igen".)
    if (error) { setLoadError(true); return }
    if (data) {
      if (!coachAthleteId) {
        supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', session.user.id)
        setOnboardingDone(hasCompletedOnboardingGuide(data))
      }
      setAthlete(data)
      // ORDRE 263 · commit 2: en igangværende pause overlever et lukket/
      // genåbnet vindue (persisteret i localStorage, se restPause.js) —
      // genindlæses her, ét kald, samme sted som resten af login-opstarten.
      setRestPause(loadRestPause(data.id))
      // Ordre 163 · del 4 (billig gevinst, ingen ny state-model): det der
      // faktisk vises først — "hjem" er standardfanen — hentes med det
      // samme. Resten (kost/beskeder/opvarmning/stævne, alt på faner
      // brugeren endnu ikke har åbnet) udskydes ét tick med setTimeout(0),
      // så disse kald ikke konkurrerer om de første forbindelser/båndbredde
      // med det der rent faktisk skal males på skærmen på en langsom profil.
      fetchProgram(data.id)
      fetchLogs(data.id)
      fetchReadiness(data.id)
      setTimeout(() => {
        fetchCustomFoods(data.id)
        fetchMealTemplates(data.id)
        fetchHistoricalMealLogs(data.id)
        fetchFrequentFoods(data.id)
        fetchAthleteMessages(data.id)
        fetchWeightLogs(data.id)
        fetchPRs(data.id)
        fetchWarmupTemplates(data.id)
        fetchMeetPlan(data.id)
        fetchMeetResults(data.id)
      }, 0)
    }
    setLoading(false)
  }

  async function fetchSharedVideoAnalyses() {
    setSharedVideoLoading(true)
    setSharedVideoError(null)
    const { data, error } = await supabase.rpc('get_my_shared_video_analyses_v3', {
      p_limit: 6,
      p_offset: 0,
    })
    if (error) {
      setSharedVideoError(error.message || 'Dine analyser kunne ikke hentes')
      setSharedVideoLoading(false)
      return
    }
    const analyses = Array.isArray(data) ? data.filter(item => item && item.id) : []
    setSharedVideoAnalyses(analyses)
    setOpenSharedVideoId(analyses[0]?.id || null)
    setSharedVideoLoading(false)
  }

  // G3 (ordre 163 · del 3): "Personlige rekorder" var kaldet der fejlede ved
  // åbning. Det stoppede allerede ikke resten af siden (runGuardedRead), men
  // meldte fejlen med onReadError's app-brede røde toast for noget der kun
  // rører ét kort. Nu: fejlen markeres kun i selve "Dine rekorder"-kortet
  // (prsError, se render nedenfor), og der forsøges roligt igen i baggrunden
  // med stigende ventetid — uden at brugeren skal røre noget.
  async function fetchPRs(athleteId, attempt = 0) {
    const { data, ok } = await runGuardedRead(
      () => supabase
        .from('personal_records')
        .select('exercise_name, weight, reps, created_at')
        .eq('athlete_id', athleteId)
        .order('created_at', { ascending: false }),
      (error) => {
        logFrontendError('Personlige rekorder kunne ikke hentes', error, athleteId)
        if (mountedRef.current) setPrsError(true)
      },
    )
    if (!ok) {
      if (attempt < 3) {
        setTimeout(() => { if (mountedRef.current) fetchPRs(athleteId, attempt + 1) }, 1500 * (attempt + 1))
      }
      return
    }
    if (!mountedRef.current) return
    setPrsError(false)
    setPrs(data || [])
  }

  async function fetchMeetPlan(athleteId) {
    const { data, ok } = await runGuardedRead(
      () => supabase.from('meet_plans').select('*').eq('athlete_id', athleteId).maybeSingle(),
      onReadError('Stævneplanen', athleteId),
    )
    if (!ok) return
    setHasMeetPlan(!!data)
    if (data) {
      setMeetType(data.meet_type || 'sbd')
      setMeetPlanNotes(data.notes || '')
      setMeetAttempts({
        squat:    [{ w: data.squat1 ?? '', r: null }, { w: data.squat2 ?? '', r: null }, { w: data.squat3 ?? '', r: null }],
        bench:    [{ w: data.bench1 ?? '', r: null }, { w: data.bench2 ?? '', r: null }, { w: data.bench3 ?? '', r: null }],
        deadlift: [{ w: data.dead1  ?? '', r: null }, { w: data.dead2  ?? '', r: null }, { w: data.dead3  ?? '', r: null }],
      })
    }
  }

  // ORDRE 259 · commit 1: samme kilde (exercise_logs) som coachens
  // fetchAthleteLogs (Dashboard.jsx). ORDRE 259 · commit 2: udvidet fra
  // ~8 dage til ~5 uger — nok til VolumenTab.jsx's "seneste 4 uger"-trend
  // med en uges margin til ugegrænser, stadig uden coachens fulde
  // 2000-sæt-historik. Ingen rettelser (exercise_muscle_overrides) hentes
  // her — atleten har ikke læseadgang til dem, se docs/RAPPORT-259.md.
  async function fetchVolumeLogs(athleteId) {
    setVolumeLoading(true)
    const since = new Date(Date.now() - 5 * 7 * 86400000).toISOString()
    const { data, ok } = await runGuardedRead(
      () => supabase
        .from('exercise_logs')
        .select('logged_at, skipped, exercises(name)')
        .eq('athlete_id', athleteId)
        .gte('logged_at', since)
        .order('logged_at', { ascending: false })
        .limit(2000),
      onReadError('Din volumen', athleteId),
    )
    setVolumeLoading(false)
    if (!ok) return
    setVolumeLogs(data || [])
  }

  // ORDRE 284 · commit 1: al historik for Fremgang-fanen — ingen datogrænse
  // (til forskel fra fetchVolumeLogs's 5 uger), for fremgang på et løft skal
  // kunne ses over måneder, ikke kun de seneste uger. Kun gennemførte sæt
  // med en rigtig vægt (samme filtre som fetchExerciseHistory). ORDRE 293
  // (F2): hentes faldende og vendes, så en grænse aldrig koster de nyeste sæt
  // (se src/fremgangLogs.js).
  async function fetchFremgangLogs(athleteId) {
    setFremgangLoading(true)
    const { data, ok } = await runGuardedRead(
      () => fremgangLogsQuery(supabase, athleteId),
      onReadError('Fremgang', athleteId),
    )
    setFremgangLoading(false)
    if (!ok) return
    setFremgangLogs(fremgangLogsKronologisk(data))
  }

  // ORDRE 268 · commit 2: "hele forløbet" i UgensStatusKort — samme kilde
  // (exercise_logs) og samme grænse (2000, som coachens fetchAthleteLogs i
  // Dashboard.jsx) som resten af appen, ingen dato-afgrænsning (til forskel
  // fra fetchVolumeLogs's 5 uger) fordi "hele forløbet" pr. definition kan
  // strække sig længere tilbage end det. beregnForloebUger matcher kun på
  // logged_at, ikke exercise_id. ORDRE 276 · blok 2 genbruger SAMME logs til
  // "sidste uge ved siden af denne" (beregnUgeDage, som matcher på
  // exercise_id) — derfor er `exercise_id` med i select'en her, selvom
  // beregnForloebUger ikke selv bruger den.
  async function fetchForloebLogs(athleteId) {
    setForloebLoading(true)
    const { data, ok } = await runGuardedRead(
      () => supabase
        .from('exercise_logs')
        .select('exercise_id, weight, reps_completed, skipped, logged_at')
        .eq('athlete_id', athleteId)
        .order('logged_at', { ascending: true })
        .limit(2000),
      onReadError('Ugen som planlagt', athleteId),
    )
    setForloebLoading(false)
    if (!ok) return
    setForloebLogs(data || [])
  }

  async function fetchMeetResults(athleteId) {
    const { data, ok } = await runGuardedRead(
      () => supabase
        .from('meet_results')
        .select('*')
        .eq('athlete_id', athleteId)
        .order('meet_date', { ascending: false }),
      onReadError('Stævneresultater', athleteId),
    )
    if (!ok) return
    setMeetResults(data || [])
  }

  async function fetchWarmupTemplates(athleteId) {
    const { data, ok } = await runGuardedRead(
      () => supabase
        .from('warmup_templates')
        .select('*')
        .eq('athlete_id', athleteId),
      onReadError('Opvarmningsskabeloner', athleteId),
    )
    if (!ok) return
    setWarmupTemplates(data || [])
  }

  // ORDRE 231 · commit 2: de tre opslag herunder er uafhængige af hinandens
  // DATA (samme tabel, tre forskellige datofiltre) men blev kørt i serie —
  // kaeden-tegn.mjs (commit 1) fandt 0-1ms gab mellem dem, en ren await-kæde,
  // ikke netværksstøj. Kørt samtidig via Promise.all i stedet; hver gren
  // beholder sin egen fejlmelding (onReadError) og opdaterer kun sin egen
  // state ved success, præcis som før.
  async function fetchReadiness(athleteId) {
    const [today_, prev_, hist_] = await Promise.all([
      runGuardedRead(
        () => supabase
          .from('readiness_logs')
          .select('*')
          .eq('athlete_id', athleteId)
          .eq('logged_date', today())
          .maybeSingle(),
        onReadError('Dagens parathed', athleteId),
      ),
      runGuardedRead(
        () => supabase
          .from('readiness_logs')
          .select('*')
          .eq('athlete_id', athleteId)
          .lt('logged_date', today())
          .order('logged_date', { ascending: false })
          .limit(1)
          .maybeSingle(),
        onReadError('Sidste parathed', athleteId),
      ),
      // ORDRE 100: op til 14 forudgående dage — grundlaget for "sat op mod
      // dit eget snit" og for den lille 14-dages-kurve. Ekskluderer i dag med
      // vilje, så dagens egen score ikke er med i det den sammenlignes mod.
      runGuardedRead(
        () => supabase
          .from('readiness_logs')
          // ORDRE 267 · commit 2: sleep_hours/sore_zones tilføjet ud over de
          // to oprindelige kolonner — samme forespørgsel, kun flere felter —
          // så "hvad coachen ser"-kortet kan regne gns. søvn/hyppigste ømme
          // zone uden endnu et opslag (se summarizeReadinessForCoach).
          .select('logged_date, readiness_score, sleep_hours, sore_zones')
          .eq('athlete_id', athleteId)
          .lt('logged_date', today())
          .order('logged_date', { ascending: false })
          .limit(14),
        onReadError('Parathedshistorik', athleteId),
      ),
    ])
    if (today_.ok) setReadinessLog(today_.data || null)
    if (prev_.ok) setLastReadiness(prev_.data || null)
    if (hist_.ok) setReadinessHistory(hist_.data || [])
  }

  function suggestNextWeight(exName, intensity) {
    const targetRpe = parsePlannedRpe(intensity)
    if (!targetRpe) return null
    const hist = exerciseHistory[exName?.toLowerCase()] || []
    if (!hist.length) return null
    const lastSession = hist[0]
    if (lastSession.date === today()) return null // currently logging this session
    const setsWithRpe = lastSession.sets.filter(s => s.rpe != null && s.weight > 0)
    if (!setsWithRpe.length) return null
    const ref = setsWithRpe[setsWithRpe.length - 1]
    const roundTo25 = w => Math.round(w / 2.5) * 2.5
    const suggested = roundTo25(ref.weight * (1 + (targetRpe - ref.rpe) * 0.03))
    if (suggested <= 0) return null
    return { weight: suggested, fromRpe: ref.rpe, baseWeight: ref.weight }
  }

  function calcReadinessScore({ sleep, energy, motivation, stress, soreness }) {
    // Vægtet model: hvert element scores 0-100 og vægtes til samlet parathed.
    // Neutrale svar (3/5 + 7-9t søvn) → ~63; kun friske svar nærmer sig 100.
    const sub = [] // [delscore, vægt]
    const h = parseFloat(sleep) || 0
    if (h > 0) {
      let sleepScore
      if (h >= 7 && h <= 9) sleepScore = 100
      else if (h > 9 && h <= 10) sleepScore = 85
      else if (h >= 6 && h < 7) sleepScore = 80
      else if (h >= 5 && h < 6) sleepScore = 55
      else if (h > 10) sleepScore = 70
      else sleepScore = 30 // < 5t
      sub.push([sleepScore, 0.25])
    }
    const lin = v => ((v - 1) / 4) * 100 // 1→0, 3→50, 5→100 (højere = bedre)
    const inv = v => ((5 - v) / 4) * 100 // 1→100, 3→50, 5→0 (lavere = bedre)
    if (energy) sub.push([lin(energy), 0.25])
    if (motivation) sub.push([lin(motivation), 0.15])
    if (stress) sub.push([inv(stress), 0.15])
    if (soreness) sub.push([inv(soreness), 0.20])
    if (!sub.length) return null
    const totalW = sub.reduce((a, [, w]) => a + w, 0)
    const score = sub.reduce((a, [s, w]) => a + s * w, 0) / totalW
    return Math.max(0, Math.min(100, Math.round(score)))
  }

  async function saveReadiness() {
    if (!athlete) return
    const missing = []
    if (!readinessInput.energy) missing.push('energi')
    if (!readinessInput.motivation) missing.push('motivation')
    if (!readinessInput.stress) missing.push('stress')
    if (!readinessInput.soreness) missing.push('ømhed')
    if (missing.length) { setReadinessError('Mangler: ' + missing.join(', ')); return }
    setSavingReadiness(true)
    setReadinessError(null)
    const score = calcReadinessScore(readinessInput)
    const payload = {
      athlete_id: athlete.id,
      logged_date: today(),
      sleep_hours: parseFloat(readinessInput.sleep) || null,
      energy: readinessInput.energy,
      motivation: readinessInput.motivation,
      stress: readinessInput.stress,
      soreness_level: readinessInput.soreness,
      sore_zones: readinessInput.soreZones.length > 0 ? readinessInput.soreZones : null,
      readiness_score: score,
    }
    const { error } = await supabase.from('readiness_logs').insert(payload)
    setSavingReadiness(false)
    if (error) {
      // Atleten skal ikke se en rå Supabase-fejlbesked — detaljen går til
      // frontend_errors, hvor den kan slås op, hvis mønsteret gentager sig.
      logFrontendError('saveReadiness fejlede', error, athlete.id)
      setReadinessError('Kunne ikke gemme parathed. Tjek din forbindelse og prøv igen.')
    } else {
      setReadinessLog({ ...payload })
      // G12: en gemt log gør udkastet forældet — ryd det, så en genåbning
      // ikke genindsætter data der allerede er logget.
      clearReadinessDraft(athlete.id, today())
    }
  }

  async function fetchProgram(athleteId) {
    const { data, ok } = await runGuardedRead(
      () => supabase
        .from('weeks')
        .select('*, sessions(*, exercises(*))')
        .eq('athlete_id', athleteId)
        .order('week_number', { ascending: true }),
      onReadError('Dit program', athleteId),
    )
    if (!ok) { setProgramError(true); return }
    // Bekræftet svar (om end evt. tomt) — en tidligere fejlvisning er ikke
    // længere retvisende.
    setProgramError(false)
    if (!data || data.length === 0) return
    const weeks = data.map(w => ({
      ...w,
      sessions: (w.sessions || [])
        .sort((a, b) => a.session_order - b.session_order)
        .map(s => ({ ...s, exercises: (s.exercises || []).sort((a, b) => a.exercise_order - b.exercise_order) }))
    }))
    setAllWeeks(weeks)
    const dateIdx = computeActiveWeekIdx(weeks)
    // Lås næste uge op tidligt: er den dato-aktuelle uge fuldt logget, og findes
    // der en næste uge med indhold, så ryk den aktive uge frem — så atleten kan
    // se næste uges anbefalede vægte/opvarmning og logge i forvejen før mandag.
    // Sker KUN ved 100% færdiglogning; en glemt dag holder den aktuelle uge aktiv.
    let activeIdx = dateIdx
    const next = weeks[dateIdx + 1]
    const nextHasContent = (next?.sessions || []).some(s => (s.exercises || []).length > 0)
    if (nextHasContent) {
      const dateLogs = await fetchWeekLogs(athleteId, weeks[dateIdx])
      if (weekFullyLogged(weeks[dateIdx], dateLogs)) activeIdx = dateIdx + 1
    }
    setViewingWeekIdx(activeIdx)
    const activeWeek = weeks[activeIdx]
    setCurrentWeek(activeWeek)
    fetchExerciseLogs(athleteId, activeWeek)
    fetchLastLogs(athleteId, activeWeek)
    fetchExerciseHistory(athleteId)
    fetchWeeklyTonnage(athleteId)
  }

  // Ugentlig tonnage (sum af vægt × reps) + ugentligt bedste e1RM pr. hovedløft
  // til forsidens grafer. Grupperes på ugens mandag ud fra logged_at; ~12 ugers logs.
  async function fetchWeeklyTonnage(athleteId) {
    const since = new Date(Date.now() - 84 * 86400000).toISOString()
    const { data, ok } = await runGuardedRead(
      () => supabase
        .from('exercise_logs')
        .select('weight, reps_completed, logged_at, exercises(name)')
        .eq('athlete_id', athleteId)
        .eq('skipped', false)
        .gt('weight', 0)
        .gte('logged_at', since)
        .order('logged_at', { ascending: true })
        .limit(4000),
      onReadError('Tonnage-grafen', athleteId),
    )
    if (!ok || !data) return
    // Kun stang-varianter tæller med i hovedløfts-e1RM — maskiner/håndvægte
    // (belt squat, hack squat, DB-pres ...) giver misvisende høje tal. Samme
    // familie-definition som ordre 284's øvelsesvælger (exerciseProgress.js),
    // så "Squat" her og i Fremgang-fanen aldrig kan komme til at betyde to
    // forskellige ting.
    const byWeek = {}
    const liftByWeek = HOVEDLOEFT_FAMILIER.map(() => ({}))
    for (const l of data) {
      const d = new Date(l.logged_at)
      d.setHours(12, 0, 0, 0)
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7)) // tilbage til mandag
      const key = d.toISOString().slice(0, 10)
      byWeek[key] = (byWeek[key] || 0) + (l.weight || 0) * (l.reps_completed || 0)
      const name = (l.exercises?.name || '').toLowerCase()
      const reps = l.reps_completed || 0
      if (name && reps >= 1 && reps <= 12) {
        const e1rm = estimatedOneRepMax(l.weight, reps)
        HOVEDLOEFT_FAMILIER.forEach((lift, i) => {
          if (lift.match(name) && e1rm > (liftByWeek[i][key] || 0)) liftByWeek[i][key] = e1rm
        })
      }
    }
    const rows = Object.entries(byWeek)
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([weekStart, total]) => ({ weekStart, total: Math.round(total) }))
    setWeeklyTonnage(rows.slice(-10))
    setLiftProgress(HOVEDLOEFT_FAMILIER.map((lift, i) => ({
      label: lift.label,
      color: lift.color,
      points: Object.entries(liftByWeek[i])
        .sort((a, b) => (a[0] < b[0] ? -1 : 1))
        .map(([weekStart, val]) => ({ weekStart, val }))
        .slice(-10),
    })))
  }

  // Henter en uges logs (kun det nødvendige til færdig-tjek) og returnerer dem,
  // i modsætning til fetchExerciseLogs der sætter state.
  async function fetchWeekLogs(athleteId, week) {
    const exerciseIds = (week?.sessions || []).flatMap(s => (s.exercises || []).map(e => e.id))
    if (exerciseIds.length === 0) return []
    const { data, ok } = await runGuardedRead(
      () => supabase
        .from('exercise_logs')
        .select('exercise_id')
        .eq('athlete_id', athleteId)
        .in('exercise_id', exerciseIds),
      onReadError('Ugens log-status', athleteId),
    )
    if (!ok) return []
    return data || []
  }

  // Åbn/luk en session i programmet. Ved åbning scrolles dens header op i
  // toppen (efter accordion'en har foldet/foldet ud), så man altid lander ved
  // første øvelse — ikke midt/nederst i sessionen.
  function openSession(sessionId) {
    setProgOpenSession(sessionId)
    if (sessionId) {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        sessionRefs.current[sessionId]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }))
    }
  }

  function openReadiness() {
    setTab('hjem')
    setMereOpen(true)
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const card = readinessCardRef.current
      if (!card) return
      const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      card.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
    }))
  }

  // Gemmer serverside via RPC (queueWrite: overlever cold-start/midlertidige
  // netvaerksfejl uden at blokere UI'en) og opdaterer lokal tilstand med det
  // samme, saa guiden lukker uafhaengigt af skrivningens svar. Spring-over
  // kalder denne PRAECIS som "gennemfoert" gør, saa de to sætter samme tilstand.
  function completeOnboardingGuide() {
    queueWrite(() => supabase.rpc('complete_athlete_onboarding_v1'))
    setOnboardingDone(true)
    setGuideOpen(false)
    setGuideStep(0)
  }

  function advanceOnboardingGuide() {
    if (isLastOnboardingGuideStep(guideStep)) {
      completeOnboardingGuide()
      setTab(currentWeek ? 'program' : 'hjem')
      return
    }
    setGuideStep(i => i + 1)
  }

  // Det ene faste sted guiden kan genstartes fra: kontomenuen (se topbar).
  function restartOnboardingGuide() {
    setGuideStep(0)
    setGuideOpen(true)
  }

  async function fetchPastLogs(week, athleteId) {
    const exerciseIds = (week?.sessions || []).flatMap(s => (s.exercises || []).map(e => e.id))
    if (exerciseIds.length === 0) { setPastLogs([]); return }
    const { data, ok } = await runGuardedRead(
      () => supabase
        .from('exercise_logs')
        .select('*')
        .eq('athlete_id', athleteId)
        .in('exercise_id', exerciseIds),
      onReadError('Tidligere logs', athleteId),
    )
    if (!ok) return
    setPastLogs(data || [])
  }

  async function fetchExerciseLogs(athleteId, week) {
    const exerciseIds = (week?.sessions || []).flatMap(s => (s.exercises || []).map(e => e.id))
    if (exerciseIds.length === 0) { setExerciseLogs([]); return }
    const { data, ok } = await runGuardedRead(
      () => supabase
        .from('exercise_logs')
        .select('*')
        .eq('athlete_id', athleteId)
        .in('exercise_id', exerciseIds),
      onReadError('Sæt-loggen', athleteId),
    )
    if (!ok) return
    const rows = data || []
    setExerciseLogs(prev => {
      // Behold endnu-ikke-bekræftede optimistiske rækker (baggrundsskrivning stadig
      // i kø), så et flueben ikke blinker væk mens en anden skrivning er undervejs.
      const pending = prev.filter(l => l._optimistic &&
        !rows.some(r => r.exercise_id === l.exercise_id && r.set_number === l.set_number))
      return [...rows, ...pending]
    })
    setLogInputs(prev => mergeAthleteSetInputs(prev, rows))
  }

  async function fetchLastLogs(athleteId, week) {
    const exerciseNames = [...new Set((week?.sessions || []).flatMap(s => (s.exercises || []).map(e => e.name)))]
    if (exerciseNames.length === 0) return
    const { data, ok } = await runGuardedRead(
      () => supabase
        .from('exercise_logs')
        .select('weight, reps_completed, logged_at, exercises(name)')
        .eq('athlete_id', athleteId)
        .order('logged_at', { ascending: false })
        .limit(500),
      onReadError('Seneste vægte', athleteId),
    )
    if (!ok || !data) return
    const map = {}
    for (const log of data) {
      const name = log.exercises?.name
      if (name && !map[name.toLowerCase()] && (log.weight > 0 || log.reps_completed > 0)) {
        map[name.toLowerCase()] = { weight: log.weight, reps_completed: log.reps_completed }
      }
    }
    setLastLogByExerciseName(map)
  }

  async function fetchExerciseHistory(athleteId) {
    const { data, ok } = await runGuardedRead(
      () => supabase
        .from('exercise_logs')
        .select('weight, reps_completed, rpe_actual, logged_at, set_number, exercises(name)')
        .eq('athlete_id', athleteId)
        .eq('skipped', false)
        .gt('weight', 0)
        .order('logged_at', { ascending: false })
        .limit(1500),
      onReadError('Øvelseshistorik', athleteId),
    )
    if (!ok || !data) return
    const byName = {}
    for (const log of data) {
      const name = log.exercises?.name?.toLowerCase()
      if (!name) continue
      const date = log.logged_at.slice(0, 10)
      if (!byName[name]) byName[name] = {}
      if (!byName[name][date]) byName[name][date] = []
      byName[name][date].push({ weight: log.weight, reps: log.reps_completed, rpe: log.rpe_actual, set: log.set_number })
    }
    const history = {}
    for (const [name, dateMap] of Object.entries(byName)) {
      const dates = Object.keys(dateMap).sort().reverse().slice(0, 3)
      history[name] = dates.map(date => ({ date, sets: dateMap[date].sort((a, b) => a.set - b.set) }))
    }
    setExerciseHistory(history)
  }

  return {
    fetchAthlete, fetchSharedVideoAnalyses, fetchMeetPlan, fetchVolumeLogs, fetchFremgangLogs, fetchForloebLogs, fetchMeetResults, suggestNextWeight,
    saveReadiness, fetchProgram, openSession, openReadiness, completeOnboardingGuide, advanceOnboardingGuide, restartOnboardingGuide, fetchPastLogs,
    fetchExerciseLogs,
  }
}
