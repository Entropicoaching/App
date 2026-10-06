import { useEffect, useState } from 'react'
import VideoReviewModal from '../../src/dashboard/VideoReviewModal'
const base = { id: 'synthetic-a', lift: 'squat', variation: 'competition', status: 'draft', analyzed_at: '2026-10-04', load_kg: 100, reps_count: 1, findings: [], metrics: {}, session_context: {}, athlete_feedback: {}, bar_path: [] }
window.reviewCalls = []
export default function App() {
  const [analysis, setAnalysis] = useState(base)
  useEffect(() => {
    window.openSyntheticReview = id => setAnalysis({ ...base, id })
    return () => { delete window.openSyntheticReview }
  }, [])
  return analysis ? <VideoReviewModal
    videoAnalysisReview={analysis} isMobile={window.innerWidth < 600}
    videoBaselines={[]} videoAnalyses={[]} selectedAthlete={null}
    videoAnalysisFeedbackDraft={{ works: '', focus: '', next_set: '' }}
    closeVideoAnalysisReview={() => setAnalysis(null)}
    reviewVideoAnalysis={(row, status) => window.reviewCalls.push({ row, status })}
    saveVideoAnalysisFeedback={row => window.reviewCalls.push({ row })}
  /> : <p>Review lukket. Kun syntetiske data.</p>
}
