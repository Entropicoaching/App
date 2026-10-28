import { createElement, useEffect, useRef } from 'react'
import { mountFeedbackPlayback } from '../athlete/videoFeedbackPlayback.mjs'
import { supabase } from '../supabase.js'

export default function VideoMarkerReplyReview({ athleteId, analysisId }) {
  const root = useRef(null)
  useEffect(() => {
    if (!root.current) return undefined
    return mountFeedbackPlayback(root.current, { athleteId, analysisId }, {
      readReplies: async () => {
        const { data, error } = await supabase.from('messages').select('*')
          .eq('athlete_id', athleteId).eq('sender_role', 'athlete').eq('category', 'teknik').order('created_at')
        if (error) throw error
        return data || []
      },
    })
  }, [athleteId, analysisId])
  return createElement('section', { ref: root, 'aria-label': 'Atletens svar ved markeringer' })
}
