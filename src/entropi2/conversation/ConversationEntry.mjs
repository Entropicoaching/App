import { createElement as h, useMemo, useRef, useState } from 'react'
import Conversation from './Conversation.mjs'
import { validId } from './conversationModel.mjs'
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
    if (enabled === true && role === 'coach') {
      const current = () => {
        if (!controller.snapshot().available) throw Error('Samtalen er ikke længere tilgængelig.')
      }
      controller.weeklyLetter = async () => {
        current()
        // Load only on the coach's explicit request. Do not retain a rejected
        // promise: the local retry must make a fresh import attempt.
        const { readWeeklyLetter } = await import('../coach/ugebrev/readWeeklyLetter.mjs')
        current()
        const model = await readWeeklyLetter({
          enabled: true, getScope: adapters.scope, database: entry.inboxDatabase,
        })
        current()
        return model
      }
    }
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
  // Presentation uses only the current host's fetched rows, under its existing scope.
  const scope = role === 'athlete' ? athleteConversationScope(entry) : coachConversationScope(entry)
  const scoped = scope.enabled === true && validId(athleteId) && !!ownerId &&
    (role === 'athlete' ? scope.athleteUserId === ownerId : role === 'coach' && scope.athletes.some(row => row.id === athleteId))
  const initial = scoped ? { athleteId, messages: entry.messages, analyses: entry.sharedVideoAnalyses } : undefined
  return h('section', { 'aria-label': 'Samlet samtale' },
    h(Conversation, { key: `${role}:${ownerId}:${athleteId}`, enabled, createController: factory, controllerRef, initial }),
    role === 'athlete' && feedback?.athlete_id === athleteId && entry.athlete?.user_id === ownerId
      && entry.renderSharedFeedbackCards?.([feedback], { expanded: true }))
}
