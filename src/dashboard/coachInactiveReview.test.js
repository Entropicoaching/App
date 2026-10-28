import './coachInactiveLoader.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { inactiveTraining, activityDay } from './coachInactive.mjs'
import { mount, button, text, nodes } from './coachInactiveDom.mjs'
const { default: CoachActions } = await import('./CoachActions.jsx')
const { lavLaesninger } = await import('./laesninger.js')
import { state } from './coachInactiveFake.mjs'
const athlete = { id: 'a', name: '<script>syntetisk</script>' }
const source = { state: 'ready', day: '2026-10-27', ids: ['a'], rows: [{ athlete_id: 'a', logged_at: '2026-10-24T12:00:00Z' }] }
const props = { enabled: true, today: source.day, athletes: [athlete], dataStatus: { calendar: 'ready', progress: 'ready', activity: source } }
test('counter: inactive athletes need no other action or program; text stays an element text child', () => {
  const app = mount(CoachActions, props)
  button(app.render(), 'Ikke trænet i 3 dage').onClick()
  const tree = app.render()
  assert.match(text(tree), /syntetisk.*3 dage/)
  assert.doesNotMatch(text(tree), /Ingen handlinger i de indlæste data/)
  assert.equal(nodes(tree, n => n.type === 'script' || n.props.dangerouslySetInnerHTML).length, 0)
})
test('counter: filtered view cannot instantiate template editor or send messages, even with existing template opt-in', () => {
  const app = mount(CoachActions, props)
  button(app.render(), 'Ikke trænet i 3 dage').onClick()
  const tree = app.render({ ...props, templateMessages: true, sendTemplateMessage: () => { throw Error('No send allowed') }, latestByTrack: { a: { besked: { sender_role: 'athlete', created_at: source.day } } } })
  assert.equal(nodes(tree, n => n.type === 'textarea').length, 0)
  assert.equal(nodes(tree, n => n.type === 'li').length, 1)
})
test('counter: next calendar day invalidates evidence and duplicate athlete IDs never inflate count', () => {
  assert.equal(inactiveTraining({ enabled: true, athletes: [athlete, athlete], source, today: source.day }).rows.length, 1)
  assert.equal(inactiveTraining({ enabled: true, athletes: [athlete], source, today: '2026-10-28' }).unknown, 1)
})
test('counter: unknown dates, future rows plus old rows, and scope mismatch fail closed', () => {
  for (const rows of [[...source.rows, { athlete_id: 'a', logged_at: '2026-10-28' }], [...source.rows, { athlete_id: 'a', logged_at: '2026-02-30' }]]) {
    const m = inactiveTraining({ enabled: true, athletes: [athlete], source: { ...source, rows }, today: source.day })
    assert.equal(m.rows.length, 0); assert.equal(m.unknown, 1)
  }
  assert.equal(activityDay('2026-10-27T08:60:00Z'), null)
  assert.equal(inactiveTraining({ enabled: true, athletes: [{ id: 'other' }], source, today: source.day }).unknown, 1)
})
test('counter: default OFF activity handler retains original data flow and performs no status writes', async () => {
  state.calls.length = 0; state.responses.length = 0
  let last
  const handlers = lavLaesninger({ setCoachActionsStatus: () => { throw Error('OFF status') }, setAthleteLastLogs: value => { last = value }, setWeeklyActivity: () => {} })
  state.responses.push({ data: [{ athlete_id: 'a', logged_at: '2026-10-24T22:30:00Z' }] })
  await handlers.fetchAthleteActivityLogs(['a'])
  assert.equal(state.calls.length, 1); assert.equal(last.a, '2026-10-25')
})
