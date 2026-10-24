import test from 'node:test'
import assert from 'node:assert/strict'
import { findDagensPas } from './nextSet.js'
import { summarizeKostWeek } from './athlete/kostUge.mjs'

test('APP-PERF2 pas bevarer dubletter, typer, skipped og de oprindelige referencer', () => {
  const ex = { id: 'e', sets: 2 }
  const week = { id: 'w', sessions: [{ exercises: [ex] }] }
  const logs = [{ exercise_id: 'e', set_number: 1, skipped: true },
    { exercise_id: 'e', set_number: 1 }, { exercise_id: 'e', set_number: '2' },
    { exercise_id: 'anden', set_number: 2 }]
  const before = structuredClone({ week, logs })
  const result = findDagensPas([week], week, logs)
  assert.equal(result.session, week.sessions[0])
  assert.equal(result.next.exercise, ex)
  assert.equal(result.next.setNumber, 2)
  assert.deepEqual({ week, logs }, before)
  logs.push({ exercise_id: 'e', set_number: 2 })
  assert.deepEqual(findDagensPas([week], week, logs), { status: 'done', upcoming: null })
  logs.pop()
  assert.equal(findDagensPas([week], week, logs).next.setNumber, 2)
})

test('APP-PERF2 pas bevarer streng id og NaN sammenligning samt manglende uge', () => {
  for (const id of [NaN, '1', 1, undefined, null, '__proto__']) {
    const week = { id: 'w', sessions: [{ exercises: [{ id, sets: 1 }] }] }
    const logs = [{ exercise_id: id, set_number: 1 }]
    assert.equal(findDagensPas([week], week, logs).status, Number.isNaN(id) ? 'open' : 'done')
  }
  assert.equal(findDagensPas([], null, null), null)
})

test('APP-PERF2 kost validerer og genlaeser gentagne datoer ved hvert kald', () => {
  const input = { selectedDate: '2026-10-14', asOfDate: '2026-10-18',
    coveredDates: ['2026-10-14'], targetHistory: [],
    logs: Array.from({ length: 500 }, () => ({ date: '2026-10-14', kcal: 0.5, protein: 0 })) }
  const before = structuredClone(input)
  assert.equal(summarizeKostWeek(input).days[2].totals.kcal, 250)
  assert.deepEqual(input, before)
  input.logs[499].kcal = 10
  assert.equal(summarizeKostWeek(input).days[2].totals.kcal, 259.5)
  input.logs[499].date = '2026-02-30'
  assert.throws(() => summarizeKostWeek(input), TypeError)
  input.logs[499].date = '2026-10-14'
  input.logs[0].kcal = Number.MAX_VALUE
  input.logs[1].kcal = Number.MAX_VALUE
  assert.throws(() => summarizeKostWeek(input), RangeError)
})

test('APP-PERF2 huller i loglisten bevarer den oprindelige find fejl', () => {
  const week = { id: 'w', sessions: [{ exercises: [{ id: 'e', sets: 1 }] }] }
  assert.throws(() => findDagensPas([week], week, new Array(1)), TypeError)
  const logs = [{ exercise_id: 'e', set_number: 1 }, , ]
  assert.equal(findDagensPas([week], week, logs).status, 'done')
})

test('R1-APP-PERF2 nul total bevarer foerste fejl ved hul foer null', () => {
  const week = { id: 'w', sessions: [{ exercises: [
    { id: 'e', sets: 1 }, { id: 'negative', sets: -1 }
  ] }] }
  assert.throws(() => findDagensPas([week], week, [, null]), {
    name: 'TypeError', message: "Cannot read properties of undefined (reading 'exercise_id')"
  })
})
