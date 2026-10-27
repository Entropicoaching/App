import './testLoader.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildCoachActions, actionDay, actionSessions, COACH_ACTIONS_ENABLED } from './coachActions.mjs'
const { default: CoachActions } = await import('./CoachActions.jsx')
const { lavLaesninger } = await import('./laesninger.js')
import { state, elements, textContent } from './synthetic.mjs'

const ready = { calendar: 'ready', progress: 'ready' }
function fixture() {
  return { enabled: true, today: '2026-10-26', athletes: [{ id: 'a', name: 'Anna' }],
    calendarWeeks: { a: [{ start_date: '2026-10-19', week_number: 8, session_count: 1, actionSessions: actionSessions([{ id: 's', exercises: [{ id: 'e', sets: 3 }] }]) }] },
    completion: { a: { 8: { sessionIds: { s: true } } } }, latestByTrack: {}, videos: [] }
}
const message = (date = '2026-10-25T12:00:00Z', role = 'athlete') => ({ sender_role: role, created_at: date, content: 'Kan vi tale sammen?' })
function render(a, extra = {}) { return CoachActions({ ...a, dataStatus: ready, ...extra }) }
function handlerFixture(enabled) {
  state.calls.length = 0; state.responses.length = 0
  const captured = { status: {} }
  const handlers = lavLaesninger({ coachActions: enabled,
    setCoachActionsStatus: fn => { captured.status = fn(captured.status) },
    setCalendarWeeks: value => { captured.calendar = value },
    setAthleteCurrentWeek: value => { captured.current = value },
    setAthleteWeekCompletion: value => { captured.completion = value },
  })
  return { handlers, captured }
}

test('default OFF is strict and touches no data, including component', () => {
  assert.equal(COACH_ACTIONS_ENABLED, false)
  const poison = new Proxy([], { get() { throw Error('OFF read') } })
  for (const enabled of [undefined, false, null, 1, 'true']) {
    assert.deepEqual(buildCoachActions({ enabled, athletes: poison }), [])
    assert.equal(CoachActions({ enabled, athletes: poison }), null)
  }
})
test('finished week with no logs produces missed session; current week does not', () => {
  const a = fixture(); a.completion = { a: {} }
  assert.match(buildCoachActions(a)[0].reason, /1 pas uden log/)
  a.today = '2026-10-25'; assert.deepEqual(buildCoachActions(a), [])
  a.today = '2026-10-26'; a.completion = {}; assert.deepEqual(buildCoachActions(a), [])
})
test('skipped sets and fewer reps each produce their own factual reason', () => {
  for (const [field, pattern] of [['sprungneSaet', /2 sprungne sæt/], ['saetUnderPlan', /2 sæt med færre gentagelser/]]) {
    const a = fixture(); a.completion.a[8][field] = 2
    const row = buildCoachActions(a)[0]; assert.equal(row.rank, 1); assert.match(row.reason, pattern)
  }
})
test('ordinary and technique messages remain actionable after read, coach reply clears each track', () => {
  for (const track of ['besked', 'teknik']) {
    const a = fixture(); a.latestByTrack.a = { [track]: { ...message(), read: true } }
    const row = buildCoachActions(a)[0]; assert.equal(row.rank, 2); assert.equal(row.item.track, track)
    a.latestByTrack.a[track] = message(undefined, 'coach'); assert.deepEqual(buildCoachActions(a), [])
  }
})
test('draft video only; future or invalid timestamps never manufacture action', () => {
  const a = fixture()
  for (const [status, date, expected] of [['draft', '2026-10-25', 1], ['sent', '2026-10-25', 0], ['draft', '2026-10-27', 0], ['draft', 'bad', 0]]) {
    a.videos = [{ id: 'v', athlete_id: 'a', status, created_at: date }]
    assert.equal(buildCoachActions(a).length, expected)
  }
})
test('no program can still have messages and video; no invented training action', () => {
  const a = fixture(); a.calendarWeeks = { a: [] }; a.completion = { a: {} }
  assert.deepEqual(buildCoachActions(a), [])
  a.latestByTrack.a = { besked: message() }; assert.equal(buildCoachActions(a)[0].rank, 2)
  a.latestByTrack = {}; a.videos = [{ id: 'v', athlete_id: 'a', status: 'draft', analyzed_at: '2026-10-25' }]
  assert.equal(buildCoachActions(a)[0].rank, 3)
})
test('set and session notes, question or reply text, never add or remove action', () => {
  const a = fixture()
  a.completion.a[8].actionNotes = [{ text: 'Skal jeg stoppe?', at: '2026-10-25' }]
  a.completion.a[8].notes = [{ note: 'Smerte?' }]
  a.calendarWeeks.a[0].actionSessions[0].comment = 'Har brug for svar'
  assert.deepEqual(buildCoachActions(a), [])
  a.latestByTrack.a = { besked: message() }
  const before = buildCoachActions(a); a.completion.a[8].notes = []; a.calendarWeeks.a[0].actionSessions[0].comment = ''
  assert.deepEqual(buildCoachActions(a), before)
})
test('sort by priority, oldest day, Danish name, ID; one row even with several signals', () => {
  const a = fixture(); a.athletes = [{ id: 'z', name: 'Bo' }, { id: 'b', name: 'Anna' }, { id: 'a', name: 'Anna' }, { id: 'old', name: 'Zoe' }, { id: 'v', name: 'Video' }]
  a.calendarWeeks = {}; a.completion = {}; a.latestByTrack = Object.fromEntries(a.athletes.slice(0, 4).map(ath => [ath.id, { besked: message(ath.id === 'old' ? '2026-10-24' : '2026-10-25') }]))
  a.videos = a.athletes.map(ath => ({ id: ath.id, athlete_id: ath.id, status: 'draft', created_at: '2026-10-20' }))
  const snapshot = JSON.stringify(a)
  assert.deepEqual(buildCoachActions(a).map(r => r.athlete.id), ['old', 'a', 'b', 'z', 'v'])
  assert.equal(JSON.stringify(a), snapshot)
})
test('all ranks order before lower priority even when older; hidden athletes retained', () => {
  const a = fixture(); a.athletes[0].hidden = true
  a.completion.a[8].sprungneSaet = 2; a.latestByTrack.a = { besked: message('2026-10-01') }
  assert.equal(buildCoachActions(a)[0].rank, 1)
  a.completion.a[8].sessionIds = {}; assert.equal(buildCoachActions(a)[0].rank, 0)
  assert.equal(buildCoachActions(a).length, 1)
})
test('Copenhagen DST uses calendar days for both transitions and due week', () => {
  for (const [stamp, day] of [['2026-03-28T23:30:00Z', '2026-03-29'], ['2026-03-29T22:30:00Z', '2026-03-30'], ['2026-10-24T22:30:00Z', '2026-10-25'], ['2026-10-25T23:30:00Z', '2026-10-26']]) assert.equal(actionDay(stamp), day)
  const a = fixture(); a.completion = { a: {} }; a.today = '2026-10-25T23:30:00Z'
  assert.equal(buildCoachActions(a).length, 1)
  a.calendarWeeks.a[0].start_date = '2026-03-23'; a.today = '2026-03-29T22:30:00Z'
  assert.equal(buildCoachActions(a).length, 1)
  for (const bad of ['2026-02-30', '2026-02-30T10:00:00Z', 'bad', null]) assert.equal(actionDay(bad), null)
})
test('synthetic DOM: empty, pending, failed, and actionable row are distinct', () => {
  const a = fixture()
  assert.match(textContent(render(a)), /Ingen handlinger/)
  for (const dataStatus of [{}, { calendar: 'error', progress: 'ready' }]) {
    const tree = render(a, { dataStatus }); assert.equal(elements(tree, 'p').filter(e => e.props.role === 'status').length, 1)
    assert.doesNotMatch(textContent(tree), /Ingen handlinger/)
  }
  assert.doesNotMatch(textContent(render(a, { hasError: true })), /Ingen handlinger/)
  a.completion.a[8].sprungneSaet = 1
  const calls = []; const tree = render(a, { openProfile: (...args) => calls.push(args) })
  assert.equal(tree.props['aria-label'], 'Hvem skal jeg hjælpe i dag')
  const button = elements(tree, 'button')[0]; assert.equal(button.props.type, 'button'); assert.ok(button.props.style.minHeight >= 44)
  button.props.onClick(); assert.deepEqual(calls, [[a.athletes[0], 'log', 'list']])
})
test('synthetic DOM: message/video buttons call the actual destination handler', () => {
  for (const kind of ['message', 'video']) {
    const a = fixture()
    if (kind === 'message') a.latestByTrack.a = { teknik: message() }
    else a.videos = [{ id: 'v', athlete_id: 'a', status: 'draft', created_at: '2026-10-25' }]
    const calls = []; elements(render(a, { openCoachPriorityItem: (...args) => calls.push(args) }), 'button')[0].props.onClick()
    assert.equal(calls[0][0].kind, kind); assert.equal(calls[0][1], 'list')
    assert.equal(calls[0][0].athlete.id, 'a')
  }
})
test('actual loader handlers: unchanged queries ON and OFF, empty known athletes, no notes in adapter', async () => {
  const projections = []
  for (const enabled of [false, true]) {
    const { handlers, captured } = handlerFixture(enabled)
    state.responses.push({ data: [] }, { data: [] })
    await handlers.fetchCalendarWeeks(['a']); await handlers.fetchCalendarProgress(['a'])
    projections.push(state.calls.map(call => call.steps.find(step => step[0] === 'select')[1]))
    assert.deepEqual(captured.calendar, enabled ? { a: [] } : {})
    assert.deepEqual(captured.completion, enabled ? { a: {} } : {})
    assert.deepEqual(captured.status, enabled ? ready : {})
  }
  assert.deepEqual(projections[0], projections[1])
  assert.ok(!projections[1].join().includes('readiness_logs'))
  assert.deepEqual(actionSessions([{ id: 's', athlete_comment: 'question', exercises: [{ sets: 3 }] }]), [{ id: 's', plannedSets: 3 }])
})
test('actual loader plus real logTegn: skipped and under-plan signals reach the component', async () => {
  const { handlers, captured } = handlerFixture(true)
  state.responses.push({ data: [{ athlete_id: 'a', id: 'w', week_number: 8, start_date: '2026-10-19', sessions: [{ id: 's', athlete_comment: 'question', exercises: [{ id: 'e', sets: 3, reps: '5' }] }] }] })
  await handlers.fetchCalendarWeeks(['a'])
  state.responses.push({ data: [true, false].map(skipped => ({ athlete_id: 'a', logged_at: '2026-10-24', skipped, reps_completed: 3, exercises: { reps: '5', sessions: { id: 's', weeks: { week_number: 8 } } } })) })
  await handlers.fetchCalendarProgress(['a'])
  assert.equal(captured.completion.a[8].sprungneSaet, 1); assert.equal(captured.completion.a[8].saetUnderPlan, 1)
  const a = { ...fixture(), calendarWeeks: captured.calendar, completion: captured.completion }
  assert.equal(buildCoachActions(a)[0].rank, 1)
  assert.equal(elements(render(a), 'button').length, 1)
})
test('actual handlers surface returned and thrown read failures; stale training data is withheld', async () => {
  for (const failure of [{ data: null, error: { message: 'offline' } }, Error('offline')]) {
    const { handlers, captured } = handlerFixture(true)
    state.responses.push(failure, failure)
    await handlers.fetchCalendarWeeks(['a']); await handlers.fetchCalendarProgress(['a'])
    assert.deepEqual(captured.status, { calendar: 'error', progress: 'error' })
    const a = fixture(); a.completion = { a: {} }
    const tree = render(a, { dataStatus: captured.status })
    assert.equal(elements(tree, 'button').length, 0); assert.match(textContent(tree), /ufuldstændig/)
  }
})
test('OFF actual handlers preserve thrown failure behavior', async () => {
  const { handlers, captured } = handlerFixture(false); state.responses.push(Error('offline'))
  await assert.rejects(handlers.fetchCalendarWeeks(['a']), /offline/); assert.deepEqual(captured.status, {})
})
test('wiring retains all existing home content and OFF projections', () => {
  const home = readFileSync(new URL('./ForsideView.jsx', import.meta.url), 'utf8')
  assert.match(home, /coachActions = COACH_ACTIONS_ENABLED/)
  assert.match(home, /coachTemplateMessages === true \|\| coachActionsEnabled\(coachActions\)\) && <CoachActions/)
  assert.match(home, /dataStatus=\{coachActionsStatus\}/)
})
