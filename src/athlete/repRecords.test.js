import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './repRecordsLoader.mjs'
import { mount, nodes, text, button, createElement } from './repRecordsDom.mjs'
install()
const { repRecordRows, renderRepRecords, DEFAULT_REP_RECORDS } = await import('./repRecords.mjs')
const { default: FremgangTab } = await import('./FremgangTab.jsx')
const { default: EnkelFremgangTab } = await import('./EnkelFremgangTab.jsx')
const log = (reps, weight, name = 'Squat', day = '2026-10-20', extra = {}) =>
  ({ exercises: { name }, reps_completed: reps, weight, logged_at: day, ...extra })
const record = (logs, name = 'Squat', reps = 1) => repRecordRows({ logs }).find(r => r.name === name).records.find(r => r.reps === reps)
const props = { fremgangLogs: [], exerciseLogs: [], allWeeks: [], currentWeek: { sessions: [] }, fremgangLoading: false }

test('exact 1/3/5/8 maxima never estimate or borrow from another rep count', () => {
  const logs = [log(1, 140), log(3, 125), log(5, 110), log(8, '95,5'), log(2, 999), log(4, 999), log(6, 999), log(7, 999), log(9, 999), log(20, 999)]
  assert.deepEqual(repRecordRows({ logs })[0].records.map(r => r.weight), [140, 125, 110, 95.5])
  assert.deepEqual(repRecordRows({ logs: [log(8, 100)] })[0].records.map(r => r.weight), [null, null, null, 100])
})

test('empty input has four lifts and sixteen missing values, displayed as hyphens', () => {
  const rows = repRecordRows()
  assert.equal(rows.length, 4)
  assert.ok(rows.every(row => row.records.every(r => r.weight === null && r.day === null)))
  const tree = renderRepRecords(createElement, { enabled: true, logs: [] })
  assert.equal(nodes(tree, n => n.type === 'table').length, 4)
  assert.equal(nodes(tree, n => n.type === 'td' && text(n) === '-').length, 32)
  assert.equal(nodes(tree, n => n.type === 'time').length, 0)
})

test('ties pick the first Danish day independent of row ordering and timestamp offsets', () => {
  const logs = [log(1, 150, 'Squat', '2026-10-21T00:30:00+02:00'), log(1, 150, 'Squat', '2026-10-19T23:30:00Z'), log(1, 149, 'Squat', '2026-01-01')]
  assert.equal(record(logs).day, '2026-10-20')
  assert.deepEqual(record(logs), record([...logs].reverse()))
})

test('main lift aliases and set suffixes normalize, variants remain separate', () => {
  const logs = [log(1, 100, 'Back squat - topsæt'), log(3, 90, 'Bench press (comp)'), log(5, 180, 'DL'), log(8, 160, 'Doedloeft (sumo)'),
    ...['Front squat', 'Pause bænkpres', 'Romanian deadlift', 'Goblet squat'].map(name => log(1, 999, name))]
  assert.deepEqual(repRecordRows({ logs }).map(r => r.records.map(x => x.weight)),
    [[100, null, null, null], [null, 90, null, null], [null, null, 180, null], [null, null, null, 160]])
})

test('all completed sets count including backoff and deload, skipped sets do not', () => {
  const logs = [log(5, 80, 'Squat - backoff'), log(5, 90, 'Squat', '2026-10-21', { exercises: { name: 'Squat', sessions: { weeks: { block_name: 'Deload' } } } }), log(5, 999, 'Squat', '2026-10-20', { skipped: true })]
  assert.equal(record(logs, 'Squat', 5).weight, 90)
})

test('invalid numbers, missing dates and impossible calendar dates do not become records', () => {
  const logs = [null, ...[null, '', ' ', false, -1, 0, Infinity, NaN, 'x'].map(w => log(1, w)),
    ...[null, '', false, 1.1, 0, -1, 9].map(r => log(r, 999)),
    ...['', 'bad', '2026-02-30', '2026-02-30T10:00:00Z'].map(d => log(1, 999, 'Squat', d))]
  assert.equal(record(logs).weight, null)
})

test('current local snapshot replaces stale server rows including edits, undo and pending sets', () => {
  const currentWeek = { sessions: [{ exercises: [{ id: 'active', name: 'Bench' }] }] }
  const logs = [log(3, 999, 'Bench', '2026-10-20', { exercise_id: 'active' }), log(3, 80, 'Bench', '2026-10-19', { exercise_id: 'past' })]
  const exerciseLogs = [log(3, 90, 'ignored', '2026-10-21', { exercise_id: 'active', pending: true }), log(3, 999, 'Bench', '2026-10-21', { exercise_id: 'other' })]
  const input = { logs, exerciseLogs, currentWeek }
  const before = JSON.stringify(input)
  assert.equal(repRecordRows(input)[1].records[1].weight, 90)
  assert.equal(repRecordRows({ ...input, exerciseLogs: [] })[1].records[1].weight, 80)
  assert.equal(repRecordRows({ ...input, exerciseLogs: [{ ...exerciseLogs[0], weight: 85 }] })[1].records[1].weight, 85)
  assert.equal(JSON.stringify(input), before)
})

test('flag is strict default OFF and loading or missing history never renders a false empty table', () => {
  assert.equal(DEFAULT_REP_RECORDS, false)
  for (const enabled of [undefined, false, 0, 1, 'true']) assert.equal(renderRepRecords(createElement, { enabled, logs: [] }), null)
  assert.equal(renderRepRecords(createElement, { enabled: true, logs: null }), null)
  assert.equal(renderRepRecords(createElement, { enabled: true, logs: [], loading: true }), null)
})

for (const [name, Component] of [['standard', FremgangTab], ['enkel', EnkelFremgangTab]]) {
  test(`${name} actual component flag, headings, dates and existing selection handler`, () => {
    const input = { ...props, fremgangLogs: [log(1, 100)], allWeeks: [{ sessions: [{ exercises: [{ name: 'Squat' }, { name: 'Bænkpres' }] }] }] }
    const app = mount(Component, input)
    const off = app.render()
    assert.equal(nodes(off, n => n.props['data-rep-records']).length, 0)
    const on = app.render({ ...input, repRecords: true })
    assert.equal(nodes(on, n => n.props['data-rep-records']).length, 1)
    assert.equal(nodes(on, n => n.type === 'th' && n.props.scope === 'col').length, 12)
    assert.equal(nodes(on, n => n.type === 'time' && n.props.dateTime === '2026-10-20').length, 1)
    button(on, 'Bænkpres').props.onClick()
    assert.match(text(app.render({ ...input, repRecords: true })), /Du har ikke logget denne øvelse/)
    button(app.render(input), 'Squat').props.onClick()
    assert.equal(JSON.stringify(app.render(input)), JSON.stringify(off))
  })
}

test('enkel records route shows table, strength route hides it and loading suppresses it', () => {
  const app = mount(EnkelFremgangTab, { ...props, repRecords: true, enkelDel: 'rekorder' })
  assert.equal(nodes(app.render(), n => n.type === 'table').length, 4)
  assert.equal(nodes(app.render({ ...props, repRecords: true, enkelDel: 'styrke' }), n => n.type === 'table').length, 0)
  assert.equal(nodes(app.render({ ...props, repRecords: true, enkelDel: 'rekorder', fremgangLoading: true }), n => n.type === 'table').length, 0)
})
