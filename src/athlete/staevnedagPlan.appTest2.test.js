import { test } from 'node:test'
import assert from 'node:assert/strict'
import { number, roundWeight, suggestSets, parseTime, setTime, timeLabel, correctSet, checklistState, meetPlan, finalizeDraft } from './staevnedagPlan.mjs'

test('APP-TEST2: decimal comma parses; booleans, exponent and empty strings are rejected', () => {
  assert.equal(number(' 102,5 '), 102.5); assert.equal(roundWeight('101,3'), 102.5)
  for (const x of [true, '', '1e2', '-2', NaN, Infinity, null]) assert.equal(number(x), null)
  for (const x of [0, -1, 1001]) assert.equal(roundWeight(x), null)
})
test('APP-TEST2: warmups stay on grid below opener with decreasing gaps and ordered times', () => {
  for (const opener of [20.1, 22.5, 25, 27.5, 40, 100, 102.3, 300, 1000]) {
    const rows = suggestSets(opener)
    assert.equal(rows[0].weight, 20); assert.ok(rows.length <= 5)
    for (const [i, r] of rows.entries()) {
      assert.equal(r.weight % 2.5, 0); assert.ok(r.weight < opener)
      if (i) { assert.ok(r.weight > rows[i - 1].weight); assert.ok(r.minutesBefore < rows[i - 1].minutesBefore) }
    }
    const gridOpener = Math.ceil(opener / 2.5) * 2.5
    const weights = [...rows.map(r => r.weight), gridOpener]
    const gaps = weights.slice(1).map((w, i) => w - weights[i])
    assert.ok(gaps.every((g, i) => !i || g <= gaps[i - 1]))
  }
})
test('APP-TEST2: no ramp is invented for invalid or bar-only opener', () => {
  for (const x of [null, '', 20, 19, 1001, Infinity]) assert.deepEqual(suggestSets(x), [])
})
test('APP-TEST2: time wraps to previous day with explicit day offset', () => {
  assert.equal(parseTime('23:59'), 1439)
  for (const x of ['24:00', '9:00', '00:60', null]) assert.equal(parseTime(x), null)
  assert.deepEqual(setTime('00:10', 25), { time: '23:45', dayOffset: -1 })
  assert.match(timeLabel('00:10', 25), /dagen før/)
  assert.equal(setTime('12:00', 0), null); assert.equal(setTime('12:00', 181), null)
})
test('APP-TEST2: corrections are atomic and do not mutate existing rows', () => {
  const rows = suggestSets(100), before = JSON.stringify(rows)
  const edited = correctSet(rows, 0, { weight: '22,5', reps: 3, minutesBefore: 24 }, 100)
  assert.equal(edited[0].weight, 22.5); assert.equal(edited[0].reps, 3)
  assert.equal(correctSet(rows, 0, { weight: 30, reps: 21 }, 100), rows)
  assert.equal(correctSet(rows, 0, { weight: 100 }, 100), rows)
  assert.equal(correctSet(rows, 0, { weight: 19.9 }, 100), rows)
  assert.equal(correctSet(rows, 0, { skipped: true }, 100).length, rows.length - 1)
  assert.equal(JSON.stringify(rows), before)
})
test('APP-TEST2: checklist accepts only known ids and booleans; meet type selects lifts', () => {
  const old = { weighin: false }
  assert.equal(checklistState(old, 'unknown', true), old)
  assert.equal(checklistState(old, 'weighin', 'true'), old)
  assert.deepEqual(checklistState(old, 'weighin', true), { weighin: true })
  const attempts = { bench: [{ w: 100 }], squat: [{ w: 150 }], deadlift: [{ w: 200 }] }
  assert.deepEqual(meetPlan(attempts, 'sbd').map(x => x.key), ['squat', 'bench', 'deadlift'])
  assert.deepEqual(meetPlan(attempts, 'bench').map(x => x.key), ['bench'])
})
test('APP-TEST2: final draft validates every field and strictly descending minutes', () => {
  const rows = [{ weight: '20', reps: '5', minutesBefore: '25' }, { weight: '60', reps: '2', minutesBefore: '12' }]
  assert.equal(finalizeDraft(rows, 100).ok, true)
  for (const patch of [{ weight: 100 }, { reps: 0 }, { minutesBefore: 25 }]) {
    const bad = structuredClone(rows); Object.assign(bad[1], patch); assert.equal(finalizeDraft(bad, 100).ok, false)
  }
  assert.equal(finalizeDraft([{ weight: 20 }], 100).ok, false)
  assert.equal(finalizeDraft(rows, 20).ok, false)
})
