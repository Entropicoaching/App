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
import { isSessionDone } from '../nextSet'
import { startRestPause, clearRestPause } from '../restPause'
import {
  saveOfflineSet, loadOfflineSets, countOfflineSets, clearOfflineSetIfSame, newSetClientId,
  orderedOfflineSets, parkOfflineSet, queuedPayloadWithTime, noteOfflineSetFailure, queueUndoTombstone,
  saveQueuedRating, loadQueuedRatings, clearQueuedRatingIfSame,
  saveQueuedRecord, loadQueuedRecords, clearQueuedRecord, recordKey,
} from '../offlineSetQueue'
import { browserSaysOffline, seemsOffline, withSlowNetCutoff } from '../offlineSession'
import { parsePlannedRpe, logFrontendError } from './ugeHjaelp'
import { erDeloadBlok } from '../exerciseProgress.js'
import { bygGrundlag, findRekord, rekordTekst, ugensSaet, ugensOevelsesIds } from './rekorder'

// ORDRE 397 (docs/OFFLINE-PAS.md): uden net forsøges ingen skrivning; den
// ville ellers stå i queueWrite's kø bag et auth-refresh, der selv prøver i
// ~25 s, og holde alle senere skrivninger tilbage. Sættet ligger allerede i
// den lokale kø og sendes af flushOfflineSets.
const OFFLINE_ERROR = { code: 'OFFLINE', message: 'Ingen forbindelse' }
// Én afsendelse af køen ad gangen i denne fane ('online', app-åbning og
// genhentning kan starte den samtidig). Modul-niveau, fordi fabrikken kaldes
// i hvert render.
let flushInFlight = false
// ORDRE 456 (A3): samme for køen af vurderinger.
let ratingFlushInFlight = false
// ORDRE 456 (A5): rekord-rækkerne til personal_records skrives én ad gangen,
// så to afsendelser af samme sæt (køen og det direkte svar) ikke begge skriver.
let prKaede = Promise.resolve()
// Fremmednøgle-brud: øvelsen findes ikke mere (coachen har slettet den).
const isPermanentSetError = (error) => error?.code === '23503'
// ORDRE 406 (O6 i docs/kritik-403): en fejl, serveren selv har sagt (en kode fra
// Postgres/PostgREST eller et afvist login), bliver ved med at komme igen på et
// net der virker. Efter så mange runder parkeres sættet synligt i stedet for at
// stå som "sendes når forbindelsen er tilbage" for evigt. Fejl uden kode (net,
// timeout, 5xx) tæller ikke: dem klarer næste runde.
const MAX_SET_FAILURES = 5
const isServerRefusal = (error) => /^(PGRST|22|23|28|42|P0)/.test(String(error?.code || '')) || /jwt/i.test(String(error?.message || ''))

export function lavSaetSkrivning({
  allWeeks, athlete, currentWeek, exerciseLogs, feedbackInputs, fetchExerciseLogs, fetchPastLogs, lastLogByExerciseName,
  logInputs, setAllWeeks, setExerciseLogs, setLastLoggedSet, setLogInputs, setPendingSessionAction, setPendingSyncCount, setPrToast,
  setPrToastFading, setRestPause, setSetConfirm, setWriteRef, showFlash, viewingWeekIdx,
  rekordGrundlagFoer, setRekordFejring, fejredeRef,
}) {
  // ORDRE 439 · blok 1: er sættet en ny rekord? Regnes mod alle ANDRE sæt:
  // tidligere uger (rekordGrundlagFoer, fra Fremgangs historik) + ugens sæt
  // uden dette. Kendes historikken ikke (endnu ikke hentet, intet
  // øjebliksbillede), fejres intet: hellere ingen fejring end en falsk.
  function rekordForSaet(exerciseId, key, navn, payload) {
    if (!rekordGrundlagFoer || !ugensOevelsesIds(currentWeek).has(exerciseId)) return null
    const grundlag = bygGrundlag(ugensSaet(exerciseLogs, currentWeek, allWeeks, key), rekordGrundlagFoer)
    return findRekord(grundlag, { navn, weight: payload.weight, reps: payload.reps_completed, deload: erDeloadBlok(currentWeek?.block_name) })
  }

  // Én fejring pr. sæt og værdi: køens senere afsendelse, en genhentning
  // eller et nyt tryk på samme sæt fejrer ikke igen. Fra Dagens pas står den
  // på kortet (paaKortet); fra Program-fanen i toast-pladsen.
  function fejrRekord(rekord, key, payload, paaKortet) {
    if (!rekord || !fejredeRef) return
    const id = `${key}:${payload.weight}:${payload.reps_completed}`
    if (fejredeRef.current.has(id)) return
    fejredeRef.current.add(id)
    const tekst = rekordTekst(rekord)
    if (paaKortet && setRekordFejring) {
      setRekordFejring({ id, key, tekst })
      setTimeout(() => setRekordFejring(p => (p?.id === id ? null : p)), 5000)
      return
    }
    setPrToast({ tekst })
    setPrToastFading(false)
    setTimeout(() => setPrToastFading(true), 3400)
    setTimeout(() => setPrToast(null), 4000)
  }

  // Skriver ét sæt til databasen, serialiseret pr. nøgle. Fordi skridtene kædes
  // (chain.then), ser en efterfølgende skrivning altid det rigtige id fra den
  // foregående INSERT → aldrig dubletter, og seneste værdi vinder. Returnerer
  // { data, error } fra det underliggende kald, så kalderen kan rulle tilbage.
  // ORDRE 397: idempotent INSERT. Rækken får et klient-dannet id (clientId,
  // samme ved hvert genforsøg), så et INSERT der nåede frem, men hvis svar gik
  // tabt, ikke bliver til to rækker: nummer to afvises med 23505, og så
  // opdateres den række der allerede står der. Ingen migration: id er
  // primærnøglen i forvejen.
  // Sættets række hos serveren: (atlet, øvelse, sæt). En øvelse hører til én
  // dag i én uge, så øvelsens id dækker også uge og dag.
  const findSetRow = (exerciseId, setNumber) => supabase
    .from('exercise_logs').select('id, logged_at')
    .eq('athlete_id', athlete.id).eq('exercise_id', exerciseId).eq('set_number', setNumber)
    .limit(1)

  async function insertSetLog(exerciseId, setNumber, payload, clientId, { lookupFirst = false } = {}) {
    const row = { exercise_id: exerciseId, athlete_id: athlete.id, set_number: setNumber, ...payload }
    const findExisting = () => findSetRow(exerciseId, setNumber)
    const updateExisting = async (id, body = payload) => {
      const upd = await supabase.from('exercise_logs').update(body).eq('id', id).select('id')
      if (upd.error) return upd
      return { data: { id }, error: null }
    }
    if (lookupFirst) {
      // ORDRE 406 (O2 i docs/kritik-403): række-id'et er nyt, så skærmen kender
      // ikke rækken. Står sættet allerede hos serveren (sendt fra en tidligere
      // åbning, en anden fane eller telefon), opdateres den række i stedet for
      // at lave en dublet, og sættet beholder sin første tid. Kan opslaget ikke
      // gennemføres, returneres fejlen: et sæt fra "Godkendt" ligger i køen, og
      // køens runde slår selv op igen.
      const found = await findExisting()
      if (found.error) return found
      const known = found.data?.[0]
      if (known?.id) return updateExisting(known.id, known.logged_at ? { ...payload, logged_at: known.logged_at } : payload)
    }
    let res = await supabase.from('exercise_logs').insert(clientId ? { id: clientId, ...row } : row).select('id').single()
    if (clientId && (res.error?.code === '22P02' || res.error?.code === '42804')) {
      // id-kolonnen tog mod forventning ikke imod et UUID: samme INSERT uden
      // id, med opslag-før-indsæt som værn mod dubletter.
      const found = await findExisting()
      if (found.error) return found
      if (found.data?.[0]?.id) return updateExisting(found.data[0].id)
      res = await supabase.from('exercise_logs').insert(row).select('id').single()
    }
    if (res.error?.code === '23505') {
      // Rækken findes allerede: først vores eget id, ellers (atlet, øvelse, sæt).
      if (clientId) {
        const own = await supabase.from('exercise_logs').update(payload).eq('id', clientId).select('id')
        if (own.error) return own
        if (Array.isArray(own.data) && own.data.length) return { data: { id: clientId }, error: null }
      }
      const found = await findExisting()
      if (found.error) return found
      if (!found.data?.[0]?.id) return res
      return updateExisting(found.data[0].id)
    }
    return res
  }

  // ORDRE 401: hasQueue = sættet ligger i den lokale kø, som sender igen. Så
  // stoppes genforsøgene, når nettet er kendt dødt (se queueWrite's giveUpIf).
  // ORDRE 406: lookupFirst = række-id'et er nyt (ingen køpost, ingen tidligere
  // skrivning i denne åbning), så insertSetLog slår sættet op før INSERT.
  function persistSetLog(key, exerciseId, setNumber, payload, realExistingId, clientId, { hasQueue = false, lookupFirst = false } = {}) {
    // ORDRE 414 (O7): `sent` opfyldes, når skrivningen får sin tur i den globale
    // skrivekø; det er dér kalderens 8-s-ur starter (withSlowNetCutoff's startWhen).
    let markSent
    const sent = new Promise((resolve) => { markSent = resolve })
    const writeOpts = hasQueue ? { giveUpIf: seemsOffline, onStart: markSent } : { onStart: markSent }
    const ref = setWriteRef.current[key] || (setWriteRef.current[key] = { realId: null, chain: Promise.resolve() })
    if (realExistingId) ref.realId = realExistingId
    if (clientId) ref.clientId = clientId
    const task = ref.chain.then(async () => {
      if (browserSaysOffline()) return { data: null, error: OFFLINE_ERROR }
      if (ref.realId) {
        const upd = await queueWrite(() => supabase.from('exercise_logs').update(payload).eq('id', ref.realId).select('id'), writeOpts)
        if (upd.error) return upd                                   // transient fejl → lad kalderen vise fejl/retry (ingen dublet)
        if (Array.isArray(upd.data) && upd.data.length) return upd  // rækken blev opdateret
        ref.realId = null                                           // rækken findes ikke mere (fx slettet) → INSERT nedenfor
      }
      const res = await queueWrite(() => insertSetLog(exerciseId, setNumber, payload, ref.clientId, { lookupFirst }), writeOpts)
      if (res?.data?.id) ref.realId = res.data.id
      return res
    })
    // Hold kæden i live selv hvis en skrivning fejler/kaster.
    ref.chain = task.then(() => {}, () => {})
    task.sent = sent
    return task
  }

  // ORDRE 401: et sæt der ligger i køen, venter højst SLOW_NET_MS på serveren.
  // Svarer den ikke (wifi uden internet), får kalderen SLOW_NET og viser sættet
  // som ventende; kaldet kører videre i baggrunden, og når det frem, fjernes
  // køposten her (ellers sender flushOfflineSets den med samme række-id).
  async function sendQueuedSet(key, exerciseId, setNumber, payload, realExistingId, clientId, { lookupFirst = false, pr = null } = {}) {
    const write = persistSetLog(key, exerciseId, setNumber, payload, realExistingId, clientId, { hasQueue: true, lookupFirst })
    const res = await withSlowNetCutoff(write, undefined, { startWhen: write.sent })
    if (res.error?.code === 'SLOW_NET') {
      write.then((late) => {
        if (late?.error) return
        clearOfflineSetIfSame(athlete.id, key, { payload })
        setPendingSyncCount(countOfflineSets(athlete.id))
        gemRekordRaekke(pr)
      }, () => {})
    }
    return res
  }

  // ORDRE 456 (A5 i docs/kritik-446): personal_records (coachens PR-tidslinje og
  // "Dine rekorder") skrives fra de samme rekorder, som fejres (rekorder.js), og
  // først når sættet er hos serveren, også når køen sender det senere. Én gang:
  // står (øvelse, vægt, reps) der allerede, skrives intet. Før 456 blev
  // rekorden regnet ud igen mod personal_records ved hvert sæt, kun når
  // serveren svarede i samme tryk, og to hurtige sæt gav dubletter.
  // Rækken ligger i en lokal kø (offlineSetQueue.js), til den er skrevet: lukkes
  // appen mellem sættet og rækken, skrives den ved næste åbning.
  // Uden pr: send bare det, der ligger i køen (flushOfflineSets).
  async function gemRekordRaekke(pr = null) {
    if (!athlete?.id) return
    const lagt = pr ? saveQueuedRecord(athlete.id, pr) : false
    const opgave = prKaede.then(async () => {
      if (browserSaysOffline()) return
      const koe = { ...loadQueuedRecords(athlete.id) }
      if (pr && !lagt && Number(pr.weight) > 0 && Number(pr.reps) > 0) koe[recordKey(pr)] = pr
      for (const [id, r] of Object.entries(koe)) {
        const { data: prData, error: prFetchError } = await supabase
          .from('personal_records')
          .select('weight, reps')
          .eq('athlete_id', athlete.id)
          .eq('exercise_name', r.exercise_name)
          .eq('weight', r.weight)
          .eq('reps', r.reps)
          .limit(1)
        if (prFetchError) {
          // En fejlet SELECT er ikke "ingen række": hellere vente end lave en dublet.
          if (!seemsOffline()) logFrontendError('Rekord ikke skrevet endnu: SELECT på personal_records fejlede', prFetchError, athlete.id)
          return
        }
        if (!(prData || []).length) {
          const { error: prSaveError } = await queueWrite(() => supabase.from('personal_records').insert({
            athlete_id: athlete.id,
            exercise_name: r.exercise_name,
            weight: r.weight,
            reps: r.reps,
          }))
          if (prSaveError) {
            logFrontendError('Rekord: INSERT på personal_records fejlede, ligger i køen', prSaveError, athlete.id)
            recordSilentFail(athlete.id, 'silent:pr-insert-failed')
            return
          }
        }
        clearQueuedRecord(athlete.id, id)
      }
    })
    prKaede = opgave.catch(() => {})
    return opgave
  }

  // ORDRE 422: er passet færdigt, når dette sæt (logget eller sprunget over)
  // står som gjort? Samme regel som Dagens pas' "Passet er færdigt"
  // (isSessionDone: alle sæt har en række).
  function pasFaerdigtEfter(exerciseId, setNumber) {
    const sess = allWeeks.flatMap(w => w.sessions || []).find(se => (se.exercises || []).some(e => e.id === exerciseId))
    if (!sess) return false
    const logs = exerciseLogs.filter(l => !(l.exercise_id === exerciseId && l.set_number === setNumber))
    return isSessionDone(sess, [...logs, { exercise_id: exerciseId, set_number: setNumber }])
  }

  async function logSet(exerciseId, setNumber, totalSets, repsCompleted, plannedRpe, { localFallback = false } = {}) {
    const key = `${exerciseId}_${setNumber}`
    const input = logInputs[key] || {}
    // Kun en rigtig (bekræftet) række afgør INSERT vs. UPDATE i databasen — en
    // optimistisk række har ikke et gyldigt db-id at opdatere på.
    const realExisting = exerciseLogs.find(l => l.exercise_id === exerciseId && l.set_number === setNumber && !l._optimistic)
    const existing = exerciseLogs.find(l => l.exercise_id === exerciseId && l.set_number === setNumber)
    const payload = {
      // ORDRE 401: tidspunktet for "Godkendt" følger sættet ind i køen, så et
      // sæt sendt senere beholder sin tid hos coachen. Et sæt der allerede
      // står som logget, beholder sin første tid.
      logged_at: existing?.logged_at || new Date().toISOString(),
      weight: parseFloat(input.weight) || 0,
      reps_completed: parseInt(repsCompleted) || 0,
      note: input.note || null,
      // Ingen egen RPE valgt → gem den planlagte RPE, så vi altid har data at
      // autoregulere på. Rører atleten vælgeren, gemmes deres værdi i stedet.
      rpe_actual: input.rpe ? parseFloat(input.rpe) : (plannedRpe ?? null),
      rpe_planned: plannedRpe ?? null,
      skipped: false,
    }

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
    // ORDRE 422: efter passets sidste sæt er der ingen næste at holde pause
    // til — pausen startes ikke, og en pause fra forrige sæt ryddes.
    const loggedExercise = allWeeks.flatMap(w => w.sessions || []).flatMap(sess => sess.exercises || []).find(e => e.id === exerciseId)
    const rekord = rekordForSaet(exerciseId, key, loggedExercise?.name, payload)
    if (pasFaerdigtEfter(exerciseId, setNumber)) {
      clearRestPause(athlete.id)
      setRestPause(null)
    } else {
      const restSeconds = restSecondsForExercise(loggedExercise)
      startRestPause(athlete.id, restSeconds, loggedExercise?.name)
      setRestPause({ startedAt: Date.now(), durationSeconds: restSeconds, label: loggedExercise?.name || null })
    }
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
    // ORDRE 397: samme række-id ved hvert forsøg (også efter genstart og efter
    // "fortryd"), se insertSetLog. Uden net vises markeringen med det samme.
    const knownClientId = loadOfflineSets(athlete.id)[key]?.clientId || setWriteRef.current[key]?.clientId
    const clientId = knownClientId || newSetClientId()
    // ORDRE 406 (O2): nyt id og ingen række på skærmen → slå op før INSERT.
    const lookupFirst = !knownClientId && !realExisting
    // ORDRE 456 (A5): rekorden følger sættet ind i køen og skrives i
    // personal_records, når sættet er sendt (her eller af flushOfflineSets).
    const pr = rekord && loggedExercise?.name ? { exercise_name: loggedExercise.name, weight: payload.weight, reps: payload.reps_completed } : null
    const queued = localFallback
      ? saveOfflineSet(athlete.id, key, { exerciseId, setNumber, payload, clientId, exerciseName: loggedExercise?.name || null, pr })
      : false
    // Er nettet kendt dødt (også når browseren tror den er online, se
    // offlineSession.js), forsøges intet: sættet ligger i køen og sendes af
    // flushOfflineSets, når et kald lykkes igen.
    // ORDRE 439: sættet er gemt på telefonen → fejres nu, også uden net.
    if (queued) fejrRekord(rekord, key, payload, true)
    const skipNetwork = queued && seemsOffline()
    if (skipNetwork) setPendingSyncCount(countOfflineSets(athlete.id))
    const { error } = skipNetwork
      ? { error: OFFLINE_ERROR }
      : queued
        ? await sendQueuedSet(key, exerciseId, setNumber, payload, realExisting?.id, clientId, { lookupFirst, pr })
        : await persistSetLog(key, exerciseId, setNumber, payload, realExisting?.id, clientId, { lookupFirst })
    if (error) {
      // ORDRE 280 · commit 4 — "Godkendt" i Dagens pas beder om localFallback:
      // sættet er allerede vist som logget (optimistisk, ovenfor); i stedet
      // for at rulle det tilbage til en fejlbesked, gemmes payloaden lokalt
      // (offlineSetQueue.js) og sendes igen når forbindelsen er der (se
      // flushOfflineSets). Ingen ny tabel — samme exercise_logs-række som
      // ellers, bare forsinket. (Selve kø-posten er lagt FØR skrivningen, se
      // ovenfor; her skrives den igen, hvis den første gang ikke kunne gemmes.)
      if (localFallback && isPermanentSetError(error)) {
        parkOfflineSet(athlete.id, key, { exerciseId, setNumber, payload, clientId, exerciseName: loggedExercise?.name || null }, error.code)
        logFrontendError('Sæt kunne ikke gemmes: øvelsen findes ikke mere', error, athlete.id)
        setPendingSyncCount(countOfflineSets(athlete.id))
        return
      }
      if (localFallback && queued) {
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
      clearOfflineSetIfSame(athlete.id, key, { payload })
      setPendingSyncCount(countOfflineSets(athlete.id))
    }
    // Ikke i køen (Program-fanen, eller lageret var fuldt): fejres først nu,
    // hvor serveren har sættet. Et sæt der rulles tilbage, fejres aldrig.
    if (!queued) fejrRekord(rekord, key, payload, localFallback)
    fetchExerciseLogs(athlete.id, currentWeek)
    // ORDRE 456 (A5): rekorden i personal_records (se gemRekordRaekke).
    gemRekordRaekke(pr)
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
  // ORDRE 406 (O6 i docs/kritik-403): en fejl i køens runde, der hverken er
  // "ingen net" eller 23503, sluges ikke mere. Den logges første gang (og når
  // fejlkoden skifter), og afviser serveren sættet MAX_SET_FAILURES runder i
  // træk, parkeres det synligt, så atleten kan give tallene til coachen.
  function noteRoundFailure(key, entry, error, trin) {
    const code = String(error?.code || error?.status || 'ukendt')
    const counts = isServerRefusal(error)
    const { failures, newCode } = noteOfflineSetFailure(athlete.id, key, entry, code, { count: counts })
    if (newCode) logFrontendError(`Ventende sæt: ${trin} fejlede (${code}), bliver i køen`, error, athlete.id)
    if (counts && failures >= MAX_SET_FAILURES) {
      parkOfflineSet(athlete.id, key, entry, code)
      logFrontendError(`Ventende sæt parkeret efter ${failures} afviste forsøg (${code})`, error, athlete.id)
    }
  }

  async function flushOfflineSets() {
    if (!athlete?.id || browserSaysOffline()) return
    // ORDRE 456 (A3, A5): ventende vurderinger af passet og rekord-rækker sendes
    // ved samme lejligheder.
    sendVurderinger()
    gemRekordRaekke()
    if (flushInFlight) return
    if (!Object.keys(loadOfflineSets(athlete.id)).length) return
    flushInFlight = true
    try {
      // ORDRE 397: i den rækkefølge sættene blev logget, ét ad gangen.
      for (const [key, entry] of orderedOfflineSets(athlete.id)) {
        if (browserSaysOffline()) break
        const { exerciseId, setNumber, clientId } = entry
        const payload = queuedPayloadWithTime(entry)
        if (entry.op === 'delete') {
          // Fortryd uden net af et sæt der måske nåede serveren (se undoLoggedSet).
          let markSent
          const sent = new Promise((resolve) => { markSent = resolve })
          const { error } = await withSlowNetCutoff(queueWrite(() => supabase.from('exercise_logs').delete().eq('id', clientId).eq('athlete_id', athlete.id), { giveUpIf: seemsOffline, onStart: markSent }), undefined, { startWhen: sent })
          if (!error) clearOfflineSetIfSame(athlete.id, key, entry)
          else if (seemsOffline()) break
          continue
        }
        let realId = exerciseLogs.find(l => l.exercise_id === exerciseId && l.set_number === setNumber && !l._optimistic)?.id
        if (!realId) {
          // ORDRE 293 · F5: køen står nu FØR skrivningen, så en post kan høre til
          // et sæt serveren allerede har taget imod (appen døde før svaret kom
          // tilbage). Slå rækken op først, så genafspilningen bliver en UPDATE
          // og ikke en dublet. Kan opslaget ikke gennemføres, ligger posten
          // stadig i køen til næste forsøg.
          const { data: found, error: lookupError } = await withSlowNetCutoff(findSetRow(exerciseId, setNumber))
          if (lookupError) {
            if (seemsOffline()) break
            noteRoundFailure(key, entry, lookupError, 'opslag')
            continue
          }
          realId = found?.[0]?.id
        }
        // ORDRE 401: et hængende kald stopper runden efter SLOW_NET_MS (nettet
        // huskes som dødt); posten bliver i køen til næste runde.
        const write = persistSetLog(key, exerciseId, setNumber, payload, realId, clientId, { hasQueue: true })
        const { error } = await withSlowNetCutoff(write, undefined, { startWhen: write.sent })
        if (!error) {
          clearOfflineSetIfSame(athlete.id, key, entry)
          // ORDRE 456 (A5): en rekord sat uden net kommer nu også i personal_records.
          gemRekordRaekke(entry.pr)
        } else if (seemsOffline()) break
        else if (isPermanentSetError(error)) {
          // Coachen har slettet øvelsen imens: kan aldrig gemmes. Parkeres
          // synligt for atleten i stedet for at blive prøvet for evigt.
          parkOfflineSet(athlete.id, key, entry, error.code)
          logFrontendError('Ventende sæt kunne ikke gemmes: øvelsen findes ikke mere', error, athlete.id)
        } else noteRoundFailure(key, entry, error, 'afsendelse')
      }
    } finally {
      flushInFlight = false
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
    // ORDRE 439: et fortrudt sæt er ingen rekord; logges det igen, må det fejres.
    if (setRekordFejring) setRekordFejring(p => (p?.key === key ? null : p))
    if (fejredeRef) for (const id of [...fejredeRef.current]) if (id.startsWith(`${key}:`)) fejredeRef.current.delete(id)
    setExerciseLogs(prev => prev.filter(l => !(l.exercise_id === exerciseId && l.set_number === setNumber)))
    clearRestPause(athlete.id)
    setRestPause(null)
    setLastLoggedSet(null)
    // Sættet kan være ventende lokalt (blev "Godkendt" uden net, se
    // flushOfflineSets) — fortryd skal ikke sende det senere.
    // ORDRE 414 (O4): sættets køpost erstattes med det samme (synkront) af en
    // sletning på det række-id, sættet har eller kan have fået hos serveren
    // (397: INSERT'et kan være nået frem, uden at svaret gjorde). Dør appen,
    // mens sættets skrivning stadig hænger, sletter køens runde rækken senere.
    const queuedEntry = loadOfflineSets(athlete.id)[key]
    const ref = setWriteRef.current[key]
    let tombstone = queueUndoTombstone(athlete.id, key, { exerciseId, setNumber, rowId: ref?.realId || ref?.clientId || queuedEntry?.clientId })
    setPendingSyncCount(countOfflineSets(athlete.id))
    const chain = ref ? ref.chain : Promise.resolve()
    const task = chain.then(async () => {
      if (!tombstone) return
      // Sættets skrivning er færdig nu. Fandt den en række med et andet id (opslag
      // før INSERT, 406), er det den, der skal slettes; køens post rettes til.
      const idToDelete = ref?.realId || tombstone.clientId
      if (idToDelete !== tombstone.clientId) {
        const current = loadOfflineSets(athlete.id)[key]
        if (current?.op === 'delete' && current.clientId === tombstone.clientId) {
          tombstone = queueUndoTombstone(athlete.id, key, { exerciseId, setNumber, rowId: idToDelete })
        }
      }
      if (seemsOffline()) return
      const { error } = await queueWrite(() => supabase.from('exercise_logs').delete().eq('id', idToDelete))
      if (error) {
        logFrontendError('Fortryd sæt: sletning fejlede, ligger i køen', error, athlete.id)
        return
      }
      clearOfflineSetIfSame(athlete.id, key, tombstone)
      if (ref?.realId === idToDelete) ref.realId = null
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
    // ORDRE 397: også et sæt der er logget uden net (optimistisk række, ligger
    // i køen) kan rettes; så opdateres køposten, og afsendelsen bliver et
    // INSERT med sættets række-id i stedet for en UPDATE.
    const existing = exerciseLogs.find(l => l.exercise_id === exerciseId && l.set_number === setNumber)
    if (!existing) return false
    const realExistingId = existing._optimistic ? undefined : existing.id
    const payload = {
      // ORDRE 401: en rettelse flytter ikke sættet i tid.
      logged_at: existing.logged_at || new Date().toISOString(),
      weight: parseFloat(updates.weight) || 0,
      reps_completed: parseInt(updates.reps) || 0,
      note: existing.note ?? null,
      rpe_actual: existing.rpe_actual ?? null,
      rpe_planned: existing.rpe_planned ?? null,
      skipped: false,
    }
    setExerciseLogs(prev => applySetEdit(prev, exerciseId, setNumber, payload))
    const knownClientId = loadOfflineSets(athlete.id)[key]?.clientId || setWriteRef.current[key]?.clientId
    const clientId = knownClientId || newSetClientId()
    const lookupFirst = !knownClientId && !realExistingId
    const queued = saveOfflineSet(athlete.id, key, { exerciseId, setNumber, payload, clientId })
    const skipNetwork = queued && seemsOffline()
    if (skipNetwork) setPendingSyncCount(countOfflineSets(athlete.id))
    const { error } = skipNetwork
      ? { error: OFFLINE_ERROR }
      : queued
        ? await sendQueuedSet(key, exerciseId, setNumber, payload, realExistingId, clientId, { lookupFirst })
        : await persistSetLog(key, exerciseId, setNumber, payload, realExistingId, clientId, { lookupFirst })
    if (error) {
      if (!queued) {
        // ORDRE 406 (O6): køen kunne ikke gemme rettelsen (fx fuld lagerplads),
        // så den ligger ingen steder. Sig det, og vis sættet som før rettelsen.
        logFrontendError('Ret sæt: opdatering fejlede og kunne ikke lægges i køen', error, athlete.id)
        setExerciseLogs(prev => applySetEdit(prev, exerciseId, setNumber, existing))
        showFlash('Rettelsen kunne ikke gemmes. Tjek din forbindelse og prøv igen.', 'error')
        return false
      }
      // Samme optimistiske fallback som logSet: forbliver rettet i UI,
      // ligger i offline-køen til flushOfflineSets sender den igen.
      if (error.code !== 'OFFLINE' && error.code !== 'SLOW_NET') logFrontendError('Ret sæt: opdatering fejlede, lagt i offline-kø', error, athlete.id)
      setPendingSyncCount(countOfflineSets(athlete.id))
      return true
    }
    clearOfflineSetIfSame(athlete.id, key, { payload })
    setPendingSyncCount(countOfflineSets(athlete.id))
    fetchExerciseLogs(athlete.id, currentWeek)
    return true
  }

  // ORDRE 456 (A2 i docs/kritik-446): "Spring over" går gennem samme lokale kø
  // som "Godkendt": sættet står som sprunget over med det samme, med tiden for
  // trykket, og sendes, når der er net. Før skrev det direkte og gav uden net
  // kun en fejlbesked, så atleten måtte godkende et sæt, der ikke blev lavet.
  // null = lageret kunne ikke tage sættet; så skriver kalderen direkte som før.
  function springOverIKoe(exerciseId, setNumber, plannedRpe, { pause = false } = {}) {
    const key = `${exerciseId}_${setNumber}`
    const existing = exerciseLogs.find(l => l.exercise_id === exerciseId && l.set_number === setNumber)
    const realExisting = existing && !existing._optimistic ? existing : null
    const payload = { logged_at: new Date().toISOString(), skipped: true, weight: 0, reps_completed: 0, note: null, rpe_actual: null, rpe_planned: plannedRpe ?? null }
    const knownClientId = loadOfflineSets(athlete.id)[key]?.clientId || setWriteRef.current[key]?.clientId
    const clientId = knownClientId || newSetClientId()
    const exerciseName = allWeeks.flatMap(w => w.sessions || []).flatMap(se => se.exercises || []).find(e => e.id === exerciseId)?.name || null
    if (!saveOfflineSet(athlete.id, key, { exerciseId, setNumber, payload, clientId, exerciseName })) return null
    if (existing) {
      setExerciseLogs(prev => prev.map(l => (l.exercise_id === exerciseId && l.set_number === setNumber) ? { ...l, ...payload } : l))
    } else {
      setExerciseLogs(prev => [
        ...prev,
        { id: `optimistic_${key}`, exercise_id: exerciseId, athlete_id: athlete.id, set_number: setNumber, ...payload, _optimistic: true },
      ])
    }
    if (pause && pasFaerdigtEfter(exerciseId, setNumber)) { clearRestPause(athlete.id); setRestPause(null) }
    setPendingSyncCount(countOfflineSets(athlete.id))
    return { key, exerciseId, setNumber, payload, clientId, realExistingId: realExisting?.id, lookupFirst: !knownClientId && !realExisting }
  }

  // Sender et sprunget sæt fra køen. true = serveren har det.
  async function sendSpring(spring) {
    if (seemsOffline()) return false
    const { key, exerciseId, setNumber, payload, realExistingId, clientId, lookupFirst } = spring
    const { error } = await sendQueuedSet(key, exerciseId, setNumber, payload, realExistingId, clientId, { lookupFirst })
    if (error) {
      if (error.code !== 'OFFLINE' && error.code !== 'SLOW_NET') logFrontendError('Spring over: afsendelse fejlede, ligger i køen', error, athlete.id)
      setPendingSyncCount(countOfflineSets(athlete.id))
      return false
    }
    clearOfflineSetIfSame(athlete.id, key, { payload })
    setPendingSyncCount(countOfflineSets(athlete.id))
    return true
  }

  async function skipSet(exerciseId, setNumber, plannedRpe) {
    const spring = springOverIKoe(exerciseId, setNumber, plannedRpe, { pause: true })
    if (spring) {
      if (await sendSpring(spring)) fetchExerciseLogs(athlete.id, currentWeek)
      return
    }
    // Lageret kunne ikke tage sættet: direkte, med garden, som før 456.
    const existing = exerciseLogs.find(l => l.exercise_id === exerciseId && l.set_number === setNumber)
    const payload = { skipped: true, weight: 0, reps_completed: 0, note: null, rpe_actual: null, rpe_planned: plannedRpe ?? null }
    const ok = await runGuardedWrite(
      () => existing
        ? supabase.from('exercise_logs').update(payload).eq('id', existing.id)
        : supabase.from('exercise_logs').insert({ exercise_id: exerciseId, athlete_id: athlete.id, set_number: setNumber, ...payload }),
      () => showFlash('Sættet kunne ikke springes over. Tjek din forbindelse og prøv igen.', 'error'),
    )
    if (!ok) return
    if (pasFaerdigtEfter(exerciseId, setNumber)) { clearRestPause(athlete.id); setRestPause(null) }
    fetchExerciseLogs(athlete.id, currentWeek)
  }

  async function skipExercise(ex) {
    const plannedRpe = parsePlannedRpe(ex.intensity)
    const toSkip = Array.from({ length: ex.sets || 0 }, (_, i) => i + 1).filter(setNum =>
      !exerciseLogs.find(l => l.exercise_id === ex.id && l.set_number === setNum)
    )
    if (toSkip.length === 0) return
    // ORDRE 456 (A2): samme kø som skipSet; kun det, lageret ikke kunne tage,
    // skrives direkte som før.
    const iKoe = toSkip.map(setNum => springOverIKoe(ex.id, setNum, plannedRpe))
    if (iKoe.some(Boolean)) {
      const sendt = await Promise.all(iKoe.filter(Boolean).map(sendSpring))
      if (sendt.every(Boolean) && iKoe.every(Boolean)) fetchExerciseLogs(athlete.id, currentWeek)
    }
    const direkte = toSkip.filter((_, i) => !iKoe[i])
    if (direkte.length === 0) return
    const ok = await runGuardedWrite(
      () => supabase.from('exercise_logs').insert(
        direkte.map(setNum => ({ exercise_id: ex.id, athlete_id: athlete.id, set_number: setNum, skipped: true, weight: 0, reps_completed: 0, rpe_planned: plannedRpe ?? null }))
      ),
      () => showFlash('Øvelsen kunne ikke springes over. Tjek din forbindelse og prøv igen.', 'error'),
    )
    if (!ok) return
    fetchExerciseLogs(athlete.id, currentWeek)
  }

  async function unskipSet(exerciseId, setNumber) {
    const existing = exerciseLogs.find(l => l.exercise_id === exerciseId && l.set_number === setNumber)
    if (!existing) return
    // ORDRE 456 (A2): et spring, der venter i køen (eller hvis række-id ikke er
    // kendt endnu), fortrydes som "Fortryd sidste sæt": køposten erstattes af en
    // sletning, der også virker uden net.
    if (existing._optimistic || loadOfflineSets(athlete.id)[`${exerciseId}_${setNumber}`]) {
      await undoLoggedSet(exerciseId, setNumber)
      return
    }
    const ok = await runGuardedWrite(
      () => supabase.from('exercise_logs').delete().eq('id', existing.id),
      () => showFlash('Kunne ikke fortryde spring over. Tjek din forbindelse og prøv igen.', 'error'),
    )
    if (!ok) return
    fetchExerciseLogs(athlete.id, currentWeek)
  }

  // ORDRE 419 (I3): `direkte` = { rating } fra Dagens pas-kortet (samme
  // skrivning, uden om feedbackInputs, som ikke er opdateret i samme tryk).
  // Returnerer true/false, så kortet ved, om vurderingen blev gemt.
  async function saveFeedback(sessionId, direkte = null) {
    const input = direkte || feedbackInputs[sessionId] || {}
    if (!input.rating) return false
    // ORDRE 456 (A3 i docs/kritik-446): vurderingen lægges i en lokal kø
    // (offlineSetQueue.js) og vises med det samme; den sendes nu, eller når der
    // er net igen, også efter en genåbning (flushOfflineSets). Før gik den tabt
    // uden net. Kan lageret ikke tage den, skrives direkte som før.
    const vurdering = { rating: input.rating, comment: input.comment || null }
    if (saveQueuedRating(athlete.id, sessionId, vurdering)) {
      setAllWeeks(prev => prev.map(w => ({
        ...w,
        sessions: (w.sessions || []).map(s => s.id === sessionId ? { ...s, athlete_rating: vurdering.rating, athlete_comment: vurdering.comment } : s),
      })))
      sendVurderinger()
      return true
    }
    setPendingSessionAction(`${sessionId}:feedback`)
    const ok = await runGuardedWrite(
      () => supabase.from('sessions').update({
        athlete_rating: input.rating,
        athlete_comment: input.comment || null,
      }).eq('id', sessionId),
      () => showFlash('Feedbacken blev ikke gemt. Tjek din forbindelse og prøv igen.', 'error'),
    )
    setPendingSessionAction(null)
    if (!ok) return false
    setAllWeeks(prev => prev.map(w => ({
      ...w,
      sessions: (w.sessions || []).map(s => s.id === sessionId ? { ...s, athlete_rating: input.rating, athlete_comment: input.comment || null } : s),
    })))
    return true
  }

  // ORDRE 456 (A3): sender køens vurderinger, én ad gangen. En fejl lader
  // resten ligge til næste runde ('online', app-åbning, flushOfflineSets).
  async function sendVurderinger() {
    if (!athlete?.id || ratingFlushInFlight || browserSaysOffline()) return
    const koe = loadQueuedRatings(athlete.id)
    if (!Object.keys(koe).length) return
    ratingFlushInFlight = true
    try {
      for (const [sessionId, v] of Object.entries(koe)) {
        let markSent
        const sent = new Promise((resolve) => { markSent = resolve })
        const { error } = await withSlowNetCutoff(queueWrite(() => supabase.from('sessions').update({
          athlete_rating: v.rating,
          athlete_comment: v.comment || null,
        }).eq('id', sessionId), { giveUpIf: seemsOffline, onStart: markSent }), undefined, { startWhen: sent })
        if (error) {
          if (!seemsOffline() && error.code !== 'SLOW_NET') logFrontendError('Vurdering af passet: afsendelse fejlede, ligger i køen', error, athlete.id)
          break
        }
        clearQueuedRatingIfSame(athlete.id, sessionId, v)
      }
    } finally {
      ratingFlushInFlight = false
    }
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
