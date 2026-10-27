import { createElement, useEffect, useRef } from 'react'
import { videoFeedbackPlaybackEnabled } from './athlete/videoFeedbackPlayback.mjs'
import { mountPreviewMarkers } from './fridayPreviewMarkers.mjs'

// Imported only by the isolated Friday config transformations, never the normal app entry.
export function VideoFeedbackPlayback({ athleteId, analysisId }) {
  const root = useRef(null)
  useEffect(() => {
    if (!root.current) return undefined
    return mountPreviewMarkers(root.current, { athleteId, analysisId },
      { enabled: videoFeedbackPlaybackEnabled() })
  }, [athleteId, analysisId])
  return createElement('section', { ref: root, 'aria-label': 'Syntetiske tidsmarkeringer' })
}
