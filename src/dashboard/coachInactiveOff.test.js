import './coachInactiveOffLoader.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { calls, reset, nodes, text } from './coachInactiveOffDom.mjs'
const { default: CoachActions } = await import('./CoachActions.jsx')
const { default: ForsideView } = await import('./ForsideView.jsx')
import { COACH_ACTIONS_ENABLED, buildCoachActions } from './coachActions.mjs'
const ready = { calendar: 'ready', progress: 'ready' }
function home(flag) {
  const opened = []
  const props = { athletes: [{ id: 'visible', name: 'Synlig' }, { id: 'hidden', name: 'Skjult' }],
    hiddenAthleteIds: new Set(['hidden']), calendarWeeks: {}, athleteCurrentWeek: {}, athleteLastLogs: {},
    athleteWeekCompletion: {}, athleteWeekSummary: {}, coachBriefingSeen: {}, coachPriorityItems: [],
    coachPriorityCount: 0, unreadCounts: {}, videoMeasurementByAthlete: {},
    latestByTrack: Object.fromEntries(['visible', 'hidden'].map(id => [id, { besked: { sender_role: 'athlete', created_at: '2020-01-01' } }])),
    coachActionsStatus: ready, coachActions: flag,
    openCoachPriorityItem: (...args) => opened.push(args), openProfile() {} }
  return { tree: ForsideView(props), opened }
}
test('importSafety reproduction: actual JSX module imports with helper and default OFF', () => {
  reset()
  assert.equal(COACH_ACTIONS_ENABLED, false)
  assert.equal(typeof buildCoachActions, 'function')
  assert.equal(CoachActions({}), null)
  const tree = CoachActions({ enabled: true, athletes: [], dataStatus: ready })
  assert.equal(tree.type, 'section')
  assert.equal(tree.props['data-coach-actions'], true)
  assert.deepEqual(calls, { hooks: 0, filterMounts: 0 })
})
test('kandFlet3 reproduction: actual home excludes hidden athlete and opens visible thread', () => {
  reset()
  const { tree, opened } = home(true)
  const section = nodes(tree).find(n => n.props['data-coach-actions'])
  assert.ok(section); assert.match(text(section), /Synlig/); assert.doesNotMatch(text(section), /Skjult/)
  const buttons = nodes(section).filter(n => n.type === 'button')
  assert.equal(buttons.length, 1)
  buttons[0].props.onClick()
  assert.equal(opened[0][0].athlete.id, 'visible')
  assert.deepEqual(calls, { hooks: 0, filterMounts: 0 })
})
test('counter: default OFF and all non-true flags avoid filter, hooks and athlete reads', () => {
  reset()
  const athletes = new Proxy([], { get() { throw Error('OFF athlete read') } })
  for (const enabled of [undefined, false, 0, 1, '', 'true', {}]) {
    assert.equal(CoachActions({ enabled, athletes, dataStatus: { activity: {} } }), null)
    assert.equal(nodes(home(enabled).tree).some(n => n.props['data-coach-actions']), false)
  }
  assert.deepEqual(calls, { hooks: 0, filterMounts: 0 })
})
test('counter: missing snapshots bypass filter for ordinary and template-only actions', () => {
  reset()
  for (const activity of [undefined, null, false]) for (const templateMessages of [false, true]) {
    const tree = CoachActions({ enabled: true, templateMessages, athletes: [], dataStatus: { ...ready, activity } })
    assert.match(text(tree), /Ingen handlinger/)
    assert.equal(nodes(tree).some(n => n.props['data-coach-inactive']), false)
  }
  assert.deepEqual(calls, { hooks: 0, filterMounts: 0 })
})
test('counter: each real activity state mounts filter; hook sentinel remains strict', () => {
  for (const state of ['loading', 'ready', 'partial', 'error']) {
    reset()
    assert.throws(() => CoachActions({ enabled: true, athletes: [], dataStatus: { ...ready, activity: { state } } }), /Unexpected useState in OFF tree/)
    assert.deepEqual(calls, { hooks: 1, filterMounts: 1 })
  }
})
