// ORDRE 377: flyttet uændret fra src/Dashboard.jsx (se docs/DASHBOARD-KORT.md).
// "Gennemgå måling": status (godkend/del/udelad), feedback gem/fortryd/luk,
// åbn en afventende atlet-video til sporing og åbn review-modalen.
// Handler-fabrik: Dashboard kalder den i hvert render.
import { videoCoachFeedbackQuality } from '../videoCoachFeedbackQuality'
import { videoCoachPersonalBaselineOptions, videoCoachPersonalBaselineSelection } from '../videoCoachPersonalFeedback'
import { supabase } from '../supabase'
import { videoCoachFeedbackPayload, videoCoachFeedbackDraft } from './coachVideoHjaelp'
import { VIDEOCOACH_UPLOAD_BUCKET } from '../videoCoachUpload'

export function lavVideoReviewHandlinger({
  fetchVideoCoachHistory, fetchVideoReviewQueue, openVideoCoachV3, selectedAthlete, setVideoAnalyses, setVideoAnalysisBaselineFindingId,
  setVideoAnalysisCloseWarning, setVideoAnalysisError, setVideoAnalysisFeedbackDirty, setVideoAnalysisFeedbackDraft, setVideoAnalysisReview, setVideoAnalysisReviewError,
  setVideoAnalysisReviewLoadingId, setVideoAnalysisUpdatingId, showFlash, videoAnalysisBaselineFindingId, videoAnalysisFeedbackDirty, videoAnalysisFeedbackDraft,
  videoAnalysisReviewLoadingId, videoAnalysisUpdatingId, videoBaselines, videoCoachPendingCompletionRef,
}) {
  async function reviewVideoAnalysis(analysis, nextStatus) {
    if (!selectedAthlete?.id || !analysis?.id || videoAnalysisUpdatingId) return
    if (!['draft', 'coach_approved', 'shared', 'invalid'].includes(nextStatus)) return
    if (nextStatus === 'shared' && analysis.status !== 'coach_approved') return
    if (nextStatus === 'shared' && videoAnalysisFeedbackDirty) {
      showFlash('Gem feedbacken før du deler den', 'error')
      return
    }
    if (nextStatus === 'shared') {
      const feedbackQuality = videoCoachFeedbackQuality(analysis.athlete_feedback)
      if (!feedbackQuality.canShare) {
        await openVideoAnalysisReview(analysis)
        setVideoAnalysisReviewError(feedbackQuality.detail)
        showFlash('Feedbacken skal have et fokus og et brugbart cue', 'error')
        return
      }
      if (analysis.athlete_feedback?.personal_baseline) {
        const baselineOptions = videoCoachPersonalBaselineOptions(videoBaselines, analysis,
          selectedAthlete.id)
        if (!videoCoachPersonalBaselineSelection(analysis.athlete_feedback, baselineOptions)) {
          await openVideoAnalysisReview(analysis)
          setVideoAnalysisReviewError('Den personlige sammenligning matcher ikke længere den aktuelle baseline. Gem feedbacken igen før deling.')
          showFlash('Den personlige sammenligning skal gennemgås igen', 'error')
          return
        }
      }
    }
    setVideoAnalysisUpdatingId(analysis.id)
    setVideoAnalysisError(null)
    try {
      let query = supabase.from('video_analyses')
        .update({ status: nextStatus })
        .eq('id', analysis.id)
        .eq('athlete_id', selectedAthlete.id)
      if (analysis.client_analysis_id)
        query = query.eq('client_analysis_id', analysis.client_analysis_id)
      const { data, error } = await query
        .select('id,client_analysis_id,athlete_id,status').single()
      if (error) throw error
      if (!data || data.id !== analysis.id || data.athlete_id !== selectedAthlete.id ||
          data.status !== nextStatus)
        throw new Error('Databasen bekræftede ikke den valgte analyse')
      await fetchVideoCoachHistory(selectedAthlete.id)
      fetchVideoReviewQueue()
      setVideoAnalysisReview(current => current?.id === analysis.id
        ? { ...current, status: nextStatus } : current)
      const message = nextStatus === 'coach_approved'
        ? 'Videoanalyse godkendt til personlig baseline'
        : nextStatus === 'shared'
          ? 'Feedback delt med atleten'
          : nextStatus === 'invalid'
            ? 'Videoanalyse udeladt fra personlig baseline'
            : 'Videoanalyse flyttet tilbage til kladde'
      showFlash(message, 'success')
    } catch (error) {
      setVideoAnalysisError(error.message || 'Analysens status kunne ikke opdateres')
      showFlash('Videoanalysen kunne ikke opdateres', 'error')
    } finally {
      setVideoAnalysisUpdatingId(null)
    }
  }

  async function saveVideoAnalysisFeedback(analysis) {
    if (!selectedAthlete?.id || !analysis?.id || videoAnalysisUpdatingId) return
    if (!['draft', 'coach_approved'].includes(analysis.status)) return
    const values = Object.values(videoAnalysisFeedbackDraft).map(value => String(value || '').trim())
    if (values.some(value => value.length > 600)) {
      showFlash('Hvert feedbackfelt må højst være 600 tegn', 'error')
      return
    }
    const baselineOptions = videoCoachPersonalBaselineOptions(videoBaselines, analysis,
      selectedAthlete.id)
    const selectedBaseline = baselineOptions.find(option =>
      option.id === videoAnalysisBaselineFindingId) || null
    const athleteFeedback = videoCoachFeedbackPayload(analysis.athlete_feedback,
      videoAnalysisFeedbackDraft, selectedBaseline)
    setVideoAnalysisUpdatingId(analysis.id)
    setVideoAnalysisReviewError(null)
    try {
      let query = supabase.from('video_analyses')
        .update({ athlete_feedback: athleteFeedback,
          feedback_version: 'coach-edited-personal-baseline-v1-2026-07-30' })
        .eq('id', analysis.id)
        .eq('athlete_id', selectedAthlete.id)
      if (analysis.client_analysis_id)
        query = query.eq('client_analysis_id', analysis.client_analysis_id)
      const { data, error } = await query
        .select('id,client_analysis_id,athlete_id,status,athlete_feedback,feedback_version').single()
      if (error) throw error
      if (!data || data.id !== analysis.id || data.athlete_id !== selectedAthlete.id)
        throw new Error('Databasen bekræftede ikke feedbacken')
      setVideoAnalyses(current => current.map(item => item.id === analysis.id
        ? { ...item, athlete_feedback: data.athlete_feedback,
          feedback_version: data.feedback_version } : item))
      setVideoAnalysisReview(current => current?.id === analysis.id
        ? { ...current, athlete_feedback: data.athlete_feedback,
          feedback_version: data.feedback_version } : current)
      setVideoAnalysisFeedbackDraft(videoCoachFeedbackDraft(data.athlete_feedback))
      setVideoAnalysisBaselineFindingId(videoCoachPersonalBaselineSelection(
        data.athlete_feedback, baselineOptions))
      setVideoAnalysisFeedbackDirty(false)
      setVideoAnalysisCloseWarning(false)
      showFlash('Feedback gemt', 'success')
    } catch (error) {
      setVideoAnalysisReviewError(error.message || 'Feedbacken kunne ikke gemmes')
      showFlash('Feedbacken kunne ikke gemmes', 'error')
    } finally {
      setVideoAnalysisUpdatingId(null)
    }
  }

  function closeVideoAnalysisReview() {
    if (videoAnalysisFeedbackDirty) {
      setVideoAnalysisCloseWarning(true)
      return
    }
    setVideoAnalysisReview(null)
    setVideoAnalysisReviewError(null)
    setVideoAnalysisCloseWarning(false)
  }

  function discardVideoAnalysisFeedback(analysis) {
    setVideoAnalysisFeedbackDraft(videoCoachFeedbackDraft(analysis?.athlete_feedback))
    const baselineOptions = videoCoachPersonalBaselineOptions(videoBaselines, analysis,
      selectedAthlete?.id)
    setVideoAnalysisBaselineFindingId(videoCoachPersonalBaselineSelection(
      analysis?.athlete_feedback, baselineOptions))
    setVideoAnalysisFeedbackDirty(false)
    setVideoAnalysisCloseWarning(false)
  }

  // ORDRE 57 · commit 2: ét klik henter videoen via en kortlivet signeret URL
  // og åbner den i coach-VideoCoach med løft/variation forudfyldt - coachen
  // sporer den fulde sporing selv, uændret. Gemmet dernede opdaterer SAMME
  // række (client_analysis_id er nøglen), se save-draft-handleren ovenfor.
  async function openAwaitingAnalysisVideo(analysis) {
    // athlete_id følger kun med i den globale reviewkø (fetchVideoReviewQueue) -
    // fra atletens egen analyse-fane er den underforstået af selectedAthlete.
    const athleteId = analysis?.athlete_id || selectedAthlete?.id
    if (!analysis?.id || !analysis.video_path || !athleteId || videoAnalysisReviewLoadingId) return
    setVideoAnalysisReviewLoadingId(analysis.id)
    setVideoAnalysisReviewError(null)
    try {
      const { data, error } = await supabase.storage.from(VIDEOCOACH_UPLOAD_BUCKET)
        .createSignedUrl(analysis.video_path, 600)
      if (error || !data?.signedUrl) throw error || new Error('Videoen kunne ikke åbnes')
      videoCoachPendingCompletionRef.current = {
        clientAnalysisId: analysis.client_analysis_id, athleteId,
        url: data.signedUrl, lift: analysis.lift, variation: analysis.variation,
      }
      openVideoCoachV3()
    } catch (error) {
      showFlash(error.message || 'Videoen kunne ikke åbnes', 'error')
    } finally {
      setVideoAnalysisReviewLoadingId(null)
    }
  }

  async function openVideoAnalysisReview(analysis) {
    if (!selectedAthlete?.id || !analysis?.id || videoAnalysisReviewLoadingId) return
    setVideoAnalysisReviewLoadingId(analysis.id)
    setVideoAnalysisReviewError(null)
    try {
      const { data, error } = await supabase.from('video_analyses')
        .select('id,client_analysis_id,athlete_id,source_mode,lift,variation,load_kg,rpe,reps_count,status,analyzed_at,low_conf_pct,position_quality_pct,quality_flags,metrics,findings,athlete_feedback,bar_path,session_context,engine_version,tracker_version,skeleton_version,feedback_version')
        .eq('id', analysis.id)
        .eq('athlete_id', selectedAthlete.id)
        .single()
      if (error) throw error
      if (!data || data.id !== analysis.id || data.athlete_id !== selectedAthlete.id)
        throw new Error('Databasen returnerede reviewdata for en forkert analyse')
      setVideoAnalysisReview(data)
      setVideoAnalysisFeedbackDraft(videoCoachFeedbackDraft(data.athlete_feedback))
      const baselineOptions = videoCoachPersonalBaselineOptions(videoBaselines, data,
        selectedAthlete.id)
      setVideoAnalysisBaselineFindingId(videoCoachPersonalBaselineSelection(
        data.athlete_feedback, baselineOptions))
      setVideoAnalysisFeedbackDirty(false)
      setVideoAnalysisCloseWarning(false)
    } catch (error) {
      setVideoAnalysisReviewError(error.message || 'Målingen kunne ikke åbnes')
    } finally {
      setVideoAnalysisReviewLoadingId(null)
    }
  }

  return {
    reviewVideoAnalysis, saveVideoAnalysisFeedback, closeVideoAnalysisReview, discardVideoAnalysisFeedback, openAwaitingAnalysisVideo, openVideoAnalysisReview,
  }
}
