import { summarizeCoachMessages } from '../coachInboxState.js'

// Entropi 2: coachskærmens beskedsammendrag udledes af den indfangede beskedkilde
// (coachMorningData.messages), som readMorningSource kun opdaterer for den nyeste læsning.
// Sammendrag og fejlstatus hører derfor altid til samme afsluttede læsning som kilden; et
// afløst svar, der bagefter opdaterer Dashboardets almindelige sammendrag, kan ikke blande sig.
// Samme funktion og samme fejltekst som fetchLatestMessages bruger.
export const MESSAGE_INBOX_ERROR = 'Beskeder kunne ikke opdateres. Prøv igen.'
const cache = new WeakMap()

// Videokøens fejlstatus hører til samme indfangede videokilde (coachMorningData.videos) som
// videorækkerne. Et afløst svar kan derfor hverken sætte eller rydde fejlen.
export const VIDEO_QUEUE_ERROR = 'VideoCoach-køen kunne ikke hentes'
export function entropi2VideoQueueError(source) {
  return source?.state === 'error' ? VIDEO_QUEUE_ERROR : null
}

export function entropi2MessageSummary(source, { noteSignalEnabled = false } = {}) {
  const note = noteSignalEnabled === true
  if (source?.state === 'error') return { latestByTrack: {}, unreadByTrack: {}, pendingByTrack: {}, messageInboxError: MESSAGE_INBOX_ERROR }
  if (!source || !['ready', 'partial'].includes(source.state) || !Array.isArray(source.rows))
    return { latestByTrack: {}, unreadByTrack: {}, pendingByTrack: {}, messageInboxError: null }
  const hit = cache.get(source)
  if (hit?.note === note) return hit.value
  const summary = summarizeCoachMessages(source.rows, { noteSignalEnabled: note })
  const value = { latestByTrack: summary.latestByTrack, unreadByTrack: summary.unreadByTrack,
    pendingByTrack: summary.pendingByTrack || {}, messageInboxError: null }
  cache.set(source, { note, value })
  return value
}
