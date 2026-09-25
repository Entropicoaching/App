// VideoCoach-broen paa atletsiden: config til aabne VideoCoach-vinduer, selve
// postMessage-lytteren (upload-and-go, abort-upload, save-draft, close/ready)
// og flush af den lokale kladdekoe — de tre effekter flyttet uaendret ud af
// AthleteView.jsx (ordre 373) som en hook. AthleteView kalder den paa samme
// sted som effekterne stod, saa effekternes raekkefoelge er den samme.
import { useEffect } from 'react'
import { supabase, createAbortableUploadClient } from '../supabase'
import { sanitizeVideoCoachFeedbackEvidence } from '../videoCoachFeedbackEvidence'
import { recordSilentFail, attachPendingSilentFails, clearPendingSilentFails, markUploadInflight,
  clearUploadInflight, takeStaleUploadInflight } from '../athleteSilentFailLog'
import { flushVideoCoachDraftQueue, isRetryableVideoCoachError,
  queueVideoCoachDraft, saveVideoCoachDraft } from '../videoCoachSubmission'
import { buildAwaitingAnalysisRow, buildVideoUploadPath, validateVideoUploadRequest,
  videoUploadAlreadyExistsError, VIDEOCOACH_UPLOAD_BUCKET } from '../videoCoachUpload'
import { ATHLETE_VIDEOCOACH_PREFIX, ATHLETE_VIDEOCOACH_QUEUE_CHANGED,
  validateAthleteVideoCoachRow } from './videoCoachBro'

export function useVideoCoachBro({
  athlete, athleteVideoCoachClientsRef, athleteVideoCoachFrameRef, athleteVideoCoachRef, athleteVideoUploadAbortsRef, flashTimerRef, session, setAthleteVideoCoachInstant,
  setAthleteVideoCoachOpen, setFlash,
}) {
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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- ref-objekterne og setFlash er stabile (useRef/useState i AthleteView); deps uændret fra før ordre 373
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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- ref-objekterne og setFlash er stabile (useRef/useState i AthleteView); deps uændret fra før ordre 373
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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- ref-objekterne og setFlash er stabile (useRef/useState i AthleteView); deps uændret fra før ordre 373
  }, [athlete?.id, session.user.id])
}

// G16-varslet om en afbrudt videoupload (samme fil, fordi det deler
// stille-fejl-loggen med broen) — flyttet uaendret ud af AthleteView.jsx
// (ordre 373) og kaldt paa effektens gamle plads.
export function useAfbrudtUploadVarsel({ athlete, flashTimerRef, setFlash }) {
  // G16 (ordre 131): opdager en videoupload der blev afbrudt af at fanen/appen
  // lukkede eller genindlæste midt i overførslen (ingen kode når at køre
  // færdig i det tilfælde, så intet andet sted kan vise fejlen). Kører kun
  // ved en reel app-åbning (athlete.id sat første gang), ikke ved genrender.
  useEffect(() => {
    if (!athlete?.id) return
    if (!takeStaleUploadInflight(athlete.id)) return
    recordSilentFail(athlete.id, 'silent:video-upload-interrupted')
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
    setFlash({ message: 'Din seneste video blev muligvis afbrudt, mens den blev sendt. Åbn VideoCoach og send den igen for at være sikker.', kind: 'error' })
    flashTimerRef.current = setTimeout(() => setFlash(null), 6500)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- flashTimerRef og setFlash er stabile (useRef/useState i AthleteView); deps uændret fra før ordre 373
  }, [athlete?.id])
}
