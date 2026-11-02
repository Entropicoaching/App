// Entropi 2-kobling runde 6: coachskærmens beskedsammendrag (og videofejl, atleter og fremdrift) hører til samme afsluttede læsning
// som den indfangede beskedkilde. Faktisk lavLaesninger (readMorningSource, fetchLatestMessages)
// med den syntetiske database fra testLoader, faktisk entropi2MessageSummary og coachHomeModel.
import './testLoader.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { setImmediate } from 'node:timers'
import { state } from './synthetic.mjs'
import { entropi2MessageSummary, entropi2VideoQueueError, MESSAGE_INBOX_ERROR, VIDEO_QUEUE_ERROR } from '../entropi2/coachMessageSummary.mjs'
import { entropi2CalendarRead, entropi2ReadGate } from '../entropi2/coachReadContext.mjs'
import { coachHomeModel } from '../entropi2/coach/coachModel.mjs'
import { activityDay } from './coachInactive.mjs'
// testLoader erstatter læserens hjælpere med kastende stubbe; her bruges den faktiske
// summarizeCoachMessages, så læserens egne sammendrag kan sammenlignes med kildens.
registerHooks({ resolve(specifier, context, next) {
  if (specifier === '../coachInboxState.js' && context.parentURL?.endsWith('/laesninger.js'))
    return { url: new URL('../coachInboxState.js', import.meta.url).href, shortCircuit: true }
  return next(specifier, context)
} })
const { lavLaesninger } = await import('./laesninger.js')

const session = { user: { id: 'syn-coach' } }
const a = { id: 'syn-a', name: 'Syntetisk A' }
const unread = { id: 'syn-m1', athlete_id: a.id, sender_role: 'athlete', category: 'besked', content: 'Gammel ulæst',
  created_at: new Date().toISOString(), read_by_coach: false }

function reader() {
  state.calls.length = 0; state.responses.length = 0
  const captured = { morning: {}, latestByTrack: {}, unreadByTrack: {}, pendingByTrack: {}, messageInboxError: null }
  const handlers = lavLaesninger({ session, coachMorning: true,
    setCoachMorningData: fn => { captured.morning = fn(captured.morning) },
    setUnreadCounts: () => {}, setUnreadByTrack: v => { captured.unreadByTrack = v }, setLatestByTrack: v => { captured.latestByTrack = v },
    setPendingByTrack: v => { captured.pendingByTrack = v }, setMessageInboxError: v => { captured.messageInboxError = v } })
  return { handlers, captured }
}
// Samme props som Dashboard giver CoachScreen med flaget tændt; `summaries` er de props, der bærer sammendragene.
const model = (captured, summaries) => coachHomeModel({ session, athletes: [a],
  readContext: { coachId: 'syn-coach', athleteIds: [a.id], day: activityDay() },
  loading: false, loadError: false, calendarWeeks: {}, coachActionsStatus: {}, coachMorningData: captured.morning,
  videoReviewQueueError: null, ...summaries })
const stateSummaries = c => ({ latestByTrack: c.latestByTrack, unreadByTrack: c.unreadByTrack, pendingByTrack: c.pendingByTrack, messageInboxError: c.messageInboxError })
const sourceSummaries = c => entropi2MessageSummary(c.morning.messages, { noteSignalEnabled: false })

async function overlap(lateA) {
  const { handlers, captured } = reader()
  let releaseA
  state.responses.push(new Promise((resolve, reject) => { releaseA = () => lateA instanceof Error ? reject(lateA) : resolve(lateA) }), { data: [] })
  const first = handlers.fetchLatestMessages([a.id])
  await handlers.fetchLatestMessages([a.id])
  releaseA(); await first
  return captured
}

test('R6: afløst beskedlæsning A efter nyere B: de almindelige sammendrag blander A ind, kilden gør ikke', async () => {
  const captured = await overlap({ data: [unread] })
  // Kilden er B's (tom), men fetchLatestMessages har bagefter skrevet A's sammendrag ubetinget.
  assert.deepEqual(captured.morning.messages.rows, [])
  assert.equal(captured.unreadByTrack[a.id].besked, 1)
  // Reproduktion af fundet: med Dashboardets almindelige sammendrag viser coachskærmen A's gamle besked.
  assert.equal(model(captured, stateSummaries(captured)).inbox.length, 1)
  // Rettelsen: sammendragene udledes af den accepterede kilde, så A ikke kan blande sig.
  assert.equal(model(captured, sourceSummaries(captured)).inbox.length, 0)
})

test('R6: en afløst fejl ændrer hverken kilde eller fejlstatus for den nyeste afsluttede læsning', async () => {
  for (const lateA of [{ data: null, error: { message: 'syntetisk' } }, Error('syntetisk kast')]) {
    const captured = await overlap(lateA)
    assert.equal(captured.morning.messages.state, 'ready')
    assert.equal(captured.messageInboxError, MESSAGE_INBOX_ERROR)
    assert.equal(sourceSummaries(captured).messageInboxError, null)
    const m = model(captured, sourceSummaries(captured))
    assert.equal(m.messages.usable, true); assert.equal(m.hasError, false)
  }
})

test('R6: sammendragene følger den gældende kildes rækker, fejl og igangværende læsning', async () => {
  const { handlers, captured } = reader()
  state.responses.push({ data: [unread] })
  await handlers.fetchLatestMessages([a.id])
  const summary = sourceSummaries(captured)
  assert.deepEqual(summary.unreadByTrack, captured.unreadByTrack)
  assert.deepEqual(summary.latestByTrack, captured.latestByTrack)
  assert.equal(sourceSummaries(captured), summary)
  assert.equal(model(captured, summary).inbox.length, 1)
  state.responses.push({ data: null, error: { message: 'syntetisk' } })
  await handlers.fetchLatestMessages([a.id])
  assert.equal(sourceSummaries(captured).messageInboxError, MESSAGE_INBOX_ERROR)
  assert.equal(model(captured, sourceSummaries(captured)).inbox.length, 0)
  for (const source of [undefined, { state: 'loading' }, { state: 'ready' }])
    assert.deepEqual(entropi2MessageSummary(source), { latestByTrack: {}, unreadByTrack: {}, pendingByTrack: {}, messageInboxError: null })
  // Med notesignalet tændt følger pendingByTrack samme kilde.
  assert.equal(entropi2MessageSummary(captured.morning.messages, { noteSignalEnabled: true }).messageInboxError, MESSAGE_INBOX_ERROR)
})

test('R6: Dashboard giver kun CoachScreen kildens sammendrag med flaget; OFF-grenene er uændrede', () => {
  const source = readFileSync(new URL('../Dashboard.jsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
  assert.match(source, /const e2Beskeder = e2 \? entropi2MessageSummary\(coachMorningData\.messages, \{ noteSignalEnabled: COACH_NOTE_SIGNAL_ENABLED \}\) : null/)
  const screen = source.slice(source.indexOf('<CoachScreen enabled={true}'), source.indexOf('readContext={e2ReadContext} />'))
  assert.match(screen, /\{\.\.\.e2Beskeder\}/)
  assert.doesNotMatch(screen, /latestByTrack|unreadByTrack|pendingByTrack|messageInboxError/)
  // Den gamle forside får stadig Dashboardets egne sammendrag.
  assert.match(source, /videoMeasurementByAthlete, videoReviewQueueError, latestByTrack, videoReviewQueue, coachActionsStatus,/)
})

// Runde 6 (fortsat): øvrige props til CoachScreen fra læsninger uden eget token.
function gated(entropi2 = true, extra = {}) {
  state.calls.length = 0; state.responses.length = 0
  const captured = { morning: {}, status: {}, athletes: undefined, loadError: undefined, loading: undefined, videoError: undefined }
  const handlers = lavLaesninger({ session, coachMorning: true, coachActions: true,
    ...(entropi2 ? { entropi2CalendarRead, entropi2ReadGate } : {}),
    setCoachMorningData: fn => { captured.morning = fn(captured.morning) },
    setCoachActionsStatus: fn => { captured.status = fn(captured.status) },
    setVideoReviewQueueError: v => { captured.videoError = v }, setVideoReviewQueue: () => {},
    setAthletes: v => { captured.athletes = v }, setHiddenAthleteIds: () => {}, setSnoozedAthletes: () => {},
    setLoadError: v => { captured.loadError = v }, setLoading: v => { captured.loading = v },
    setAthleteCurrentWeek: () => {}, setAthleteWeekCompletion: () => {}, setAthleteWeekSummary: () => {},
    setAthleteLastLogs: () => {}, setWeeklyActivity: () => {}, setProfilesLastSeen: () => {}, ...extra })
  return { handlers, captured }
}
async function race(handlers, name, args, lateA, answerB, followUps = 0) {
  let releaseA
  state.responses.push(new Promise((resolve, reject) => { releaseA = () => lateA instanceof Error ? reject(lateA) : resolve(lateA) }), answerB)
  // Tomme svar til de læsninger, en vellykket atletlæsning selv starter bagefter.
  for (let i = 0; i < followUps; i++) state.responses.push({ data: [] })
  const first = handlers[name](...args)
  await handlers[name](...args)
  releaseA(); await first.catch(() => {})
}
const video = { id: 'syn-v1', athlete_id: a.id, status: 'draft', created_at: new Date().toISOString() }

test('R6: videokøens fejl kommer fra samme videokilde; en afløst fejl blander sig ikke', async () => {
  for (const lateA of [{ data: null, error: { message: 'syntetisk' } }, Error('syntetisk kast')]) {
    const { handlers, captured } = gated()
    await race(handlers, 'fetchVideoReviewQueue', [], lateA, { data: [video] })
    assert.equal(captured.morning.videos.state, 'ready')
    // Reproduktion: Dashboardets egen fejl er sat af det afløste svar (kast giver ingen state-fejl, men afvist læser).
    if (!(lateA instanceof Error)) assert.equal(captured.videoError, 'syntetisk')
    const props = videoReviewQueueError => ({ ...sourceSummaries(captured), videoReviewQueueError })
    if (!(lateA instanceof Error)) {
      const stale = model(captured, props(captured.videoError))
      assert.equal(stale.videos.usable, false); assert.equal(stale.hasError, true)
    }
    const fixed = model(captured, props(entropi2VideoQueueError(captured.morning.videos)))
    assert.equal(fixed.videos.usable, true); assert.equal(fixed.hasError, false)
    assert.equal(fixed.inbox.filter(item => item.item.kind === 'video').length, 1)
  }
  // Den gældende kildes egen fejl vises stadig.
  const { handlers, captured } = gated()
  state.responses.push({ data: null, error: { message: 'syntetisk' } })
  await handlers.fetchVideoReviewQueue()
  assert.equal(entropi2VideoQueueError(captured.morning.videos), VIDEO_QUEUE_ERROR)
  assert.equal(entropi2VideoQueueError(undefined), null)
})

test('R6: en afløst atletlæsning sætter hverken atleter, fejl eller indlæsning med flaget; OFF uændret', async () => {
  for (const [lateA, check] of [[{ data: [a] }, c => assert.deepEqual(c.athletes, [])],
    [{ data: null, error: { message: 'syntetisk' } }, c => assert.equal(c.loadError, false)]]) {
    const on = gated()
    await race(on.handlers, 'fetchAthletes', [], lateA, { data: [] })
    check(on.captured); assert.equal(on.captured.loading, false)
    // OFF: den eksisterende læser er uændret, og det sene svar vinder som før.
    const off = gated(false)
    await race(off.handlers, 'fetchAthletes', [], lateA, { data: [] }, lateA.data ? 3 : 0)
    await new Promise(resolve => setImmediate(resolve))
    if (lateA.data) assert.deepEqual(off.captured.athletes, [a]); else assert.equal(off.captured.loadError, true)
  }
})

test('R6: en afløst fremdriftslæsning sætter ikke fejlstatus med flaget; OFF uændret', async () => {
  for (const lateA of [{ data: null, error: { message: 'syntetisk' } }, Error('syntetisk kast')]) {
    const on = gated()
    await race(on.handlers, 'fetchCalendarProgress', [[a.id]], lateA, { data: [] })
    assert.equal(on.captured.status.progress, 'ready')
    const off = gated(false)
    await race(off.handlers, 'fetchCalendarProgress', [[a.id]], lateA, { data: [] })
    assert.equal(off.captured.status.progress, 'error')
  }
})

test('R6: Dashboard giver CoachScreen videofejlen fra videokilden og læseren vagten kun med flaget', () => {
  const source = readFileSync(new URL('../Dashboard.jsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
  const screen = source.slice(source.indexOf('<CoachScreen enabled={true}'), source.indexOf('readContext={e2ReadContext} />'))
  assert.match(screen, /videoReviewQueueError=\{entropi2VideoQueueError\(coachMorningData\.videos\)\}/)
  assert.equal(screen.match(/videoReviewQueueError/g).length, 1)
  assert.match(source, /\.\.\.\(e2 \? \{ entropi2CalendarRead, entropi2ReadGate, inboxRefreshRunnerRef: e2InboxRefreshRunnerRef \} : \{\}\),/)
})
