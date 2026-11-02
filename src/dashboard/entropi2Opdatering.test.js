// Entropi 2-kobling runde 7: indbakkeopdateringen fornyer coachskærmens kalender, fremdrift og
// aktivitet med flaget tændt, også med en tom atletliste. Faktisk lavLaesninger med den syntetiske
// database fra testLoader, faktisk kontekst og faktisk coachmodel.
import './testLoader.mjs'
import test, { mock } from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { state } from './synthetic.mjs'
import { entropi2CalendarRead, entropi2ReadContext, entropi2ReadGate } from '../entropi2/coachReadContext.mjs'
import { entropi2MessageSummary } from '../entropi2/coachMessageSummary.mjs'
import { coachHomeModel } from '../entropi2/coach/coachModel.mjs'
import { morningDay } from './coachMorningSource.mjs'
// testLoader erstatter læserens hjælpere fra coachInboxState med kastende stubbe; her bruges de faktiske.
registerHooks({ resolve(specifier, context, next) {
  if (specifier === '../coachInboxState.js' && context.parentURL?.endsWith('/laesninger.js'))
    return { url: new URL('../coachInboxState.js', import.meta.url).href, shortCircuit: true }
  return next(specifier, context)
} })
const { lavLaesninger } = await import('./laesninger.js')

const session = { user: { id: 'syn-coach' } }
const a = { id: 'syn-a', name: 'Syntetisk A' }
const noop = () => {}
function reader({ entropi2 = true, athletes = [a] } = {}) {
  state.calls.length = 0; state.responses.length = 0
  // Alle læsninger svarer tomt; rækkefølgen er derfor ligegyldig.
  for (let i = 0; i < 40; i++) state.responses.push({ data: [] })
  const captured = { status: {}, morning: {}, calendar: undefined, refreshing: [] }
  const setters = Object.fromEntries(['setTodayData', 'setVideoReviewQueue', 'setVideoReviewQueueError', 'setTrainingSignals',
    'setTrainingSignalsError', 'setAutomationAlerts', 'setAutomationAlertsError', 'setCoachBriefingSeen', 'setUnreadCounts',
    'setUnreadByTrack', 'setLatestByTrack', 'setPendingByTrack', 'setMessageInboxError', 'setInboxRefreshStatus',
    'setAthleteCurrentWeek', 'setAthleteWeekCompletion', 'setAthleteLastLogs', 'setWeeklyActivity'].map(name => [name, noop]))
  const handlers = lavLaesninger({ ...setters, session, coachActions: true, coachMorning: true,
    ...(entropi2 ? { entropi2CalendarRead, entropi2ReadGate } : {}),
    inboxRefreshRunnerRef: { current: fn => fn() }, videoCoachAthletesRef: { current: athletes },
    setInboxRefreshing: value => captured.refreshing.push(value),
    setCoachActionsStatus: fn => { captured.status = fn(captured.status) },
    setCoachMorningData: fn => { captured.morning = fn(captured.morning) },
    setCalendarWeeks: value => { captured.calendar = value } })
  return { handlers, captured }
}
const context = (captured, athletes) => entropi2ReadContext({ enabled: true, loading: false, loadError: false, coachId: 'syn-coach',
  athletes, calendarWeeks: captured.calendar, coachActionsStatus: captured.status, coachMorningData: captured.morning })
const unread = { id: 'syn-m1', athlete_id: a.id, sender_role: 'athlete', category: 'besked', content: 'Ulæst',
  created_at: new Date().toISOString(), read_by_coach: false }

test('R7: uden kalenderlæsning skjuler coachens indbakke en accepteret ulæst besked; opdateringen retter det', async () => {
  const { handlers, captured } = reader()
  // En accepteret beskedkilde for i dag, som readMorningSource ville efterlade den.
  const messages = { token: {}, ids: [a.id], rows: [unread], day: morningDay(), state: 'ready' }
  const model = ctx => coachHomeModel({ session, athletes: [a], readContext: ctx, loading: false, loadError: false,
    calendarWeeks: captured.calendar || {}, coachActionsStatus: captured.status,
    coachMorningData: { ...captured.morning, messages }, ...entropi2MessageSummary(messages) })
  // Reproduktion: direkte åbning af indbakken uden kalenderlæsning giver ingen kontekst og en tom indbakke.
  assert.equal(context(captured, [a]), undefined)
  assert.equal(model(undefined).inbox.length, 0)
  await handlers.refreshCoachInbox()
  const tables = state.calls.map(call => call.table)
  assert.ok(tables.includes('weeks'), 'kalenderen læses')
  // Dagens aktivitet (fetchTodayActivity) læser også exercise_logs; fremdrift og aktivitet kommer oven i.
  assert.equal(tables.filter(t => t === 'exercise_logs').length, 3, 'dagens aktivitet, fremdrift og aktivitet læses')
  assert.equal(captured.status.calendar, 'ready'); assert.equal(captured.status.progress, 'ready')
  assert.equal(captured.status.activity.state, 'ready')
  const ctx = context(captured, [a])
  assert.deepEqual(ctx.athleteIds, [a.id])
  assert.equal(model(ctx).inbox.length, 1)
  assert.deepEqual(captured.refreshing, [true, false])
})

test('R7: en ny opdatering efter midnat giver dagens kontekst', async () => {
  const { handlers, captured } = reader()
  try {
    mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-02T22:50:00Z') })
    await handlers.refreshCoachInbox()
    assert.equal(context(captured, [a]).day, '2026-11-02')
    mock.timers.setTime(Date.parse('2026-11-02T23:10:00Z'))
    for (let i = 0; i < 40; i++) state.responses.push({ data: [] })
    await handlers.refreshCoachInbox()
    assert.equal(context(captured, [a]).day, '2026-11-03')
    assert.equal(captured.status.activity.day, '2026-11-03')
  } finally { mock.timers.reset() }
})

test('R7: med en tom atletliste giver opdateringen stadig en kontekst; coachskærmen viser ingen synlige atleter', async () => {
  const { handlers, captured } = reader({ athletes: [] })
  await handlers.refreshCoachInbox()
  assert.deepEqual(context(captured, []), { coachId: 'syn-coach', athleteIds: [], day: context(captured, []).day })
  const m = coachHomeModel({ session, athletes: [], readContext: context(captured, []), loading: false, loadError: false,
    calendarWeeks: captured.calendar, coachActionsStatus: captured.status, coachMorningData: captured.morning })
  assert.equal(m.rosterReady, true)
})

test('R7: med flaget slukket læser opdateringen ikke kalender, fremdrift eller aktivitet', async () => {
  const { handlers, captured } = reader({ entropi2: false })
  await handlers.refreshCoachInbox()
  const tables = state.calls.map(call => call.table)
  assert.equal(tables.includes('weeks'), false)
  assert.equal(tables.filter(t => t === 'exercise_logs').length, 1, 'kun dagens aktivitet som før')
  assert.equal(captured.status.calendar, undefined)
})
