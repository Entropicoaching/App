import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { install } from './repRecordsLoader.mjs'
import { createElement, nodes, text } from './repRecordsDom.mjs'
install()
const { repRecordRows, renderRepRecords } = await import('./repRecords.mjs')
const set = (name, reps, weight, logged_at) => ({ exercises: { name }, reps_completed: reps, weight, logged_at })

test('counterexample: eight reps never fill the five rep record even at a higher weight', () => {
  const logs = [set('Squat', 8, 200, '2026-10-20'), set('Squat', 5, 100, '2026-10-21')]
  assert.deepEqual(repRecordRows({ logs })[0].records.map(r => r.weight), [null, null, 100, 200])
})

test('counterexample: equal weights and aliases produce identical full output in every permutation', () => {
  const logs = [set('Bench', 3, 80, '2026-10-21'), set('Baenkpres - top set', '3', '80,0', '2026-10-19T23:30:00Z'), set('Bænkpres', 3, 79, '2026-10-18')]
  const expected = repRecordRows({ logs })
  for (const permutation of [[0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]]) {
    assert.deepEqual(repRecordRows({ logs: permutation.map(i => logs[i]) }), expected)
  }
  assert.equal(expected[1].records[1].day, '2026-10-20')
})

test('counterexample: conventional and sumo cannot overwrite each other or absorb variants', () => {
  const logs = [set('Deadlift', 1, 200, '2026-10-20'), set('Deadlift - sumo', 1, 180, '2026-10-20'), set('Romanian deadlift', 1, 999, '2026-10-20')]
  assert.deepEqual(repRecordRows({ logs }).map(r => r.records[0].weight), [null, null, 200, 180])
})

test('counterexample: late UTC timestamps display Danish date and decimal kilograms', () => {
  const tree = renderRepRecords(createElement, { enabled: true, logs: [set('Squat', 1, '100,5', '2026-10-20T23:30:00Z')] })
  assert.match(text(tree), /100,5 kg/)
  const times = nodes(tree, n => n.type === 'time')
  assert.equal(times.length, 1)
  assert.equal(times[0].props.dateTime, '2026-10-21')
  assert.equal(text(times[0]), '21.10.2026')
})

test('counterexample: result mutation cannot poison the next calculation', () => {
  const input = { logs: [set('Squat', 1, 100, '2026-10-20')] }
  const result = repRecordRows(input)
  result[0].records[0].weight = 999
  assert.equal(repRecordRows(input)[0].records[0].weight, 100)
})

test('counterexample: unzoned or informal timestamps never depend on the host timezone', () => {
  const logs = ['2026-10-20T23:30:00', '10/20/2026', '2026-02-30T23:30:00Z']
    .map(day => set('Squat', 1, 999, day))
  assert.equal(repRecordRows({ logs })[0].records[0].weight, null)
})

test('exact final AthleteView forwards strict flag through both lazy component props branches', () => {
  const flat = new URL('./AthleteView.jsx', import.meta.url)
  const source = readFileSync(existsSync(flat) ? flat : new URL('../AthleteView.jsx', import.meta.url), 'utf8')
  assert.match(source, /repRecords\s*=\s*false/)
  assert.equal((source.match(/repRecords:\s*repRecords\s*===\s*true/g) || []).length, 2)
})
