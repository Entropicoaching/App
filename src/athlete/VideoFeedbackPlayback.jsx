import { createElement, useEffect, useRef } from 'react'
import { mountFeedbackPlayback } from './videoFeedbackPlayback.mjs'

export function VideoFeedbackPlayback({ athleteId, analysisId }) {
  const root = useRef(null)
  useEffect(() => {
    if (!root.current) return undefined
    return mountFeedbackPlayback(root.current, { athleteId, analysisId })
  }, [athleteId, analysisId])
  return createElement('section', { ref: root, 'aria-label': 'Afspil markeringer' })
}
