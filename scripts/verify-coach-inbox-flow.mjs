import assert from 'node:assert/strict'
import { buildCoachPriorityItems } from '../src/coachPriority.js'
import {
  coachInboxCompletionStatus,
  coachInboxEntryIntent,
  coachInboxFocusDecision,
  createSingleFlightRunner,
  filterDraftVideoReviews,
  filterOpenTrainingSignals,
  shouldCollapseCoachConversations,
  summarizeCoachMessages,
  summarizeRefreshResults,
  trainingSignalFingerprint,
} from '../src/coachInboxState.js'

assert.deepEqual(
  coachInboxEntryIntent('?coach=inbox&focus=next'),
  { view: 'inbox', focusNext: true },
  'the safe briefing link must request the current next task without carrying athlete data',
)
assert.deepEqual(
  coachInboxEntryIntent('?coach=inbox&focus=athlete-id'),
  { view: 'inbox', focusNext: false },
  'unknown focus values must never trigger automatic profile navigation',
)
assert.deepEqual(
  coachInboxEntryIntent('?focus=next'),
  { view: 'list', focusNext: false },
  'focus=next is valid only on the explicit coach inbox route',
)

const linkedTask = { key: 'signal-athlete-readiness' }
assert.deepEqual(
  coachInboxFocusDecision({ requested: true, view: 'inbox', refreshing: true }),
  { ready: false, nextItem: null },
  'the link must wait while the inbox is refreshing',
)
assert.deepEqual(
  coachInboxFocusDecision({ requested: true, view: 'inbox', refreshStatus: { kind: 'partial' }, priorityItems: [linkedTask] }),
  { ready: true, nextItem: null },
  'partial data must consume the intent without opening possibly stale work',
)
assert.deepEqual(
  coachInboxFocusDecision({ requested: true, view: 'inbox', refreshStatus: { kind: 'success' }, priorityItems: [] }),
  { ready: true, nextItem: null },
  'a fully refreshed empty queue must leave the coach in the inbox',
)
assert.deepEqual(
  coachInboxFocusDecision({ requested: true, view: 'inbox', refreshStatus: { kind: 'success' }, priorityItems: [linkedTask] }),
  { ready: true, nextItem: linkedTask },
  'a complete refresh must open exactly the current top-priority item',
)

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
assert.deepEqual(snapshot.priorityItems.map(item => item.kind), ['signal', 'video', 'message', 'signal'], 'the oldest unanswered video or message must follow alerts')
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

let releaseRefresh
const refreshGate = new Promise(resolve => { releaseRefresh = resolve })
const runSingleFlight = createSingleFlightRunner()
let refreshRuns = 0
const firstRefresh = runSingleFlight(async () => { refreshRuns++; await refreshGate })
const overlappingRefresh = runSingleFlight(async () => { refreshRuns++ })
assert.equal(overlappingRefresh, firstRefresh, 'overlapping refreshes must share the same request')
assert.equal(refreshRuns, 1, 'overlapping refreshes must execute the loader once')
releaseRefresh()
await Promise.all([firstRefresh, overlappingRefresh])
await runSingleFlight(async () => { refreshRuns++ })
assert.equal(refreshRuns, 2, 'a new refresh must run after the previous request has settled')

const successfulRefresh = summarizeRefreshResults([
  { status: 'fulfilled', value: true },
  { status: 'fulfilled', value: true },
], now)
assert.deepEqual(successfulRefresh, {
  kind: 'success', completed: 2, total: 2, refreshedAt: now,
}, 'a refresh is successful only when every loader confirms fresh data')

const partialRefresh = summarizeRefreshResults([
  { status: 'fulfilled', value: true },
  { status: 'fulfilled', value: false },
  { status: 'rejected', reason: new Error('offline') },
], now)
assert.deepEqual(partialRefresh, {
  kind: 'partial', completed: 1, total: 3, refreshedAt: now,
}, 'failed and rejected loaders must make the refresh visibly partial')

assert.equal(coachInboxCompletionStatus({ priorityCount: 2, refreshStatus: successfulRefresh }), 'active', 'open work must keep the inbox active')
assert.equal(coachInboxCompletionStatus({ priorityCount: 0, refreshStatus: successfulRefresh }), 'complete', 'a fully refreshed empty queue must confirm completion')
assert.equal(coachInboxCompletionStatus({ priorityCount: 0, refreshStatus: partialRefresh }), 'unavailable', 'partial data must never look like a cleared inbox')
assert.equal(coachInboxCompletionStatus({ priorityCount: 0, refreshStatus: successfulRefresh, hasError: true }), 'unavailable', 'source errors must suppress the cleared state')
assert.equal(coachInboxCompletionStatus(), 'loading', 'the cleared state must not flash before the first refresh')

assert.equal(shouldCollapseCoachConversations({ isMobile: true, priorityCount: 2, conversationCount: 4 }), true, 'mobile must keep secondary conversations behind the guided priority task')
assert.equal(shouldCollapseCoachConversations({ isMobile: false, priorityCount: 2, conversationCount: 4 }), false, 'desktop must keep the full conversation list visible')
assert.equal(shouldCollapseCoachConversations({ isMobile: true, priorityCount: 0, conversationCount: 4 }), false, 'mobile must show conversations when no priority task leads the flow')
assert.equal(shouldCollapseCoachConversations({ isMobile: true, priorityCount: 2, conversationCount: 0 }), false, 'an empty conversation list must keep its empty state visible')
assert.equal(shouldCollapseCoachConversations({ isMobile: true, priorityCount: 2, conversationCount: 4, hasMessageError: true }), false, 'message errors must never be hidden behind the mobile disclosure')

console.log('OK: coach inbox message, video and signal lifecycles keep queue items and badges synchronized')
