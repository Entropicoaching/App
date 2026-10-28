import './coachInactiveLoader.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { activityDay, inactiveTraining, readCoachActivity } from './coachInactive.mjs'
const { default: CoachActions } = await import('./CoachActions.jsx')
const { lavLaesninger } = await import('./laesninger.js')
import { mount, button, text, nodes } from './coachInactiveDom.mjs'
import { state } from './coachInactiveFake.mjs'
const athletes = ['old', 'three', 'two', 'today', 'never', 'bad', 'future'].map(id => ({ id, name: id }))
const today = '2026-10-27'
const source = { state: 'ready', day: today, ids: athletes.map(a => a.id), rows: [
  ['old', '2026-10-20'], ['three', '2026-10-24'], ['two', '2026-10-25'], ['today', today], ['bad', 'bad'], ['future', '2026-10-28'],
].map(([athlete_id, logged_at]) => ({ athlete_id, logged_at })) }
const model = extra => inactiveTraining({ enabled: true, athletes, source, today, ...extra })
test('exactly three local calendar days qualifies; two, today, never, invalid and future do not', () => {
  const snapshot = JSON.stringify(source)
  const m = model(); assert.deepEqual(m.rows.map(r => [r.athlete.id, r.days]), [['old', 7], ['three', 3]])
  assert.equal(m.noSessions, 1); assert.equal(m.unknown, 2)
  assert.equal(JSON.stringify(source), snapshot)
})
test('unknown, stale, failed and out-of-scope history never establish inactivity', () => {
  for (const extra of [{ source: undefined }, { loading: true }, { hasError: true }, ...['loading', 'error'].map(state => ({ source: { ...source, state } })), { source: { ...source, day: '2026-10-26' } }, { source: { ...source, ids: [] } }]) {
    assert.equal(model(extra).rows.length, 0); assert.equal(model(extra).unknown, athletes.length)
  }
})
test('DST spring and fall use date ordinals, independent of elapsed hours or host timezone', () => {
  for (const [last, now] of [['2026-03-27T23:30:00Z', '2026-03-30T22:30:00Z'], ['2026-10-23T22:30:00Z', '2026-10-26T23:30:00Z']]) {
    const day = activityDay(now)
    const m = model({ today: now, athletes: [athletes[0]], source: { ...source, day, rows: [{ athlete_id: 'old', logged_at: last }] } })
    assert.equal(m.rows[0].days, 3)
  }
  assert.equal(activityDay('2026-10-24T22:30:00Z'), '2026-10-25')
  for (const value of ['2026-02-30', '2026-10-27T24:00:00Z', '2026-10-27T00:00:00', '', null]) assert.equal(activityDay(value), null)
})
test('unordered duplicate sets use latest training day; skipped or foreign rows cannot qualify', () => {
  const m = model({ source: { ...source, rows: [...source.rows, { athlete_id: 'old', logged_at: today }, { athlete_id: 'never', logged_at: '2026-10-01', skipped: true }, { athlete_id: 'stranger', logged_at: '2026-01-01' }] } })
  assert.deepEqual(m.rows.map(r => r.athlete.id), ['three']); assert.equal(m.noSessions, 1)
})
test('default OFF preserves operation identity and does not inspect data or setters', () => {
  const poison = new Proxy([], { get() { throw Error('OFF read') } })
  const result = Promise.resolve({ data: [] })
  assert.equal(readCoachActivity(false, poison, () => { throw Error('OFF write') }, () => result), result)
  assert.deepEqual(inactiveTraining({ athletes: poison }), { rows: [], unknown: 0, noSessions: 0 })
  assert.equal(CoachActions({ athletes: poison }), null)
})
function store() { let status = {}; return { get value() { return status }, set(fn) { status = fn(status) } } }
test('capture handles caps, errors, rejection and overlapping reads without stale overwrite', async () => {
  for (const [response, expected] of [[{ data: [] }, 'ready'], [{ data: Array(1000).fill({}) }, 'partial'], [{ data: [], error: {} }, 'error'], [{ data: null }, 'error']]) {
    const s = store(); assert.equal(await readCoachActivity(true, ['a'], s.set, () => Promise.resolve(response)), response); assert.equal(s.value.activity.state, expected)
  }
  const s = store(); await assert.rejects(readCoachActivity(true, ['a'], s.set, () => { throw Error('fail') })); assert.equal(s.value.activity.state, 'error')
  let finish; const first = readCoachActivity(true, ['old'], s.set, () => new Promise(resolve => { finish = resolve }))
  await readCoachActivity(true, ['new'], s.set, () => ({ data: [] }))
  finish({ data: [] }); await first; assert.deepEqual(s.value.activity.ids, ['new'])
})
test('actual activity handler makes only the existing scoped non-skipped read and captures status', async () => {
  state.calls.length = 0; state.responses.length = 0
  const s = store(), captured = {}
  const handlers = lavLaesninger({ coachActions: true, setCoachActionsStatus: s.set, setAthleteLastLogs: v => { captured.last = v }, setWeeklyActivity: v => { captured.week = v } })
  state.responses.push({ data: [{ athlete_id: 'a', logged_at: '2026-10-24T12:00:00Z' }] })
  await handlers.fetchAthleteActivityLogs(['a'])
  assert.equal(state.calls.length, 1); assert.equal(state.calls[0].table, 'exercise_logs')
  assert.deepEqual(state.calls[0].steps, [['select', 'athlete_id, logged_at'], ['in', 'athlete_id', ['a']], ['eq', 'skipped', false], ['order', 'logged_at', { ascending: false }]])
  assert.equal(s.value.activity.state, 'ready'); assert.equal(captured.last.a, '2026-10-24')
  state.responses.push({ data: null, error: {} }); await handlers.fetchAthleteActivityLogs(['a']); assert.equal(s.value.activity.state, 'error')
})
test('actual dagsliste filter changes rows, reports excluded history, opens Log and returns to original actions', () => {
  const opened = []
  const props = { enabled: true, today, athletes, dataStatus: { calendar: 'ready', progress: 'ready', activity: source },
    latestByTrack: { today: { besked: { sender_role: 'athlete', created_at: today } } },
    openProfile: (...args) => opened.push(args), openCoachPriorityItem: () => { throw Error('Unexpected priority action') } }
  const app = mount(CoachActions, props)
  let tree = app.render(); assert.match(text(tree), /Besked venter/)
  button(tree, 'Ikke trænet i 3 dage').onClick(); tree = app.render()
  assert.doesNotMatch(text(tree), /Besked venter/); assert.match(text(tree), /1 uden registrerede pas/); assert.match(text(tree), /2 med ukendt historik/)
  assert.equal(nodes(tree, n => n.type === 'li').length, 2)
  button(tree, 'three: 3 dage siden sidste pas (2026-10-24)').onClick(); assert.deepEqual(opened, [[athletes[1], 'log', 'list']])
  tree = app.render({ ...props, dataStatus: { ...props.dataStatus, activity: { ...source, state: 'error' } } })
  assert.equal(nodes(tree, n => n.type === 'li').length, 0); assert.match(text(tree), /7 med ukendt historik/)
  button(tree, 'Alle handlinger').onClick(); tree = app.render(props); assert.match(text(tree), /Besked venter/)
})
