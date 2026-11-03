import test from 'node:test'
import assert from 'node:assert/strict'
import { weeklyTrend } from './weeklyTrend.mjs'
import { createNutritionController } from './controller.mjs'

const date = '2026-11-03'
const row = (extra = {}) => ({ date, meal: 'Synthetic meal', kcal: 100, protein: 10, carb: 5, fat: 2, ...extra })
const latest = (rows, goals, today = date) => weeklyTrend(rows, goals, today)[3]

test('weekly trend: four empty calendar weeks, no means and known zero counts', () => {
  for (const rows of [[], null, undefined, {}]) {
    const weeks = weeklyTrend(rows, { kcal: 100, protein: 10 }, date)
    assert.deepEqual(weeks.map(w => [w.weekStart, w.weekEnd]), [
      ['2026-10-12', '2026-10-18'], ['2026-10-19', '2026-10-25'],
      ['2026-10-26', '2026-11-01'], ['2026-11-02', '2026-11-08'],
    ])
    for (const w of weeks) {
      assert.equal(w.loggedDays, 0)
      assert.deepEqual(w.averages, { kcal: null, protein: null })
      assert.deepEqual(w.reached, { kcal: 0, protein: 0 })
    }
  }
})

test('weekly trend: daily sums then average by logged dates, duplicate meals preserved', () => {
  const w = latest([row(), row(), row({ date: '2026-11-02', kcal: 400, protein: 60 })], { kcal: 250, protein: 20 })
  assert.equal(w.loggedDays, 2)
  assert.deepEqual(w.averages, { kcal: 300, protein: 40 })
  assert.deepEqual(w.reached, { kcal: 1, protein: 2 })
})

test('weekly trend: each of four weeks independent; excludes older and future meals', () => {
  const dates = ['2026-10-12', '2026-10-25', '2026-11-01', date]
  const rows = dates.map((date, i) => row({ date, kcal: i + 1 }))
  const weeks = weeklyTrend([...rows, row({ date: '2026-10-11' }), row({ date: '2026-11-04' })], { kcal: 3 }, date)
  assert.deepEqual(weeks.map(w => w.loggedDays), [1, 1, 1, 1])
  assert.deepEqual(weeks.map(w => w.averages.kcal), [1, 2, 3, 4])
  assert.deepEqual(weeks.map(w => w.reached.kcal), [0, 0, 1, 1])
})

test('weekly trend: exact decimal sums, comma, dot, exponent and target equality', () => {
  const rows = ['10,1', '20.2', '3.03e1'].map(n => row({ kcal: n, protein: n }))
  const w = latest(rows, { kcal: '60,6', protein: 60.6 })
  assert.deepEqual(w.averages, { kcal: 60.6, protein: 60.6 })
  assert.deepEqual(w.reached, { kcal: 1, protein: 1 })
  assert.deepEqual(latest([row({ kcal: '.1', protein: 0.1 }), row({ kcal: '.2', protein: 0.2 })],
    { kcal: 0.3, protein: '3e-1' }).reached, { kcal: 1, protein: 1 })
})

test('weekly trend: just below target never promoted by an epsilon or display rounding', () => {
  for (const n of [149.99, 150 - 5e-10, '149.999999999999999999']) {
    assert.deepEqual(latest([row({ kcal: n, protein: n })], { kcal: 150, protein: 150 }).reached,
      { kcal: 0, protein: 0 })
  }
  assert.equal(latest([row({ protein: '0.299999999999999999' })], { protein: '0.3' }).reached.protein, 0)
})

test('weekly trend: missing, zero, negative and invalid targets are independently unknown', () => {
  for (const goals of [undefined, null, {}]) {
    assert.deepEqual(latest([row()], goals).reached, { kcal: null, protein: null })
  }
  for (const bad of [undefined, null, '', 0, '0', -1, 'bad', NaN, Infinity, {}, [], true]) {
    assert.deepEqual(latest([row()], { kcal: bad, protein: 10 }).reached, { kcal: null, protein: 1 })
    assert.deepEqual(latest([row()], { kcal: 100, protein: bad }).reached, { kcal: 1, protein: null })
  }
})

test('weekly trend: receipts never create days; malformed calendar dates ignored', () => {
  const rows = [null, {}, row({ meal: '[appData2-day-v1][]', protein: null }),
    ...['2026-02-30', '2026-1-01', '', '2026-11-03T00:00:00Z'].map(date => row({ date }))]
  assert.equal(latest(rows).loggedDays, 0)
  assert.equal(latest([...rows, row()]).loggedDays, 1)
  for (const bad of [null, undefined, '', '2026-02-30', new Date(date)]) assert.deepEqual(weeklyTrend([], {}, bad), [])
})

test('weekly trend: invalid meal data makes only its week unknown, counts remain truthful', () => {
  for (const key of ['meal', 'kcal', 'protein', 'carb', 'fat']) {
    for (const bad of [null, undefined, '', true, {}, []]) {
      const rows = [row(), row({ [key]: bad }), row({ date: '2026-11-01' })]
      const weeks = weeklyTrend(rows, { kcal: 1, protein: 1 }, date)
      assert.deepEqual(weeks[3].averages, { kcal: null, protein: null })
      assert.deepEqual(weeks[3].reached, { kcal: null, protein: null })
      assert.equal(weeks[3].loggedDays, 1)
      assert.deepEqual(weeks[2].averages, { kcal: 100, protein: 10 })
      assert.deepEqual(weeklyTrend([...rows].reverse(), { kcal: 1, protein: 1 }, date), weeks)
    }
  }
  for (const bad of [-1, Infinity, NaN, 'bad', '  [appData2-day-v1][]']) {
    assert.equal(latest([row({ [typeof bad === 'string' && bad.startsWith('  ') ? 'meal' : 'protein']: bad })]).averages.kcal, null)
  }
})

test('weekly trend: known zero meal is a logged day, no unlogged-day dilution', () => {
  const w = latest([row({ kcal: 0, protein: 0 })], { kcal: 1, protein: 1 })
  assert.equal(w.loggedDays, 1)
  assert.deepEqual(w.averages, { kcal: 0, protein: 0 })
  assert.deepEqual(w.reached, { kcal: 0, protein: 0 })
})

test('weekly trend: Sunday to Monday moves windows across year, leap day and DST', () => {
  for (const [sunday, monday] of [['2027-01-03', '2027-01-04'], ['2028-03-05', '2028-03-06'], ['2026-03-29', '2026-03-30'], ['2026-10-25', '2026-10-26']]) {
    const rows = [row({ date: sunday }), row({ date: monday })]
    const before = weeklyTrend(rows, {}, sunday), after = weeklyTrend(rows, {}, monday)
    assert.equal(before[3].weekEnd, sunday)
    assert.equal(after[3].weekStart, monday)
    assert.equal(after[2].weekStart, before[3].weekStart)
    assert.equal(before[3].loggedDays, 1)
    assert.equal(after[2].loggedDays, 1)
    assert.equal(after[3].loggedDays, 1)
  }
  assert.equal(latest([row({ date: '2028-02-29' })], {}, '2028-03-01').loggedDays, 1)
})

test('weekly trend: integer sums avoid overflow before finite mean; output overflow unknown', () => {
  const rows = [date, '2026-11-02'].map(date => row({ date, kcal: Number.MAX_VALUE }))
  assert.equal(latest(rows, { kcal: Number.MAX_VALUE }).averages.kcal, Number.MAX_VALUE)
  assert.equal(latest(rows, { kcal: Number.MAX_VALUE }).reached.kcal, 2)
  assert.equal(latest([row({ kcal: Number.MAX_VALUE }), row({ kcal: Number.MAX_VALUE })]).averages.kcal, null)
  assert.equal(latest([row({ protein: Number.MIN_VALUE })], { protein: Number.MIN_VALUE }).averages.protein, Number.MIN_VALUE)
  assert.equal(latest([row({ protein: Number.MIN_VALUE })], { protein: Number.MIN_VALUE }).reached.protein, 1)
  assert.equal(latest([row({ protein: '1e-325' })]).averages.protein, null)
  assert.equal(latest([row({ protein: '0e999999' })]).averages.protein, 0)
})

test('weekly trend: immutable inputs, deterministic output, no shared returned objects', () => {
  const rows = Object.freeze([Object.freeze(row()), Object.freeze(row({ date: '2026-11-02' }))])
  const goals = Object.freeze({ kcal: 100, protein: 10 })
  const first = weeklyTrend(rows, goals, date), expected = structuredClone(first)
  first[3].averages.kcal = 999; first[3].reached.protein = 999; first.pop()
  assert.deepEqual(weeklyTrend(rows, goals, date), expected)
})

test('weekly trend: imports and consumes actual controller snapshot, without wiring or writes', async () => {
  let loads = 0
  const controller = createNutritionController({ enabled: true, date,
    athlete: { id: 'synthetic-weekly', kcal_target: '0,3', protein_target: '0,3' },
    contracts: { async load() { loads++; return [0.1, 0.2].map(n => row({ athlete_id: 'synthetic-weekly', kcal: n, protein: n })) } },
  })
  try {
    await controller.load()
    const s = controller.snapshot()
    const w = latest(s.historyRows, s.targets, s.date)
    assert.deepEqual(w.averages, { kcal: 0.3, protein: 0.3 })
    assert.deepEqual(w.reached, { kcal: 1, protein: 1 })
    assert.equal(loads, 1)
  } finally { controller.dispose() }
})
