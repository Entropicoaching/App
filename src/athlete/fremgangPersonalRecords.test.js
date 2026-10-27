import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './frem3Loader.mjs'
import { mount, nodes, text, createElement, io } from './frem3Dom.mjs'
install()
const { personalRecordRows, renderPersonalRecords, DEFAULT_PERSONAL_RECORDS } = await import('./fremgangPersonalRecords.mjs')
const { default: Fremgang } = await import('./FremgangTab.jsx')
const { default: Enkel } = await import('./EnkelFremgangTab.jsx')
const log = (weight, day, name = 'Squat', extra = {}) => ({ weight, reps_completed: 5,
  logged_at: day + 'T10:00:00Z', exercises: { name }, ...extra })
const pair = [log(100, '2026-10-01'), log('102,5', '2026-10-08')]
const section = tree => nodes(tree, n => n.props['data-personal-records'] !== undefined)

test('no data, one day, skipped and invalid sets produce no records', () => {
  for (const logs of [null, [], [pair[0]], [pair[0], pair[0]],
    [pair[0], { ...pair[1], skipped: true }], [pair[0], { ...pair[1], logged_at: '2026-02-30' }]]) {
    assert.deepEqual(personalRecordRows({ logs }), [])
    assert.equal(renderPersonalRecords(createElement, { enabled: true, logs }), null)
  }
})
test('decimal comma, best set, date and actual lift identity', () => {
  const rows = personalRecordRows({ logs: [...pair, log(300, '2026-10-09', 'Front squat')] })
  assert.equal(rows.length, 1)
  assert.equal(rows[0].weight, 102.5)
  assert.equal(rows[0].day, '2026-10-08')
  const tree = renderPersonalRecords(createElement, { enabled: true, logs: pair })
  assert.match(text(tree), /102,5 kg × 5/)
  assert.match(text(tree), /08\.10\.2026/)
  assert.equal(nodes(tree, n => n.type === 'time')[0].props.dateTime, '2026-10-08')
})
test('ties choose first occurrence independently of input order', () => {
  const logs = [log(100, '2026-10-09'), log(100, '2026-10-01')]
  assert.deepEqual(personalRecordRows({ logs }), personalRecordRows({ logs: [...logs].reverse() }))
  assert.equal(personalRecordRows({ logs })[0].day, '2026-10-01')
})
test('light, deload, malformed numbers and fractional reps never qualify', () => {
  for (const bad of [log(999, '2026-10-09', 'Squat backoff'),
    log(999, '2026-10-09', 'Squat', { exercises: { name: 'Squat', sessions: { weeks: { block_name: 'Deload' } } } }),
    ...[Infinity, NaN, 0, -1, '1,2,3', '100 kg'].map(weight => log(weight, '2026-10-09')),
    ...[0, 2.5, 9, Infinity].map(reps_completed => log(999, '2026-10-09', 'Squat', { reps_completed }))])
    assert.deepEqual(personalRecordRows({ logs: [pair[0], bad] }), [])
})
test('local edits and undo own the current week; no planned weight becomes a record', () => {
  const week = { sessions: [{ exercises: [{ id: 'current', name: 'Squat', recommended_weight: 999 }] }] }
  const server = { ...pair[1], exercise_id: 'current', weight: 999 }
  const props = { logs: [pair[0], server], currentWeek: week }
  assert.deepEqual(personalRecordRows(props), [])
  assert.equal(personalRecordRows({ ...props, exerciseLogs: [{ ...pair[1], exercise_id: 'current' }] })[0].weight, 102.5)
  assert.deepEqual(personalRecordRows({ ...props, exerciseLogs: [{ ...server, skipped: true }] }), [])
})
test('flag accepts only true and loading never reveals stale records', () => {
  assert.equal(DEFAULT_PERSONAL_RECORDS, false)
  for (const enabled of [undefined, false, 'true', 1])
    assert.equal(renderPersonalRecords(createElement, { enabled, logs: pair }), null)
  assert.equal(renderPersonalRecords(createElement, { enabled: true, loading: true, logs: pair }), null)
})
for (const Component of [Fremgang, Enkel]) {
  test(Component.name + ' imports real view, renders records and keeps strength route isolated', () => {
    const props = { fremgangLogs: pair, allWeeks: [], currentWeek: { sessions: [] }, exerciseLogs: [], personalRecords: true, enkelDel: 'rekorder' }
    const tree = mount(Component, props).render()
    assert.equal(section(tree).length, 1)
    assert.match(text(section(tree)[0]), /102,5 kg × 5/)
    const unset = mount(Component, { ...props, personalRecords: undefined }).render()
    const off = mount(Component, { ...props, personalRecords: false }).render()
    assert.equal(JSON.stringify(unset), JSON.stringify(off))
    assert.equal(section(off).length, 0)
    assert.match(text(off), /Dine rekorder/)
    assert.equal(section(mount(Component, { ...props, fremgangLoading: true }).render()).length, 0)
    if (Component === Enkel) assert.equal(section(mount(Component, { ...props, enkelDel: 'styrke' }).render()).length, 0)
    assert.equal(io.rpc, 0)
  })
}
