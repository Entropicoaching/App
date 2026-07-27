import assert from 'node:assert/strict'
import { buildCoachPriorityItems } from '../src/coachPriority.js'
import {
  filterDraftVideoReviews,
  filterOpenTrainingSignals,
  summarizeCoachMessages,
  trainingSignalFingerprint,
} from '../src/coachInboxState.js'

const now = Date.parse('2026-07-27T12:00:00Z')
const athletes = [{ id: 'athlete-a', name: 'Anna' }]
let messages = [
  { id: 'message-new', athlete_id: 'athlete-a', category: 'besked', sender_role: 'athlete', read_by_coach: false, content: 'Nyeste besked', created_at: '2026-07-27T10:00:00Z' },
  { id: 'message-old', athlete_id: 'athlete-a', category: 'besked', sender_role: 'athlete', read_by_coach: false, content: 'Ældre besked', created_at: '2026-07-27T09:00:00Z' },
  { id: 'message-hidden', athlete_id: 'hidden-athlete', category: 'teknik', sender_role: 'athlete', read_by_coach: false, content: 'Skjult besked', created_at: '2026-07-27T08:00:00Z' },
]
let videos = [
  { id: 'video-a', athlete_id: 'athlete-a', lift: 'squat', status: 'draft', created_at: '2026-07-27T07:00:00Z' },
  { id: 'video-hidden', athlete_id: 'hidden-athlete', lift: 'bench', status: 'draft', created_at: '2026-07-27T06:00:00Z' },
]
let signals = [
  { o_athlete_id: 'athlete-a', o_athlete_name: 'Anna', o_detector: 'dropout', o_severity: 'alert', o_headline: 'Kræver handling', o_detail: 'Træningsmængden er faldet', o_metrics: { sessions: 1 } },
  { o_athlete_id: 'athlete-a', o_athlete_name: 'Anna', o_detector: 'stagnation', o_severity: 'context', o_headline: 'Følg udviklingen', o_detail: 'Udviklingen er flad', o_metrics: { weeks: 4 } },
  { o_athlete_id: 'hidden-athlete', o_athlete_name: 'Skjult', o_detector: 'rpe_drift', o_severity: 'alert', o_headline: 'Skjult alert', o_detail: 'Må ikke vises', o_metrics: { drift: 1 } },
]
let actions = []

function inboxSnapshot() {
  const messageSummary = summarizeCoachMessages(messages)
  const videoReviewQueue = filterDraftVideoReviews(videos)
  const trainingSignals = filterOpenTrainingSignals(signals, actions, now)
  const priorityItems = buildCoachPriorityItems({
    athletes,
    trainingSignals,
    unreadByTrack: messageSummary.unreadByTrack,
    latestByTrack: messageSummary.latestByTrack,
    videoReviewQueue,
    describeVideo: video => `Video ${video.lift}`,
  })
  return { ...messageSummary, videoReviewQueue, trainingSignals, priorityItems, count: priorityItems.length }
}

let snapshot = inboxSnapshot()
assert.deepEqual(snapshot.priorityItems.map(item => item.kind), ['signal', 'message', 'video', 'signal'])
assert.equal(snapshot.count, 4, 'initial badge must equal four visible work items')
assert.equal(snapshot.priorityItems.find(item => item.kind === 'message').count, 2, 'two unread messages in one track must be one work item with count two')
assert.equal(snapshot.priorityItems.some(item => item.athlete.id === 'hidden-athlete'), false, 'hidden athletes must not create visible work items')

messages = messages.map(message => message.athlete_id === 'athlete-a'
  ? { ...message, read_by_coach: true }
  : message)
snapshot = inboxSnapshot()
assert.equal(snapshot.count, 3, 'reading the conversation must remove its grouped work item')
assert.equal(snapshot.priorityItems.some(item => item.kind === 'message'), false)

videos = videos.map(video => video.id === 'video-a' ? { ...video, status: 'coach_approved' } : video)
snapshot = inboxSnapshot()
assert.equal(snapshot.count, 2, 'approving a video must remove the draft review item')
assert.equal(snapshot.priorityItems.some(item => item.kind === 'video'), false)

const alert = signals.find(signal => signal.o_detector === 'dropout' && signal.o_athlete_id === 'athlete-a')
actions = [{
  athlete_id: alert.o_athlete_id,
  detector: alert.o_detector,
  signal_fingerprint: trainingSignalFingerprint(alert),
  snoozed_until: null,
}]
snapshot = inboxSnapshot()
assert.equal(snapshot.count, 1, 'acknowledging the current alert fingerprint must remove that alert')
assert.equal(snapshot.priorityItems[0].signal.o_detector, 'stagnation')

actions.push({
  athlete_id: 'athlete-a',
  detector: 'stagnation',
  signal_fingerprint: null,
  snoozed_until: new Date(now + 7 * 86400000).toISOString(),
})
snapshot = inboxSnapshot()
assert.equal(snapshot.count, 0, 'snoozing the final context signal must empty the queue and its badge')

actions = actions.map(action => action.detector === 'stagnation'
  ? { ...action, snoozed_until: new Date(now - 1000).toISOString() }
  : action)
snapshot = inboxSnapshot()
assert.equal(snapshot.count, 1, 'an expired snooze must allow the unresolved signal to return')

signals = signals.map(signal => signal === alert
  ? { ...signal, o_metrics: { sessions: 0 } }
  : signal)
snapshot = inboxSnapshot()
assert.equal(snapshot.count, 2, 'materially changed signal data must reopen an acknowledged detector')

console.log('OK: coach inbox message, video and signal lifecycles keep queue items and badges synchronized')
