import { createElement, useEffect, useRef } from 'react'
import { mountFeedbackPlayback } from './videoFeedbackPlayback.mjs'

export function VideoFeedbackPlayback({ athleteId, analysisId, sendReply }) {
  const root = useRef(null)
  const sender = useRef(sendReply)
  sender.current = sendReply
  useEffect(() => {
    if (!root.current) return undefined
    return mountFeedbackPlayback(root.current, { athleteId, analysisId }, { sendReply: sendReply ? (marker, text) => sender.current(marker, text) : undefined })
  }, [athleteId, analysisId])
  return createElement('section', { ref: root, 'aria-label': 'Afspil markeringer' })
}
