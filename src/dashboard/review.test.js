import './testLoader.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
const { lavLaesninger } = await import('./laesninger.js')
const { lavLaesninger : baseline } = await import('./baselineLaesninger.js')
const { default: CoachActions } = await import('./CoachActions.jsx')
import { actionSessions, buildCoachActions } from './coachActions.mjs'
import { state, elements, textContent } from './synthetic.mjs'

function handlers(factory, enabled) {
  const result = { status: {} }
  const h = factory({ coachActions: enabled,
    setCalendarWeeks: value => { result.calendar = value },
    setAthleteCurrentWeek: value => { result.current = value },
    setAthleteWeekCompletion: value => { result.completion = value },
    setCoachActionsStatus: fn => { result.status = fn(result.status) },
  })
  return { h, result }
}

test('fresh OFF differential: original handlers retain values, queries and failures', async () => {
  for (const method of ['fetchCalendarWeeks', 'fetchCalendarProgress']) {
    const row = method === 'fetchCalendarWeeks'
      ? { id: 'w', athlete_id: 'a', start_date: '2026-10-19', week_number: 1, sessions: [] }
      : { athlete_id: 'a', logged_at: '2026-10-24', skipped: true, exercises: { reps: '5', sessions: { id: 's', weeks: { week_number: 1 } } } }
    for (const response of [{ data: [] }, { data: [row] }, { data: [row], error: { message: 'partial' } }, { data: null, error: { message: 'offline' } }, Error('offline')]) {
      const outcomes = []
      for (const factory of [baseline, lavLaesninger]) {
        state.calls.length = 0; state.responses.length = 0
        const { h, result } = handlers(factory, false)
        state.responses.push(response)
        let error
        try { await h[method](['a']) } catch (e) { error = e.message }
        // The existing date-window query uses the wall clock; compare its structure.
        const calls = state.calls.map(call => ({ ...call, steps: call.steps.map(step => step[0] === 'gte' ? step.slice(0, 2) : step) }))
        outcomes.push({ result, calls, error })
      }
      assert.deepEqual(outcomes[1], outcomes[0])
    }
  }
})

test('fresh empty athlete handlers: ON is known empty without queries, OFF matches original', async () => {
  for (const enabled of [false, true]) {
    state.calls.length = 0; state.responses.length = 0
    const { h, result } = handlers(lavLaesninger, enabled)
    await h.fetchCalendarWeeks([]); await h.fetchCalendarProgress([])
    assert.equal(state.calls.length, 0)
    assert.deepEqual(result, enabled ? { status: { calendar: 'ready', progress: 'ready' }, calendar: {}, current: {}, completion: {} } : { status: {} })
    if (enabled) {
      const tree = CoachActions({ enabled, athletes: [], dataStatus: result.status })
      assert.match(textContent(tree), /Ingen handlinger/)
      assert.equal(elements(tree, 'button').length, 0)
      assert.equal(elements(tree, 'p').some(p => p.props.role === 'status'), false)
    }
  }
})

test('fresh partial failure ON withholds stale training but retains a message destination', async () => {
  state.calls.length = 0; state.responses.length = 0
  const { h, result } = handlers(lavLaesninger, true)
  state.responses.push({ data: [], error: { message: 'partial' } })
  await h.fetchCalendarWeeks(['a'])
  assert.equal(result.status.calendar, 'error')
  assert.equal(result.calendar, undefined)
  const calls = []
  const tree = CoachActions({ enabled: true, today: '2026-10-26', athletes: [{ id: 'a', name: 'Anna' }],
    calendarWeeks: { a: [{ start_date: '2026-10-19', week_number: 1, session_count: 1, actionSessions: [{ id: 's', plannedSets: 2 }] }] },
    completion: { a: {} }, dataStatus: { ...result.status, progress: 'ready' },
    latestByTrack: { a: { teknik: { sender_role: 'athlete', created_at: '2026-10-25' } } },
    openCoachPriorityItem: (...args) => calls.push(args),
  })
  assert.match(textContent(tree), /ufuldstændig/)
  assert.doesNotMatch(textContent(tree), /pas uden log/)
  const buttons = elements(tree, 'button'); assert.equal(buttons.length, 1)
  buttons[0].props.onClick()
  assert.equal(calls[0][0].track, 'teknik'); assert.equal(calls[0][1], 'list')
})

test('fresh note poison and training boundaries across spring and autumn clock changes', () => {
  const poison = () => { throw Error('note inspected') }
  const sessions = actionSessions([{ id: 's', get athlete_comment() { return poison() }, exercises: [{ sets: 3 }] }])
  for (const [start, before, due] of [
    ['2026-03-23', '2026-03-29T21:59:59Z', '2026-03-29T22:00:00Z'],
    ['2026-10-19', '2026-10-25T22:59:59Z', '2026-10-25T23:00:00Z'],
  ]) {
    const args = { enabled: true, athletes: [{ id: 'a' }], calendarWeeks: { a: [{ start_date: start, week_number: 1, session_count: 1, actionSessions: sessions }] }, completion: { a: { 1: { get notes() { return poison() } } } } }
    assert.deepEqual(buildCoachActions({ ...args, today: before }), [])
    assert.equal(buildCoachActions({ ...args, today: due })[0].rank, 0)
  }
})

test('fresh DOM renders arbitrary names as text and ties choose the same video', () => {
  const args = { enabled: true, today: '2026-10-26', athletes: [{ id: 'a', name: '<script>Anna</script>' }],
    dataStatus: { calendar: 'ready', progress: 'ready' }, videos: ['z', 'a'].map(id => ({ id, athlete_id: 'a', status: 'draft', created_at: '2026-10-25' })) }
  for (let i = 0; i < 2; i++) {
    const tree = CoachActions(args)
    assert.equal(elements(tree, 'script').length, 0)
    assert.match(textContent(tree), /<script>Anna<\/script>/)
    assert.equal(buildCoachActions(args)[0].item.video.id, 'a')
    args.videos.reverse()
  }
})
