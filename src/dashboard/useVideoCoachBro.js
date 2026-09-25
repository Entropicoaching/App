// ORDRE 377: flyttet uændret fra src/Dashboard.jsx (se docs/DASHBOARD-KORT.md).
// VideoCoach-broen på coachens side: atletlisten og den valgte atlet til
// iframen, og message-lytteren (ready, close, baseline- og opsætnings-
// forespørgsler, save-draft). Hook kaldt nøjagtig hvor effekterne stod i
// Dashboard, så effekternes rækkefølge er uændret (samme mønster som
// src/athlete/useVideoCoachBro.js, ordre 373).
import { useEffect } from 'react'
import { videoCoachBridgeConfig, VIDEOCOACH_V3_PREFIX, validateVideoCoachV3Row } from './coachVideoHjaelp'
import { supabase } from '../supabase'
import { VIDEOCOACH_BASELINE_VERSION } from '../videoCoachVersion'
import { sanitizeVideoCoachFeedbackEvidence } from '../videoCoachFeedbackEvidence'
import { saveVideoCoachDraft } from '../videoCoachSubmission'

export function useVideoCoachBro({
  athletes, fetchVideoCoachHistory, fetchVideoReviewQueue, openProfile, selectedAthlete, setConfirmDialog,
  setSelectedAthlete, setVideoCoachOpen, setVideoReviewRequest, setView, showFlash, videoCoachAthletesRef,
  videoCoachClientsRef, videoCoachFrameRef, videoCoachPendingCompletionRef, videoCoachPendingShareRef, videoCoachSelectedAthleteRef,
}) {
  // Same-origin beskedbro: VideoCoach får kun en ufarlig atletliste og kan
  // bede den allerede autentificerede app om at indsætte én valideret draft.
  // Ingen access-token, service key eller intern coachnote sendes til URL'en.
  useEffect(() => {
    videoCoachAthletesRef.current = athletes
    const config = videoCoachBridgeConfig(athletes, videoCoachSelectedAthleteRef.current)
    for (const client of videoCoachClientsRef.current) {
      if (!client || client.closed) { videoCoachClientsRef.current.delete(client); continue }
      try { client.postMessage(config, window.location.origin) }
      catch { videoCoachClientsRef.current.delete(client) }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- refs, settere og handlere kommer fra Dashboard (stabile refs/settere; handlerne fanges som før ordre 377); effekten kører bevidst på de samme deps som før
  }, [athletes])

  useEffect(() => {
    videoCoachSelectedAthleteRef.current = selectedAthlete?.id || null
    const config = videoCoachBridgeConfig(videoCoachAthletesRef.current,
      videoCoachSelectedAthleteRef.current)
    for (const client of videoCoachClientsRef.current) {
      if (!client || client.closed) { videoCoachClientsRef.current.delete(client); continue }
      try { client.postMessage(config, window.location.origin) }
      catch { videoCoachClientsRef.current.delete(client) }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- refs, settere og handlere kommer fra Dashboard (stabile refs/settere; handlerne fanges som før ordre 377); effekten kører bevidst på de samme deps som før
  }, [selectedAthlete?.id])

  useEffect(() => {
    const onVideoCoachMessage = async event => {
      if (event.origin !== window.location.origin || !event.source) return
      const message = event.data || {}
      if (message.type === `${VIDEOCOACH_V3_PREFIX}:ready`) {
        videoCoachClientsRef.current.add(event.source)
        event.source.postMessage(videoCoachBridgeConfig(videoCoachAthletesRef.current,
          videoCoachSelectedAthleteRef.current), event.origin)
        // ORDRE 57 · commit 2: en afventende atlet-video venter på at blive
        // indlæst - send den, nu hvor VideoCoach har bekræftet den er klar.
        const pendingLoad = videoCoachPendingCompletionRef.current
        if (pendingLoad && pendingLoad.url) {
          try {
            event.source.postMessage({ type: `${VIDEOCOACH_V3_PREFIX}:load-remote-video`,
              url: pendingLoad.url, lift: pendingLoad.lift, variation: pendingLoad.variation,
              clientAnalysisId: pendingLoad.clientAnalysisId }, event.origin)
          } catch { /* iframen kan være lukket allerede - næste åbning prøver igen */ }
        }
        return
      }
      if (message.type === `${VIDEOCOACH_V3_PREFIX}:close`) {
        const frameWindow = videoCoachFrameRef.current?.contentWindow
        if (event.source !== frameWindow && !videoCoachClientsRef.current.has(event.source)) return
        videoCoachClientsRef.current.delete(event.source)
        videoCoachPendingCompletionRef.current = null
        setVideoCoachOpen(false)
        // Efter lukning: tilbyd at gennemgå + dele den netop sendte måling med
        // atleten (kun for en anden atlet). Dialogen kan først ses nu, hvor
        // iframe-overlayet er væk. Del-kæden bor i review-køen (indbakken).
        const pend = videoCoachPendingShareRef.current
        videoCoachPendingShareRef.current = null
        if (pend) {
          const ath = videoCoachAthletesRef.current.find(a => a.id === pend.athleteId)
          setConfirmDialog({
            message: `Sendt ✓ — vil du gennemgå og dele målingen med ${ath?.name || 'atleten'} nu?`,
            confirmLabel: 'Del med atlet', kind: 'primary',
            // Åbn review-modalen for netop denne måling (samme sti som indbakken),
            // så coachen kan tilføje feedback → godkende → dele. Uden dette landede
            // man i indbakken uden valgt atlet, hvor reviewet ikke kunne åbnes.
            onConfirm: () => {
              const full = videoCoachAthletesRef.current.find(a => a.id === pend.athleteId)
              if (full) {
                setVideoReviewRequest({ item: { id: pend.id, athlete_id: pend.athleteId }, token: `${pend.id}:${Date.now()}` })
                openProfile(full, 'analyse')
              } else {
                setView('inbox'); setSelectedAthlete(null)
              }
            },
          })
        }
        return
      }
      if (message.type === `${VIDEOCOACH_V3_PREFIX}:baseline-request`) {
        const reply = result => {
          try { event.source.postMessage({ type: `${VIDEOCOACH_V3_PREFIX}:baseline-result`,
            requestId: message.requestId, athleteId: message.athleteId, ...result }, event.origin); return true }
          catch { return false }
        }
        if (!videoCoachClientsRef.current.has(event.source)) {
          reply({ ok: false, error: 'VideoCoach-forbindelsen er ikke registreret' })
          return
        }
        if (typeof message.requestId !== 'string' || message.requestId.length > 100 ||
            !videoCoachAthletesRef.current.some(athlete => athlete.id === message.athleteId)) {
          reply({ ok: false, error: 'Ugyldig baseline-forespørgsel' })
          return
        }
        const { data, error } = await supabase.from('athlete_baselines_v3')
          .select('lift,variation,metric_key,metric_method,baseline_version,median,mad,n_analyses,n_reps,last_analyzed_at')
          .eq('athlete_id', message.athleteId)
          .eq('baseline_version', VIDEOCOACH_BASELINE_VERSION)
          .order('last_analyzed_at', { ascending: false })
        if (error) {
          reply({ ok: false, error: error.message || 'Baseline kunne ikke hentes' })
          return
        }
        reply({ ok: true, baselines: (data || []).filter(item =>
          item && ['squat', 'bench', 'deadlift'].includes(item.lift) &&
          typeof item.variation === 'string' && typeof item.metric_key === 'string' &&
          typeof item.metric_method === 'string' && Number.isFinite(Number(item.median)) &&
          Number(item.n_analyses) >= 1) })
        return
      }
      // ORDRE 43 · Commit 3: sidste godkendte opsætning (kalibrering +
      // skelet-proportioner) for samme atlet+løft+variation, så VideoCoach
      // kan foreslå i stedet for at spørge. Samme mønster som baseline-broen.
      if (message.type === `${VIDEOCOACH_V3_PREFIX}:prior-setup-request`) {
        const reply = result => {
          try { event.source.postMessage({ type: `${VIDEOCOACH_V3_PREFIX}:prior-setup-result`,
            requestId: message.requestId, ...result }, event.origin); return true }
          catch { return false }
        }
        if (!videoCoachClientsRef.current.has(event.source)) {
          reply({ ok: false, error: 'VideoCoach-forbindelsen er ikke registreret' })
          return
        }
        if (typeof message.requestId !== 'string' || message.requestId.length > 100 ||
            !videoCoachAthletesRef.current.some(athlete => athlete.id === message.athleteId) ||
            !['squat', 'bench', 'deadlift'].includes(message.lift) ||
            !/^[a-z0-9]+([._-][a-z0-9]+)*$/.test(message.variation || '')) {
          reply({ ok: false, error: 'Ugyldig forespørgsel om tidligere opsætning' })
          return
        }
        const { data, error } = await supabase.from('video_analyses')
          .select('bar_path, extra, analyzed_at')
          .eq('athlete_id', message.athleteId)
          .eq('lift', message.lift)
          .eq('variation', message.variation)
          .in('status', ['coach_approved', 'shared'])
          .order('analyzed_at', { ascending: false })
          .limit(1)
        if (error) {
          reply({ ok: false, error: error.message || 'Tidligere opsætning kunne ikke hentes' })
          return
        }
        const row = (data || [])[0]
        if (!row) { reply({ ok: true, found: false }); return }
        const cmPerPx = Number(row.bar_path?.cm_per_px)
        const skeletonProportions = row.extra?.skeleton_proportions &&
          typeof row.extra.skeleton_proportions === 'object' ? row.extra.skeleton_proportions : null
        if (!Number.isFinite(cmPerPx) && !skeletonProportions) {
          reply({ ok: true, found: false })
          return
        }
        reply({ ok: true, found: true,
          cmPerPx: Number.isFinite(cmPerPx) && cmPerPx > 0 ? cmPerPx : null,
          skeletonProportions })
        return
      }
      if (message.type !== `${VIDEOCOACH_V3_PREFIX}:save-draft`) return
      const reply = result => {
        try { event.source.postMessage({ type: `${VIDEOCOACH_V3_PREFIX}:save-result`,
          requestId: message.requestId, ...result }, event.origin); return true }
        catch { return false }
      }
      // ORDRE 57 · commit 2: fuldfører dette gem en afventende atlet-video?
      // Kun når client_analysis_id matcher DEN video, vi selv bad VideoCoach
      // åbne - en coach der undervejs skifter atlet i dropdown'en må ikke
      // kunne flytte en andens video ved et uheld (se WITH CHECK i den fælles
      // update-policy, som kun tjekker den NYE athlete_id, ikke om den er ÆNDRET).
      const pendingCompletion = videoCoachPendingCompletionRef.current
      const isCompletion = !!pendingCompletion &&
        pendingCompletion.clientAnalysisId === message.row?.client_analysis_id
      if (isCompletion && message.row.athlete_id !== pendingCompletion.athleteId) {
        reply({ ok: false, error: 'Atleten er ændret siden videoen blev åbnet · luk og prøv igen' })
        return
      }
      const validationError = validateVideoCoachV3Row(message.row,
        videoCoachAthletesRef.current, isCompletion ? pendingCompletion.clientAnalysisId : null)
      if (validationError) { reply({ ok: false, error: validationError }); return }

      const safeRow = {
        ...message.row,
        session_context: {
          ...(message.row.session_context && typeof message.row.session_context === 'object'
            && !Array.isArray(message.row.session_context) ? message.row.session_context : {}),
          feedback_evidence: sanitizeVideoCoachFeedbackEvidence(
            message.row.session_context?.feedback_evidence),
        },
      }
      // Samme analyseresultat kan gensendes efter et timeout. Den fælles gemmer
      // accepterer kun dubletten, når både klient-id og atlet-id matcher.
      // En fuldførelse er derimod en ren UPDATE af den afventende række selv
      // (client_analysis_id er nøglen) - aldrig en ny række ved siden af.
      const result = isCompletion
        ? await saveVideoCoachDraft(supabase, safeRow,
          { updateClientAnalysisId: pendingCompletion.clientAnalysisId })
        : await saveVideoCoachDraft(supabase, safeRow)
      if (result.error) {
        reply({ ok: false, error: result.error.message || 'Databasen afviste analysen' })
        return
      }
      reply({ ok: true, data: result.data })
      if (isCompletion) {
        videoCoachPendingCompletionRef.current = null
        showFlash('Analysen er sporet og klar ✓', 'success')
        fetchVideoReviewQueue()
        if (videoCoachSelectedAthleteRef.current === result.data.athlete_id)
          fetchVideoCoachHistory(result.data.athlete_id)
        return
      }
      // Læs fra localStorage (kilden bag myAthleteId) for at undgå stale closure
      // i denne [] -deps-effekt.
      const selfAthleteId = localStorage.getItem('entropi_my_athlete_id')
      const isSelf = !!selfAthleteId && result.data.athlete_id === selfAthleteId
      // Del-med-atlet giver kun mening for en ANDEN atlet; egne målinger lander
      // bare i køen. Tilbuddet vises når iframen lukkes (se :close-handleren).
      videoCoachPendingShareRef.current = isSelf ? null : { id: result.data.id, athleteId: result.data.athlete_id }
      showFlash(isSelf ? 'Sendt ✓ — i din egen kø' : 'Sendt ✓ — i review-køen', 'success')
      fetchVideoReviewQueue()
      if (videoCoachSelectedAthleteRef.current === result.data.athlete_id)
        fetchVideoCoachHistory(result.data.athlete_id)
    }
    window.addEventListener('message', onVideoCoachMessage)
    return () => window.removeEventListener('message', onVideoCoachMessage)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- refs, settere og handlere kommer fra Dashboard (stabile refs/settere; handlerne fanges som før ordre 377); effekten kører bevidst på de samme deps som før
  }, [])
}
