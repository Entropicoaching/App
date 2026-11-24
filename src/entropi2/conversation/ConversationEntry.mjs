import { createElement as h, useEffect, useMemo, useRef, useState } from 'react'
import Conversation from './Conversation.mjs'
import { validId } from './conversationModel.mjs'
import { shareUnread } from './unreadHost.mjs'
import { createConversation } from './conversationController.mjs'
import { createConversationAdapters, athleteConversationScope, coachConversationScope, athleteUploadEntry } from './conversationAdapters.mjs'
import { u6Enabled } from '../u6/flag.mjs'
import { applyCoachDraft } from '../u6/draftHandoff.mjs'
import CoachUgevideo from '../../ugevideo/CoachUgevideo.mjs'
import { rulSvarfeltNaarKlar } from './svarfeltRul.mjs'
import { laesSkjulTraening } from './kostKlientLaesning.mjs'

// All names below are existing App/AthleteView/Dashboard capabilities.
// getEntry must read current render state, not capture a previous athlete/session.
export function createEntryFactory({ enabled = false, role, getEntry, openFeedback, getSkjulTraening = () => false }) {
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
    controller.setSkjulTraening(role === 'athlete' && getSkjulTraening() === true)
    // U6: et udkast fra "Skriv" på forsiden lægges i feltet, når tråden er hentet. Intet sendes.
    if (enabled === true && role === 'coach' && u6Enabled('drafts')) applyCoachDraft(controller, entry.selectedAthlete?.id)
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
        // Ordre 1886: kosten mod den godkendte kostplan, fra Dashboardets afsluttede kostlæsning.
        const getNutritionRead = async ({ ownerId, athleteId, asOf }) => {
          const { readLetterNutrition } = await import('../coach/ugebrev/readLetterNutrition.mjs')
          return readLetterNutrition({ coachId: ownerId, athleteId, asOf,
            source: getEntry().coachNutrition, client: entry.inboxDatabase })
        }
        const model = await readWeeklyLetter({
          enabled: true, getScope: adapters.scope, database: entry.inboxDatabase, getNutritionRead,
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
  // Ordre 2132: en kostklient ser ikke "Send video" og "Del et sæt fra passet". Mens læsningen kører eller fejler, vises de.
  const [skjul, setSkjul] = useState({ athleteId: null, value: false })
  const skjulRef = useRef(false); skjulRef.current = skjul.athleteId === athleteId && skjul.value === true
  const kostPakke = entry.athlete?.kostPakke === true
  const factory = useMemo(() => createEntryFactory({ enabled, role, getEntry: () => live.current(),
    openFeedback: setFeedback, getSkjulTraening: () => skjulRef.current }), [enabled, role, athleteId, ownerId])
  useEffect(() => {
    if (enabled !== true || role !== 'athlete' || !kostPakke || !validId(athleteId)) return undefined
    let current = true
    laesSkjulTraening(live.current().inboxDatabase, live.current().athlete).then(value => {
      if (current) setSkjul({ athleteId, value })
    }, () => {})
    return () => { current = false }
  }, [enabled, role, kostPakke, athleteId, ownerId])
  useEffect(() => { controllerRef?.current?.setSkjulTraening?.(skjulRef.current) }, [skjul, athleteId, controllerRef])
  // Ordre 2019: åbnet fra forsidens besked-række står svarfeltet klar, uden fokus.
  useEffect(() => {
    if (enabled !== true || role !== 'coach') return undefined
    return rulSvarfeltNaarKlar({ controller: controllerRef?.current, athleteId })
  }, [enabled, role, athleteId, controllerRef])
  if (enabled !== true) return null
  // Presentation uses only the current host's fetched rows, under its existing scope.
  const scope = role === 'athlete' ? athleteConversationScope(entry) : coachConversationScope(entry)
  const scoped = scope.enabled === true && validId(athleteId) && !!ownerId &&
    (role === 'athlete' ? scope.athleteUserId === ownerId : role === 'coach' && scope.athletes.some(row => row.id === athleteId))
  const initial = scoped ? { athleteId, messages: entry.messages, analyses: entry.sharedVideoAnalyses } : undefined
  return h('section', { 'aria-label': 'Samlet samtale' },
    // Ordre 1953: coachens ugevideo til den valgte atlet, over samtalen; kun for coachens egne atleter.
    role === 'coach' && scoped && h(CoachUgevideo, { key: `ugevideo-${athleteId}`, client: entry.inboxDatabase, athlete: entry.selectedAthlete }),
    h(Conversation, { key: `${role}:${ownerId}:${athleteId}`, enabled, createController: factory, controllerRef, initial,
      onUnread: (summary, previous) => shareUnread(live.current(), summary, previous) }),
    role === 'athlete' && feedback?.athlete_id === athleteId && entry.athlete?.user_id === ownerId
      && entry.renderSharedFeedbackCards?.([feedback], { expanded: true }))
}
