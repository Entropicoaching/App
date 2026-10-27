import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './frem3Loader.mjs'
import { mount, nodes, text, io } from './frem3Dom.mjs'
install()
const { personalRecordRows } = await import('./fremgangPersonalRecords.mjs')
const { default: Full } = await import('./FremgangTab.jsx')
const { default: Simple } = await import('./EnkelFremgangTab.jsx')
const log = (name, day, weight = 100, extra = {}) => ({
  exercises: { name }, logged_at: day, weight, reps_completed: 5, ...extra,
})
const pair = [log('Squat', '2026-10-01', 100), log('Squat', '2026-10-08', '102,5')]
const records = tree => nodes(tree, n => n.props['data-personal-record'] !== undefined)

test('fresh: Copenhagen midnight and winter clock change count distinct days', () => {
  assert.equal(personalRecordRows({ logs: [log('Squat', '2026-10-24T22:30:00Z'),
    log('Squat', '2026-10-25T23:30:00Z')] }).length, 1)
  assert.deepEqual(personalRecordRows({ logs: [log('Squat', '2026-10-25T00:30:00Z'),
    log('Squat', '2026-10-25T01:30:00Z')] }), [])
})

test('fresh: local rename, deload and clearing a set override server history', () => {
  const currentWeek = { sessions: [{ exercises: [{ id: 'live', name: 'Front squat' }] }] }
  const server = { ...pair[1], exercise_id: 'live', weight: 500 }
  const props = { logs: [pair[0], server], currentWeek,
    allWeeks: [{ sessions: [{ exercises: [{ id: 'live', name: 'Squat' }] }] }],
    exerciseLogs: [{ ...pair[1], exercise_id: 'live' }] }
  assert.deepEqual(personalRecordRows(props), [])
  currentWeek.sessions[0].exercises[0].name = 'Squat'
  assert.equal(personalRecordRows(props)[0].weight, 102.5)
  currentWeek.block_name = 'Taper'
  assert.deepEqual(personalRecordRows(props), [])
  currentWeek.block_name = 'Strength'
  assert.deepEqual(personalRecordRows({ ...props, exerciseLogs: [] }), [])
  assert.deepEqual(personalRecordRows({ ...props, exerciseLogs: [{ ...props.exerciseLogs[0], weight: '' }] }), [])
})

test('fresh: each variant needs its own two logged days', () => {
  const rows = personalRecordRows({ logs: [...pair,
    log('Front squat', '2026-10-01', 200), log('Front squat', '2026-10-08', 210),
    log('Sumo deadlift', '2026-10-01', 300)] })
  assert.deepEqual(rows.map(r => r.key).sort(), ['front squat', 'squat'])
  assert.equal(rows.find(r => r.key === 'front squat').weight, 210)
})

test('fresh: equal-score timestamp tie is deterministic and input is immutable', () => {
  const logs = [log('Squat', '2026-10-01', 90),
    log('Squat', '2026-10-08T10:00:00Z', 100, { id: 'z' }),
    log('Squat', '2026-10-08T10:00:00Z', 100, { id: 'a' })]
  const before = JSON.stringify(logs)
  logs.forEach(Object.freeze)
  Object.freeze(logs)
  const result = personalRecordRows({ logs })
  assert.equal(result[0].order, 'a|')
  assert.deepEqual(result, personalRecordRows({ logs: [...logs].reverse() }))
  assert.equal(JSON.stringify(logs), before)
})

for (const Component of [Full, Simple]) test('fresh: view updates remove stale records in ' + Component.name, () => {
  const props = { fremgangLogs: pair, currentWeek: { sessions: [] }, allWeeks: [],
    exerciseLogs: [], personalRecords: true, enkelDel: 'rekorder' }
  const app = mount(Component, props)
  assert.equal(records(app.render()).length, 1)
  assert.equal(records(app.render({ ...props, fremgangLoading: true })).length, 0)
  assert.equal(records(app.render({ ...props, fremgangLogs: [] })).length, 0)
  for (const personalRecords of [false, undefined, 'true', 1, {}, null])
    assert.equal(records(app.render({ ...props, personalRecords })).length, 0)
  const restored = app.render(props)
  assert.match(text(records(restored)[0]), /102,5 kg/)
  assert.equal(nodes(restored, n => n.type === 'time')[0].props.dateTime, '2026-10-08')
  assert.equal(io.rpc, 0)
})
