import { createElement as h } from 'react'
import { analyseConclusionEnabled, approvedConclusionReviews, approvedConclusionText } from '../approvedAnalysisConclusion.mjs'

// Only the analysis being viewed can supply this headline. No inferred fallback.
export default function AthleteAnalysisConclusion({ athleteId, analysis, liftFilter = analysis?.lift,
  search = typeof window === 'undefined' ? '' : window.location.search }) {
  if (!analyseConclusionEnabled(search) || !athleteId || !analysis || !liftFilter) return null
  const row = approvedConclusionReviews({ athleteId, analyses: [analysis], liftFilter })[0]
  if (!row) return null
  return h('p', { 'aria-label': 'Konklusion', style: { margin: 0, minWidth: 0, overflowWrap: 'anywhere', lineHeight: 1.5 } }, approvedConclusionText(row))
}
