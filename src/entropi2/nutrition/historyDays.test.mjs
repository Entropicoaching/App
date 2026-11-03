import test from 'node:test'
import assert from 'node:assert/strict'
import { historyDays } from './historyDays.mjs'

const date = '2026-11-03'
const row = (values = {}) => ({ date, meal: 'Synthetic meal', kcal: 100, protein: 10, carb: 5, fat: 2, ...values })
const day = (values = {}) => ({ date, count: 1, kcal: 100, protein: 10, reached: { kcal: null, protein: null }, ...values })

test('historyDays: empty and absent lists', () => {
  for (const rows of [[], undefined, null]) assert.deepEqual(historyDays(rows), [])
})

test('historyDays: one day, sums, count and independent goals', () => {
  assert.deepEqual(historyDays([row(), row()], { kcal: 200, protein: 21 }), [
    day({ count: 2, kcal: 200, protein: 20, reached: { kcal: true, protein: false } }),
  ])
})

test('historyDays: mixed dates grouped newest first across month and year boundaries', () => {
  const dates = ['2025-12-31', '2026-11-03', '2026-01-01', '2025-12-31']
  assert.deepEqual(historyDays(dates.map(date => row({ date }))), [
    day(), day({ date: '2026-01-01' }), day({ date: '2025-12-31', count: 2, kcal: 200, protein: 20 }),
  ])
})

test('historyDays: receipts excluded before counting, validation and day creation', () => {
  const receipt = row({ meal: '[appData2-day-v1][]', kcal: NaN, protein: null })
  assert.deepEqual(historyDays([receipt]), [])
  assert.deepEqual(historyDays([receipt, row(), { ...receipt, date: '2026-11-02' }]), [day()])
})

test('historyDays: invalid nutrient invalidates both sums only for its day', () => {
  for (const key of ['kcal', 'protein', 'carb', 'fat']) {
    for (const bad of [null, undefined, '', 'bad', -1, NaN, Infinity, -Infinity, {}, [], true]) {
      const invalid = row({ [key]: bad })
      for (const rows of [[invalid, row()], [row(), invalid]]) {
        assert.deepEqual(historyDays([...rows, row({ date: '2026-11-02' })], { kcal: 1, protein: 1 }), [
          day({ count: 2, kcal: null, protein: null }),
          day({ date: '2026-11-02', reached: { kcal: true, protein: true } }),
        ])
      }
    }
  }
})

test('historyDays: missing or blank meal names invalidate the day', () => {
  for (const meal of [null, undefined, '', '  ', 4]) {
    assert.deepEqual(historyDays([row({ meal })]), [day({ kcal: null, protein: null })])
  }
})

test('historyDays: comma decimal inputs and targets', () => {
  assert.deepEqual(historyDays([row({ kcal: '100,5', protein: '10,25' })], { kcal: '100,5', protein: '10,5' }), [
    day({ kcal: 100.5, protein: 10.25, reached: { kcal: true, protein: false } }),
  ])
})

test('historyDays: 10.1 + 20.2 + 30.3 reaches 60.6 with the fixed tolerance', () => {
  const result = historyDays(['10,1', '20,2', '30,3'].map(n => row({ kcal: n, protein: n })), { kcal: '60,6', protein: '60,6' })
  assert.equal(result[0].count, 3)
  assert.ok(Math.abs(result[0].protein - 60.6) < 1e-9)
  assert.deepEqual(result[0].reached, { kcal: true, protein: true })
})

test('historyDays: 149.99 does not reach 150; fixed tolerance boundary', () => {
  for (const value of [149.99, 150 - 2e-9]) {
    assert.deepEqual(historyDays([row({ kcal: value, protein: value })], { kcal: 150, protein: 150 })[0].reached,
      { kcal: false, protein: false })
  }
  assert.equal(historyDays([row({ protein: 150 - 5e-10 })], { protein: 150 })[0].reached.protein, true)
})

test('historyDays: missing, zero and invalid goals stay null; partial goals work', () => {
  for (const targets of [undefined, null, {}]) assert.deepEqual(historyDays([row()], targets), [day()])
  for (const bad of [undefined, null, '', 'bad', 0, '0', -1, NaN, Infinity, {}, [], true]) {
    assert.deepEqual(historyDays([row()], { kcal: bad, protein: bad }), [day()])
    assert.deepEqual(historyDays([row()], { kcal: 50, protein: bad })[0].reached, { kcal: true, protein: null })
    assert.deepEqual(historyDays([row()], { kcal: bad, protein: 50 })[0].reached, { kcal: null, protein: false })
  }
})

test('historyDays: known zero sums, exceeded goals and overflow', () => {
  assert.deepEqual(historyDays([row({ kcal: 0, protein: 0 })], { kcal: 1, protein: 1 }), [
    day({ kcal: 0, protein: 0, reached: { kcal: false, protein: false } }),
  ])
  assert.deepEqual(historyDays([row()], { kcal: 1, protein: 1 })[0].reached, { kcal: true, protein: true })
  for (const key of ['kcal', 'protein']) {
    assert.deepEqual(historyDays([row({ [key]: Number.MAX_VALUE }), row({ [key]: Number.MAX_VALUE })]), [
      day({ count: 2, kcal: null, protein: null }),
    ])
  }
})

test('historyDays: malformed dates outside snapshot contract are ignored', () => {
  assert.deepEqual(historyDays([null, undefined, {}, ...['', '2026-02-30', '2026-1-01', '2026-11-03T00:00:00Z'].map(date => row({ date }))]), [])
})

test('historyDays: frozen inputs unchanged and returned objects independent', () => {
  const rows = Object.freeze([Object.freeze(row({ date: '2026-11-02' })), Object.freeze(row())])
  const targets = Object.freeze({ kcal: 100, protein: 20 })
  const before = JSON.stringify({ rows, targets })
  const first = historyDays(rows, targets)
  first[0].count = 999
  first[0].reached.kcal = false
  assert.deepEqual(historyDays(rows, targets)[0], day({ reached: { kcal: true, protein: false } }))
  assert.equal(JSON.stringify({ rows, targets }), before)
})
