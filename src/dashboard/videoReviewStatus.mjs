// Selvstændig runtime-handler fra videoReviewHandlinger.js. Afhængigheder gives af fabrikken.
function unchangedVideoAnalysis(query, analysis) {
  query = query.eq('status', analysis.status)
  return analysis.athlete_feedback == null
    ? query.is('athlete_feedback', null)
    : query.filter('athlete_feedback', 'eq', JSON.stringify(analysis.athlete_feedback))
}

export function createVideoReviewStatusHandler({
  selectedAthlete, videoAnalysisUpdatingId, videoAnalysisFeedbackDirty,
  videoBaselines, videoCoachFeedbackQuality, videoCoachPersonalBaselineOptions,
  videoCoachPersonalBaselineSelection, openVideoAnalysisReview,
  setVideoAnalysisReviewError, showFlash, setVideoAnalysisUpdatingId,
  setVideoAnalysisError, supabase, fetchVideoCoachHistory, fetchVideoReviewQueue,
  setVideoAnalysisReview,
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
      query = unchangedVideoAnalysis(query, analysis)
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
        ? 'Videoanalyse godkendt til personlig baseline. Næste trin: gennemgå feedbacken, og vælg Del feedback med atlet.'
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

  return reviewVideoAnalysis
}
