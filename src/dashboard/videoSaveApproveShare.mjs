import { DEFAULT_VIDEOCOACH_FORENKL4 } from '../vcForenkl4.mjs'
import { videoCoachFeedbackQuality } from '../videoCoachFeedbackQuality.js'
import { videoCoachPersonalBaselineOptions, videoCoachPersonalBaselineSelection } from '../videoCoachPersonalFeedback.js'
import { videoCoachFeedbackPayload, videoCoachFeedbackDraft } from './coachVideoHjaelp.js'

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') return Object.fromEntries(
    Object.keys(value).sort().map(key => [key, canonical(value[key])]))
  return value
}

// Delt lås på tværs af renders, indtil den samlede handling er afsluttet.
const pending = new WeakMap()
export function createSaveApproveShareHandler({ enabled = DEFAULT_VIDEOCOACH_FORENKL4,
  selectedAthlete, videoAnalysisUpdatingId, videoBaselines, videoAnalysisFeedbackDraft,
  videoAnalysisBaselineFindingId, supabase, setVideoAnalysisUpdatingId,
  setVideoAnalysisReviewError, setVideoAnalysisReview, setVideoAnalyses,
  setVideoAnalysisFeedbackDraft, setVideoAnalysisBaselineFindingId,
  setVideoAnalysisFeedbackDirty, setVideoAnalysisCloseWarning,
  fetchVideoCoachHistory, fetchVideoReviewQueue, showFlash }) {
  return async analysis => {
    const athleteId = selectedAthlete?.id
    if (enabled !== true || !athleteId || !analysis?.id || videoAnalysisUpdatingId ||
        !['draft', 'coach_approved'].includes(analysis.status) ||
        (analysis.athlete_id && analysis.athlete_id !== athleteId)) return
    let locks = pending.get(supabase)
    if (!locks) { locks = new Set(); pending.set(supabase, locks) }
    const key = `${athleteId}:${analysis.id}`
    if (locks.has(key)) return
    locks.add(key)
    setVideoAnalysisUpdatingId(analysis.id)
    setVideoAnalysisReviewError(null)
    try {
      if (Object.values(videoAnalysisFeedbackDraft).some(value => String(value || '').trim().length > 600))
        throw new Error('Hvert feedbackfelt må højst være 600 tegn')
      const options = videoCoachPersonalBaselineOptions(videoBaselines, analysis, athleteId)
      const baseline = options.find(item => item.id === videoAnalysisBaselineFindingId) || null
      if (videoAnalysisBaselineFindingId && !baseline)
        throw new Error('Den personlige sammenligning skal gennemgås igen')
      const feedback = videoCoachFeedbackPayload(analysis.athlete_feedback, videoAnalysisFeedbackDraft, baseline)
      const quality = videoCoachFeedbackQuality(feedback)
      if (!quality.canShare) throw new Error(quality.detail || 'Feedbacken skal have et fokus og et brugbart cue')
      if (feedback.personal_baseline && !videoCoachPersonalBaselineSelection(feedback, options))
        throw new Error('Den personlige sammenligning skal gennemgås igen')
      // Én betinget UPDATE gemmer feedback og den godkendte/delte status samlet.
      // Dermed findes ingen delvist gemt eller godkendt tilstand ved skrivefejl.
      const payload = { athlete_feedback: feedback, status: 'shared',
        feedback_version: 'coach-edited-personal-baseline-v1-2026-07-30' }
      let query = supabase.from('video_analyses').update(payload)
        .eq('id', analysis.id).eq('athlete_id', athleteId).eq('status', analysis.status)
      if (analysis.client_analysis_id) query = query.eq('client_analysis_id', analysis.client_analysis_id)
      query = analysis.athlete_feedback == null ? query.is('athlete_feedback', null)
        : query.filter('athlete_feedback', 'eq', JSON.stringify(analysis.athlete_feedback))
      const { data, error } = await query.select('id,athlete_id,client_analysis_id,status,athlete_feedback,feedback_version').single()
      if (error) throw error
      if (!data || data.id !== analysis.id || data.athlete_id !== athleteId || data.status !== 'shared' ||
          (analysis.client_analysis_id && data.client_analysis_id !== analysis.client_analysis_id) ||
          JSON.stringify(canonical(data.athlete_feedback)) !== JSON.stringify(canonical(feedback)))
        throw new Error('Databasen bekræftede ikke den delte feedback')
      const merge = current => current?.id === analysis.id ? { ...current, ...data } : current
      setVideoAnalyses(current => current.map(merge))
      setVideoAnalysisReview(merge)
      setVideoAnalysisFeedbackDraft(videoCoachFeedbackDraft(data.athlete_feedback))
      setVideoAnalysisBaselineFindingId(videoCoachPersonalBaselineSelection(data.athlete_feedback, options))
      setVideoAnalysisFeedbackDirty(false)
      setVideoAnalysisCloseWarning(false)
      showFlash('Feedback gemt, godkendt og delt med atleten', 'success')
      try {
        await fetchVideoCoachHistory(athleteId)
        await fetchVideoReviewQueue()
      } catch {
        setVideoAnalysisReviewError('Feedbacken er delt. Listen kunne ikke opdateres. Opdatér listen igen.')
      }
    } catch (error) {
      setVideoAnalysisReviewError(error.message || 'Feedbacken kunne ikke gemmes og deles')
      showFlash('Feedbacken kunne ikke gemmes og deles. Dine ændringer er bevaret.', 'error')
    } finally {
      locks.delete(key)
      setVideoAnalysisUpdatingId(null)
    }
  }
}
