import { createElement as h, useMemo, useRef, useState } from 'react'
import Conversation from './Conversation.mjs'
import { readWeeklyLetter } from '../coach/ugebrev/readWeeklyLetter.mjs'
import { createConversation } from './conversationController.mjs'
import { createConversationAdapters, athleteConversationScope, coachConversationScope, athleteUploadEntry } from './conversationAdapters.mjs'

// All names below are existing App/AthleteView/Dashboard capabilities.
// getEntry must read current render state, not capture a previous athlete/session.
export function createEntryFactory({ enabled = false, role, getEntry, openFeedback }) {
  return () => {
    const entry = getEntry()
    const scope = () => {
      const current = getEntry()
      const props = { ...current, enabled: enabled === true && current.enabled === true }
      return role === 'athlete' ? athleteConversationScope(props) : coachConversationScope(props)
    }
    const adapters = createConversationAdapters({ enabled, database: entry.inboxDatabase,
      getScope: scope, storage: () => getEntry().storage(),
      openUpload: () => athleteUploadEntry(getEntry())(),
      openVideoAnalysisReview: row => getEntry().openVideoAnalysisReview(row),
      openAwaitingAnalysisVideo: row => getEntry().openAwaitingAnalysisVideo(row),
      openFeedback: row => {
        getEntry().setOpenSharedVideoId(row.id)
        openFeedback(row)
      } })
    const controller = createConversation({ enabled, adapters, storage: () => getEntry().storage() })
    if (enabled === true && role === 'coach') controller.weeklyLetter = () => readWeeklyLetter({
      enabled: true, getScope: adapters.scope, database: entry.inboxDatabase,
    })
    return controller
  }
}

export default function ConversationEntry({ enabled = false, role, getEntry, controllerRef }) {
  const live = useRef(getEntry); live.current = getEntry
  const entry = enabled === true ? getEntry() : {}
  const athleteId = role === 'athlete' ? entry.athlete?.id : entry.selectedAthlete?.id
  const ownerId = entry.session?.user?.id
  const [feedback, setFeedback] = useState(null)
  const factory = useMemo(() => createEntryFactory({ enabled, role, getEntry: () => live.current(),
    openFeedback: setFeedback }), [enabled, role, athleteId, ownerId])
  if (enabled !== true) return null
  return h('section', { 'aria-label': 'Samlet samtale' },
    h(Conversation, { key: `${role}:${ownerId}:${athleteId}`, enabled, createController: factory, controllerRef }),
    role === 'athlete' && feedback?.athlete_id === athleteId && entry.athlete?.user_id === ownerId
      && entry.renderSharedFeedbackCards?.([feedback], { expanded: true }))
}
