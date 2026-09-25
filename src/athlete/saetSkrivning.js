// Saet-skrivningen: persistSetLog-kaeden, logSet (optimistisk, PR-detektion),
// Dagens pas' log/fortryd/ret, offline-koeen, spring over, session-feedback og
// udfyld/spring resten over — flyttet uaendret ud af AthleteView.jsx (ordre 373)
// som en fabrik, samme moenster som kostHandlinger.js.
import { supabase, queueWrite } from '../supabase'
import { nextAthleteSetInput } from '../athleteTrainingInputs'
import { runGuardedWrite } from '../athleteWriteGuard'
import { recordSilentFail } from '../athleteSilentFailLog'
import { applySetEdit } from '../editLoggedSet'
import { restSecondsForExercise } from '../restBetweenSets'
import { startRestPause, clearRestPause } from '../restPause'
import { saveOfflineSet, loadOfflineSets, clearOfflineSet, countOfflineSets } from '../offlineSetQueue'
import { estimatedOneRepMax } from '../exerciseProgress'
import { parsePlannedRpe, logFrontendError } from './ugeHjaelp'

export function lavSaetSkrivning({
  allWeeks, athlete, currentWeek, exerciseLogs, feedbackInputs, fetchExerciseLogs, fetchPastLogs, lastLogByExerciseName,
  logInputs, setAllWeeks, setExerciseLogs, setLastLoggedSet, setLogInputs, setPendingSessionAction, setPendingSyncCount, setPrToast,
  setPrToastFading, setRestPause, setSetConfirm, setWriteRef, showFlash, viewingWeekIdx,
}) {
  // Skriver ét sæt til databasen, serialiseret pr. nøgle. Fordi skridtene kædes
  // (chain.then), ser en efterfølgende skrivning altid det rigtige id fra den
  // foregående INSERT → aldrig dubletter, og seneste værdi vinder. Returnerer
  // { data, error } fra det underliggende kald, så kalderen kan rulle tilbage.
  function persistSetLog(key, exerciseId, setNumber, payload, realExistingId) {
    const ref = setWriteRef.current[key] || (setWriteRef.current[key] = { realId: null, chain: Promise.resolve() })
    if (realExistingId) ref.realId = realExistingId
    const task = ref.chain.then(async () => {
      if (ref.realId) {
        const upd = await queueWrite(() => supabase.from('exercise_logs').update(payload).eq('id', ref.realId).select('id'))
        if (upd.error) return upd                                   // transient fejl → lad kalderen vise fejl/retry (ingen dublet)
        if (Array.isArray(upd.data) && upd.data.length) return upd  // rækken blev opdateret
        ref.realId = null                                           // rækken findes ikke mere (fx slettet) → INSERT nedenfor
      }
      const res = await queueWrite(() => supabase
        .from('exercise_logs')
        .insert({ exercise_id: exerciseId, athlete_id: athlete.id, set_number: setNumber, ...payload })
        .select('id').single())
      if (res?.data?.id) ref.realId = res.data.id
      return res
    })
    // Hold kæden i live selv hvis en skrivning fejler/kaster.
    ref.chain = task.then(() => {}, () => {})
    return task
  }

  async function logSet(exerciseId, setNumber, totalSets, repsCompleted, plannedRpe, { localFallback = false } = {}) {
    const key = `${exerciseId}_${setNumber}`
    const input = logInputs[key] || {}
    const payload = {
      weight: parseFloat(input.weight) || 0,
      reps_completed: parseInt(repsCompleted) || 0,
      note: input.note || null,
      // Ingen egen RPE valgt → gem den planlagte RPE, så vi altid har data at
      // autoregulere på. Rører atleten vælgeren, gemmes deres værdi i stedet.
      rpe_actual: input.rpe ? parseFloat(input.rpe) : (plannedRpe ?? null),
      rpe_planned: plannedRpe ?? null,
      skipped: false,
    }
    // Kun en rigtig (bekræftet) række afgør INSERT vs. UPDATE i databasen — en
    // optimistisk række har ikke et gyldigt db-id at opdatere på.
    const realExisting = exerciseLogs.find(l => l.exercise_id === exerciseId && l.set_number === setNumber && !l._optimistic)
    const existing = exerciseLogs.find(l => l.exercise_id === exerciseId && l.set_number === setNumber)

    // OPTIMISTISK: vis fluebenet ØJEBLIKKELIGT og skriv i baggrunden. Atleten skal
    // aldrig vente på netværket for at se at sættet er registreret — det var netop
    // ventetiden (op til ~60s på det første kald efter app-åbning) der var buggen.
    const optimisticId = `optimistic_${key}`
    if (existing) {
      setExerciseLogs(prev => prev.map(l => l.id === existing.id ? { ...l, ...payload } : l))
    } else {
      setExerciseLogs(prev => [
        ...prev,
        { id: optimisticId, exercise_id: exerciseId, athlete_id: athlete.id, set_number: setNumber, ...payload, _optimistic: true },
      ])
    }
    // ORDRE 263 · commit 2: pausen starter automatisk, med det samme
    // (optimistisk, ligesom resten af denne funktion) — ikke først når
    // skrivningen har svaret. "Den pause der står i programmet" læses fra
    // øvelsens note (se restBetweenSets.js); ingen note → en fornuftig
    // standard. Persisteres (restPause.js), så den overlever et lukket/
    // genåbnet vindue.
    const loggedExercise = allWeeks.flatMap(w => w.sessions || []).flatMap(sess => sess.exercises || []).find(e => e.id === exerciseId)
    const restSeconds = restSecondsForExercise(loggedExercise)
    startRestPause(athlete.id, restSeconds, loggedExercise?.name)
    setRestPause({ startedAt: Date.now(), durationSeconds: restSeconds, label: loggedExercise?.name || null })
    setSetConfirm(p => ({ ...p, [key]: 'saved' }))
    let fadeTimer
    const scheduleFade = () => {
      fadeTimer = setTimeout(() => {
        setSetConfirm(p => ({ ...p, [key]: 'fading' }))
        setTimeout(() => setSetConfirm(p => { const n = { ...p }; delete n[key]; return n }), 300)
      }, 1700)
    }
    scheduleFade()
    // Auto-fill next set weight if empty
    if (setNumber < totalSets) {
      const nextKey = `${exerciseId}_${setNumber + 1}`
      setLogInputs(p => ({
        ...p,
        [nextKey]: nextAthleteSetInput(input, p[nextKey]),
      }))
    }

    // Baggrundsskrivning: serialiseret pr. sæt-nøgle + retry-kø (se persistSetLog).
    // Ved fejl: vis en diskret fejl og rul den optimistiske ændring tilbage, så
    // UI matcher virkeligheden. Program-fanens egen Log-knap bruger denne gren
    // uændret (verify:athlete-write-failures/e2e:fejl låser den).
    // ORDRE 293 · F5: "Godkendt" (localFallback) lægger sættet i den lokale kø
    // FØR skrivningen forsøges, og fjerner det igen ved succes (nedenfor). Før
    // stod køen først efter queueWrites fire forsøg (~4 s, længere på et dårligt
    // net) — lukkes/dræbes fanen i det vindue, var et bekræftet sæt væk.
    // pendingSyncCount røres først ved en fejlet skrivning: "gemt lokalt"-
    // linjen må ikke blinke ved hver vellykket skrivning.
    if (localFallback) saveOfflineSet(athlete.id, key, { exerciseId, setNumber, payload })
    const { error } = await persistSetLog(key, exerciseId, setNumber, payload, realExisting?.id)
    if (error) {
      // ORDRE 280 · commit 4 — "Godkendt" i Dagens pas beder om localFallback:
      // sættet er allerede vist som logget (optimistisk, ovenfor); i stedet
      // for at rulle det tilbage til en fejlbesked, gemmes payloaden lokalt
      // (offlineSetQueue.js) og sendes igen når forbindelsen er der (se
      // flushOfflineSets). Ingen ny tabel — samme exercise_logs-række som
      // ellers, bare forsinket. (Selve kø-posten er lagt FØR skrivningen, se
      // ovenfor; her skrives den igen, hvis den første gang ikke kunne gemmes.)
      if (localFallback) {
        saveOfflineSet(athlete.id, key, { exerciseId, setNumber, payload })
        setPendingSyncCount(countOfflineSets(athlete.id))
        return
      }
      clearTimeout(fadeTimer)
      setSetConfirm(p => ({ ...p, [key]: 'error' }))
      if (realExisting) {
        // Fortryd den optimistiske opdatering — sæt rækken tilbage til db-værdien.
        setExerciseLogs(prev => prev.map(l => l.id === realExisting.id ? realExisting : l))
      } else {
        setExerciseLogs(prev => prev.filter(l => !(l._optimistic && l.exercise_id === exerciseId && l.set_number === setNumber)))
      }
      return
    }
    if (localFallback) {
      clearOfflineSet(athlete.id, key)
      setPendingSyncCount(countOfflineSets(athlete.id))
    }
    fetchExerciseLogs(athlete.id, currentWeek)

    // PR-detektion (est. 1RM-baseret, Epley) — skelner vægt/rep/styrke-PR
    const newReps = parseInt(repsCompleted) || 0
    if (payload.weight > 0 && newReps > 0) {
      const exerciseName = allWeeks
        .flatMap(w => w.sessions || [])
        .flatMap(s => s.exercises || [])
        .find(e => e.id === exerciseId)?.name
      if (exerciseName) {
        const e1rm = r => estimatedOneRepMax(r.weight, r.reps || 1)
        const newSet = { weight: payload.weight, reps: newReps }
        const { data: prData, error: prFetchError } = await supabase
          .from('personal_records')
          .select('weight, reps')
          .eq('athlete_id', athlete.id)
          .eq('exercise_name', exerciseName)
        // G14 (ordre 131): en fejlet INSERT her blev tidligere aldrig tjekket —
        // atleten kunne se PR-fejringen ("PR!") selvom rækken aldrig nåede
        // databasen. queueWrite giver samme genforsøg-med-backoff som resten af
        // appens skrivninger; lykkes den stadig ikke, vises INGEN fejring (en
        // udeblevet fejring er rigtigere end en løgnagtig), og coachen kan se
        // det via session_context næste gang atleten uploader en video.
        const savePR = () => queueWrite(() => supabase.from('personal_records').insert({
          athlete_id: athlete.id,
          exercise_name: exerciseName,
          weight: newSet.weight,
          reps: newSet.reps,
        }))
        if (prFetchError) {
          // En fejlet SELECT er IKKE det samme som "ingen tidligere data" — tolkes
          // den sådan, overskrives en ægte baseline af det aktuelle sæt. Springes
          // over her; selve sætloggen er allerede gemt ovenfor.
          logFrontendError('PR-detektion sprunget over: SELECT på personal_records fejlede', prFetchError, athlete.id)
        } else if ((prData || []).length === 0) {
          // Allerførste registrering på øvelsen → gem baseline uden notifikation
          const { error: baselineError } = await savePR()
          if (baselineError) {
            logFrontendError('PR-detektion: baseline-INSERT på personal_records fejlede', baselineError, athlete.id)
            recordSilentFail(athlete.id, 'silent:pr-insert-failed')
          }
        } else {
          const rows = prData
          const bestWeight = Math.max(...rows.map(r => r.weight || 0))
          const bestE1rm = Math.max(...rows.map(e1rm))
          // Flest reps tidligere på en vægt mindst lige så tung som det nye sæt
          const repsAtWeight = rows.filter(r => (r.weight || 0) >= newSet.weight).map(r => r.reps || 0)
          const bestRepsAtWeight = repsAtWeight.length ? Math.max(...repsAtWeight) : 0
          let prType = null
          if (newSet.weight > bestWeight) prType = 'vægt'
          else if (bestRepsAtWeight > 0 && newSet.reps > bestRepsAtWeight) prType = 'rep'
          else if (e1rm(newSet) > bestE1rm * 1.001) prType = 'styrke'
          if (prType) {
            const { error: prSaveError } = await savePR()
            if (prSaveError) {
              logFrontendError('PR-detektion: INSERT på personal_records fejlede', prSaveError, athlete.id)
              recordSilentFail(athlete.id, 'silent:pr-insert-failed')
            } else {
              setPrToast({ name: exerciseName, type: prType })
              setPrToastFading(false)
              setTimeout(() => setPrToastFading(true), 2400)
              setTimeout(() => setPrToast(null), 3000)
            }
          }
        }
      }
    }
  }

  // ORDRE 280 · commit 2 — Dagens pas' "Godkendt"-knap kalder logSet gennem
  // her (i stedet for direkte), så kortet kan huske hvilket sæt der lige blev
  // logget (til "Fortryd sidste sæt" nedenfor). Program-fanens egen Log-knap
  // rører IKKE dette — den kalder stadig logSet direkte, uændret adfærd
  // (verify:athlete-write-failures/e2e:fejl låser den offline-fejlflowet der).
  async function logDagensPasSet(ex, setNumber, totalSets, repsToLog, plannedRpe) {
    setLastLoggedSet({ exerciseId: ex.id, setNumber })
    await logSet(ex.id, setNumber, totalSets, repsToLog, plannedRpe, { localFallback: true })
  }

  // ORDRE 280 · commit 4 — sender ventende sæt (offlineSetQueue.js) igen når
  // forbindelsen er der. Kaldes ved athlete-load og ved 'online'-event; en
  // fejlet skrivning her bliver liggende i køen til næste forsøg.
  async function flushOfflineSets() {
    if (!athlete?.id) return
    const queue = loadOfflineSets(athlete.id)
    const keys = Object.keys(queue)
    if (!keys.length) return
    for (const key of keys) {
      const { exerciseId, setNumber, payload } = queue[key]
      let realId = exerciseLogs.find(l => l.exercise_id === exerciseId && l.set_number === setNumber && !l._optimistic)?.id
      if (!realId) {
        // ORDRE 293 · F5: køen står nu FØR skrivningen, så en post kan høre til
        // et sæt serveren allerede har taget imod (appen døde før svaret kom
        // tilbage). Slå rækken op først, så genafspilningen bliver en UPDATE
        // og ikke en dublet. Kan opslaget ikke gennemføres, ligger posten
        // stadig i køen til næste forsøg.
        const { data: found, error: lookupError } = await supabase
          .from('exercise_logs').select('id')
          .eq('athlete_id', athlete.id).eq('exercise_id', exerciseId).eq('set_number', setNumber)
          .limit(1)
        if (lookupError) continue
        realId = found?.[0]?.id
      }
      const { error } = await persistSetLog(key, exerciseId, setNumber, payload, realId)
      if (!error) clearOfflineSet(athlete.id, key)
    }
    setPendingSyncCount(countOfflineSets(athlete.id))
    fetchExerciseLogs(athlete.id, currentWeek)
  }

  // "Fortryd sidste sæt": sletter log-rækken igen (samme mønster som
  // unskipSet), rydder den pause sættet startede, og genåbner sættet til
  // redigering — logInputs er ikke rørt, så vægt/reps stadig står der.
  // Kø'et via setWriteRef (samme kæde som persistSetLog), så en sletning
  // aldrig løber forbi en INSERT der endnu er undervejs (ville efterlade en
  // spøgelsesrække, hvis sletningen ramte databasen FØR insertet).
  async function undoLoggedSet(exerciseId, setNumber) {
    const key = `${exerciseId}_${setNumber}`
    setExerciseLogs(prev => prev.filter(l => !(l.exercise_id === exerciseId && l.set_number === setNumber)))
    clearRestPause(athlete.id)
    setRestPause(null)
    setLastLoggedSet(null)
    // Sættet kan være ventende lokalt (blev "Godkendt" uden net, se
    // flushOfflineSets) — fortryd skal ikke sende det senere.
    clearOfflineSet(athlete.id, key)
    setPendingSyncCount(countOfflineSets(athlete.id))
    const ref = setWriteRef.current[key]
    const chain = ref ? ref.chain : Promise.resolve()
    const task = chain.then(async () => {
      const idToDelete = ref?.realId
      if (!idToDelete) return
      const { error } = await queueWrite(() => supabase.from('exercise_logs').delete().eq('id', idToDelete))
      if (error) { logFrontendError('Fortryd sæt: sletning fejlede', error, athlete.id); return }
      if (ref.realId === idToDelete) ref.realId = null
    })
    if (ref) ref.chain = task.then(() => {}, () => {})
    await task
    fetchExerciseLogs(athlete.id, currentWeek)
  }

  // ORDRE 320 · blok 1 — "ret" på et allerede klaret sæt (Dagens pas) skal
  // IKKE slette log-rækken (det gjorde undoLoggedSet ovenfor, se
  // docs/KRITIK-314.md fund 3: sletningen fik nextSetInSession til at anse
  // sættet for uloggede igen, hvilket skjulte alle senere sæt og fik
  // gen-godkendelse til at springe stille forbi dem). Genbruger i stedet den
  // opdateringsvej der allerede findes: persistSetLog opdaterer samme række
  // (samme id) når ref.realId er sat — ingen ny skrivevej, ingen migration.
  // Samme offline-mønster som logSet's localFallback (saveOfflineSet/
  // clearOfflineSet), så "ret" også virker uden forbindelse (se 293).
  async function updateLoggedSet(exerciseId, setNumber, updates) {
    const key = `${exerciseId}_${setNumber}`
    const existing = exerciseLogs.find(l => l.exercise_id === exerciseId && l.set_number === setNumber && !l._optimistic)
    if (!existing) return false
    const payload = {
      weight: parseFloat(updates.weight) || 0,
      reps_completed: parseInt(updates.reps) || 0,
      note: existing.note ?? null,
      rpe_actual: existing.rpe_actual ?? null,
      rpe_planned: existing.rpe_planned ?? null,
      skipped: false,
    }
    setExerciseLogs(prev => applySetEdit(prev, exerciseId, setNumber, payload))
    saveOfflineSet(athlete.id, key, { exerciseId, setNumber, payload })
    const { error } = await persistSetLog(key, exerciseId, setNumber, payload, existing.id)
    if (error) {
      // Samme optimistiske fallback som logSet: forbliver rettet i UI,
      // ligger i offline-køen til flushOfflineSets sender den igen.
      logFrontendError('Ret sæt: opdatering fejlede, lagt i offline-kø', error, athlete.id)
      setPendingSyncCount(countOfflineSets(athlete.id))
      return true
    }
    clearOfflineSet(athlete.id, key)
    setPendingSyncCount(countOfflineSets(athlete.id))
    fetchExerciseLogs(athlete.id, currentWeek)
    return true
  }

  async function skipSet(exerciseId, setNumber, plannedRpe) {
    const existing = exerciseLogs.find(l => l.exercise_id === exerciseId && l.set_number === setNumber)
    const payload = { skipped: true, weight: 0, reps_completed: 0, note: null, rpe_actual: null, rpe_planned: plannedRpe ?? null }
    const ok = await runGuardedWrite(
      () => existing
        ? supabase.from('exercise_logs').update(payload).eq('id', existing.id)
        : supabase.from('exercise_logs').insert({ exercise_id: exerciseId, athlete_id: athlete.id, set_number: setNumber, ...payload }),
      () => showFlash('Sættet kunne ikke springes over. Tjek din forbindelse og prøv igen.', 'error'),
    )
    if (!ok) return
    fetchExerciseLogs(athlete.id, currentWeek)
  }

  async function skipExercise(ex) {
    const plannedRpe = parsePlannedRpe(ex.intensity)
    const toSkip = Array.from({ length: ex.sets || 0 }, (_, i) => i + 1).filter(setNum =>
      !exerciseLogs.find(l => l.exercise_id === ex.id && l.set_number === setNum)
    )
    if (toSkip.length === 0) return
    const ok = await runGuardedWrite(
      () => supabase.from('exercise_logs').insert(
        toSkip.map(setNum => ({ exercise_id: ex.id, athlete_id: athlete.id, set_number: setNum, skipped: true, weight: 0, reps_completed: 0, rpe_planned: plannedRpe ?? null }))
      ),
      () => showFlash('Øvelsen kunne ikke springes over. Tjek din forbindelse og prøv igen.', 'error'),
    )
    if (!ok) return
    fetchExerciseLogs(athlete.id, currentWeek)
  }

  async function unskipSet(exerciseId, setNumber) {
    const existing = exerciseLogs.find(l => l.exercise_id === exerciseId && l.set_number === setNumber)
    if (!existing) return
    const ok = await runGuardedWrite(
      () => supabase.from('exercise_logs').delete().eq('id', existing.id),
      () => showFlash('Kunne ikke fortryde spring over. Tjek din forbindelse og prøv igen.', 'error'),
    )
    if (!ok) return
    fetchExerciseLogs(athlete.id, currentWeek)
  }

  async function saveFeedback(sessionId) {
    const input = feedbackInputs[sessionId] || {}
    if (!input.rating) return
    setPendingSessionAction(`${sessionId}:feedback`)
    const ok = await runGuardedWrite(
      () => supabase.from('sessions').update({
        athlete_rating: input.rating,
        athlete_comment: input.comment || null,
      }).eq('id', sessionId),
      () => showFlash('Feedbacken blev ikke gemt. Tjek din forbindelse og prøv igen.', 'error'),
    )
    setPendingSessionAction(null)
    if (!ok) return
    setAllWeeks(prev => prev.map(w => ({
      ...w,
      sessions: (w.sessions || []).map(s => s.id === sessionId ? { ...s, athlete_rating: input.rating, athlete_comment: input.comment || null } : s),
    })))
  }

  async function autoCompleteSession(session) {
    const exerciseIds = (session.exercises || []).map(e => e.id)
    if (exerciseIds.length === 0) { showFlash('Ingen øvelser fundet i sessionen.', 'error'); return }

    setPendingSessionAction(`${session.id}:autofill`)
    const { data: existing, error: fetchErr } = await supabase
      .from('exercise_logs')
      .select('exercise_id, set_number')
      .eq('athlete_id', athlete.id)
      .in('exercise_id', exerciseIds)
    if (fetchErr) { setPendingSessionAction(null); showFlash('Sættene kunne ikke tjekkes. Tjek din forbindelse og prøv igen.', 'error'); return }

    const logged = new Set((existing || []).map(l => `${l.exercise_id}_${l.set_number}`))
    const rows = []
    for (const ex of (session.exercises || [])) {
      const last = lastLogByExerciseName[ex.name?.toLowerCase()]
      const weight = last?.weight ?? parseFloat(ex.recommended_weight) ?? 0
      const reps = last?.reps_completed ?? parseInt(ex.reps) ?? 0
      // Ikke-skippede sæt får planlagt RPE som faktisk RPE (samme logik som logSet).
      const plannedRpe = parsePlannedRpe(ex.intensity)
      for (let n = 1; n <= (parseInt(ex.sets) || 0); n++) {
        if (logged.has(`${ex.id}_${n}`)) continue
        rows.push({ exercise_id: ex.id, athlete_id: athlete.id, set_number: n, weight, reps_completed: reps, note: null, rpe_actual: plannedRpe ?? null, rpe_planned: plannedRpe ?? null, skipped: false })
      }
    }

    if (rows.length === 0) {
      setPendingSessionAction(null)
      showFlash('Alle sæt er allerede logget.')
      return
    }

    const ok = await runGuardedWrite(
      () => supabase.from('exercise_logs').insert(rows),
      () => showFlash('Sættene kunne ikke udfyldes. Tjek din forbindelse og prøv igen.', 'error'),
    )
    setPendingSessionAction(null)
    if (!ok) return

    showFlash(`${rows.length} sæt udfyldt.`)
    await fetchExerciseLogs(athlete.id, currentWeek)
    await fetchPastLogs(allWeeks[viewingWeekIdx], athlete.id)
  }

  // Markér alle ikke-loggede sæt i sessionen som sprunget over. Bruges når atleten
  // ikke nåede hele træningen og bare vil lukke den (fjerner "Fortsæt"-naget) uden
  // at fabrikere gennemførte sæt — i modsætning til autoCompleteSession.
  async function skipRemainingSets(session) {
    const exerciseIds = (session.exercises || []).map(e => e.id)
    if (exerciseIds.length === 0) { showFlash('Ingen øvelser fundet i sessionen.', 'error'); return }

    setPendingSessionAction(`${session.id}:skip`)
    const { data: existing, error: fetchErr } = await supabase
      .from('exercise_logs')
      .select('exercise_id, set_number')
      .eq('athlete_id', athlete.id)
      .in('exercise_id', exerciseIds)
    if (fetchErr) { setPendingSessionAction(null); showFlash('Sættene kunne ikke tjekkes. Tjek din forbindelse og prøv igen.', 'error'); return }

    const logged = new Set((existing || []).map(l => `${l.exercise_id}_${l.set_number}`))
    const rows = []
    for (const ex of (session.exercises || [])) {
      for (let n = 1; n <= (parseInt(ex.sets) || 0); n++) {
        if (logged.has(`${ex.id}_${n}`)) continue
        rows.push({ exercise_id: ex.id, athlete_id: athlete.id, set_number: n, weight: null, reps_completed: null, note: null, rpe_actual: null, rpe_planned: null, skipped: true })
      }
    }

    if (rows.length === 0) {
      setPendingSessionAction(null)
      showFlash('Alle sæt er allerede logget.')
      return
    }

    const ok = await runGuardedWrite(
      () => supabase.from('exercise_logs').insert(rows),
      () => showFlash('Sættene kunne ikke springes over. Tjek din forbindelse og prøv igen.', 'error'),
    )
    setPendingSessionAction(null)
    if (!ok) return

    showFlash(`${rows.length} sæt sprunget over.`)
    await fetchExerciseLogs(athlete.id, currentWeek)
    await fetchPastLogs(allWeeks[viewingWeekIdx], athlete.id)
  }

  return {
    logSet, logDagensPasSet, flushOfflineSets, undoLoggedSet, updateLoggedSet, skipSet, skipExercise, unskipSet,
    saveFeedback, autoCompleteSession, skipRemainingSets,
  }
}
