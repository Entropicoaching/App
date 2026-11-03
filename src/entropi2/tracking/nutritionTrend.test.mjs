import test from 'node:test'
import assert from 'node:assert/strict'
import { nutritionTrend } from './nutritionTrend.mjs'
import { createNutritionController } from '../nutrition/controller.mjs'

const date = '2026-11-03'
const goals = { kcal_target: 100, protein_target: 10 }
const row = (extra = {}) => ({ date, meal: 'Synthetic meal', kcal: 100, protein: 10, carb: 5, fat: 2, ...extra })
const trend = (rows, targets = goals, today = date) => nutritionTrend(rows, targets, today)
const seven = () => ['2026-10-01', '2026-10-03', '2026-10-10', '2026-10-19', '2026-10-27', '2026-11-01', date]
  .map((date, i) => row({ date, protein: i < 4 ? 7.99 : 10 }))

test('four calendar weeks, empty data and invalid dates are explicit', () => {
  for (const input of [[], null, undefined, {}]) {
    const result = trend(input)
    assert.deepEqual(result.days, [])
    assert.deepEqual(result.weeks.map(w => [w.weekStart, w.weekEnd]), [
      ['2026-10-12', '2026-10-18'], ['2026-10-19', '2026-10-25'],
      ['2026-10-26', '2026-11-01'], ['2026-11-02', '2026-11-08'],
    ])
    for (const w of result.weeks) {
      assert.equal(w.loggedDays, 0)
      assert.deepEqual(w.totals, { kcal: null, protein: null })
      assert.deepEqual(w.averages, { kcal: null, protein: null })
      assert.equal(w.proteinReachedDays, 0)
      assert.equal(w.proteinReachedShare, null)
    }
    assert.equal(result.signal, null)
  }
  for (const bad of [undefined, null, '', '2026-02-30', '2026-1-01', new Date(date), '0000-01-01', '9999-12-31']) {
    assert.deepEqual(nutritionTrend([], goals, bad), { days: [], weeks: [], recent: null, signal: null })
  }
})

test('daily and weekly sums, logged-day targets and exact reached share', () => {
  const result = trend([row(), row(), row({ date: '2026-11-02', kcal: 50, protein: 5 })])
  assert.deepEqual(result.days.map(d => d.totals), [{ kcal: 50, protein: 5 }, { kcal: 200, protein: 20 }])
  assert.deepEqual(result.days.map(d => d.reached), [{ kcal: false, protein: false }, { kcal: true, protein: true }])
  const w = result.weeks[3]
  assert.equal(w.loggedDays, 2)
  assert.deepEqual(w.totals, { kcal: 250, protein: 25 })
  assert.deepEqual(w.averages, { kcal: 125, protein: 12.5 })
  assert.deepEqual(w.targets, { kcal: 200, protein: 20 })
  assert.equal(w.proteinReachedDays, 1)
  assert.equal(w.proteinReachedShare, 0.5)
})

test('decimal comma, exponent and identical meals sum as integers before comparison', () => {
  const targets = { kcal_target: '60,6', protein_target: 0.3 }
  const r = trend(['10,1', '20.2', '3.03e1'].map((kcal, i) => row({ kcal, protein: i ? 0.1 : '1e-1' })), targets)
  assert.deepEqual(r.days[0].totals, { kcal: 60.6, protein: 0.3 })
  assert.deepEqual(r.days[0].reached, { kcal: true, protein: true })
  assert.equal(r.weeks[3].proteinReachedShare, 1)
  for (const protein of ['0.299999999999999999999', 0.3 - 5e-10]) {
    assert.equal(trend([row({ protein })], targets).days[0].reached.protein, false)
  }
})

test('signal uses four of seven logged days including history before the four-week window', () => {
  const r = trend(seven())
  assert.equal(r.days.length, 4)
  assert.equal(r.recent.loggedDays, 7)
  assert.equal(r.recent.belowProtein80Days, 4)
  assert.equal(r.signal, 'lavt protein')
  assert.equal(trend(seven().reverse()).signal, 'lavt protein')
  assert.equal(trend([...seven(), row(), row()]).recent.loggedDays, 7)
  assert.equal(trend(seven().slice(1)).signal, null)
  assert.equal(trend(seven().map(r => ({ ...r, protein: 0 }))).signal, 'lavt protein')
})

test('strict 80 percent boundary and only the latest seven dates count', () => {
  for (const protein of [8, '8.000000000000000001']) {
    const rows = seven(); rows[0] = { ...rows[0], protein }
    assert.equal(trend(rows).recent.belowProtein80Days, 3)
    assert.equal(trend(rows).signal, null)
  }
  const rows = seven(); rows[0].protein = '7.999999999999999999'
  assert.equal(trend(rows).signal, 'lavt protein')
  const r = trend([...seven(), row({ date: '2026-11-02' })])
  assert.equal(r.recent.belowProtein80Days, 3)
  assert.equal(r.signal, null)
})

test('missing and invalid goals preserve totals and suppress only their comparisons', () => {
  for (const bad of [null, undefined, '', 0, -1, NaN, Infinity, {}, [], true, 'bad', '1e-325']) {
    const r = trend(seven(), { kcal_target: 100, protein_target: bad })
    assert.equal(r.signal, null)
    assert.equal(r.days.at(-1).totals.protein, 10)
    assert.equal(r.days.at(-1).reached.protein, null)
    assert.equal(r.days.at(-1).reached.kcal, true)
    assert.equal(r.weeks[3].proteinReachedShare, null)
  }
  for (const targets of [null, undefined, {}]) {
    const r = nutritionTrend([row()], targets, date)
    assert.deepEqual(r.days[0].targets, { kcal: null, protein: null })
    assert.equal(r.signal, null)
  }
  assert.equal(trend(seven(), { protein_target: 10 }).signal, 'lavt protein')
})

test('receipts, malformed and future dates do not count; boundary dates partition weeks', () => {
  const rows = ['2026-10-11', '2026-10-12', '2026-10-18', '2026-10-19', '2026-10-25', '2026-10-26', '2026-11-01', '2026-11-02', date, '2026-11-04']
    .map(date => row({ date }))
  rows.push(null, {}, row({ date: '2026-02-30' }), row({ date: date + 'T00:00:00Z' }), row({ meal: '[appData2-day-v1][]' }))
  const r = trend(rows)
  assert.deepEqual(r.weeks.map(w => w.loggedDays), [2, 2, 2, 2])
  assert.equal(r.days.length, 8)
  assert.equal(r.recent.dates.at(-1), date)
})

test('invalid meals remain unknown, never zero or a low-protein signal', () => {
  for (const key of ['meal', 'kcal', 'protein', 'carb', 'fat']) {
    for (const bad of [null, undefined, '', {}, true]) {
      const rows = seven(); rows[6] = { ...rows[6], [key]: bad }
      const r = trend(rows)
      assert.equal(r.days.at(-1).totals.protein, null)
      assert.equal(r.weeks[3].proteinReachedShare, null)
      assert.equal(r.signal, null)
      assert.equal(r.recent.belowProtein80Days, null)
      assert.equal(r.weeks[1].loggedDays, 1)
      assert.equal(r.weeks[1].totals.protein, 7.99)
    }
  }
  assert.equal(trend([row({ meal: '  [appData2-day-v1][]' })]).days[0].totals.kcal, null)
  const zero = trend([row({ kcal: 0, protein: 0 })])
  assert.equal(zero.weeks[3].loggedDays, 1)
  assert.equal(zero.days[0].belowProtein80, true)
})

test('calendar weeks handle year, leap day and DST independently of local timezone', () => {
  for (const [sunday, monday] of [['2027-01-03', '2027-01-04'], ['2028-03-05', '2028-03-06'], ['2026-03-29', '2026-03-30'], ['2026-10-25', '2026-10-26']]) {
    const rows = [row({ date: sunday }), row({ date: monday })]
    assert.equal(trend(rows, goals, sunday).weeks[3].weekEnd, sunday)
    const r = trend(rows, goals, monday)
    assert.equal(r.weeks[3].weekStart, monday)
    assert.equal(r.weeks[2].loggedDays, 1)
    assert.equal(r.weeks[3].loggedDays, 1)
  }
  assert.equal(trend([row({ date: '2028-02-29' })], goals, '2028-03-01').days.length, 1)
})

test('integer decisions survive output overflow and retain subnormal precision', () => {
  const r = trend([row({ protein: Number.MAX_VALUE }), row({ protein: Number.MAX_VALUE })], { protein_target: Number.MAX_VALUE })
  assert.equal(r.days[0].totals.protein, null)
  assert.equal(r.days[0].reached.protein, true)
  assert.equal(r.weeks[3].proteinReachedShare, 1)
  const across = trend([row({ protein: Number.MAX_VALUE }), row({ date: '2026-11-02', protein: Number.MAX_VALUE })])
  assert.equal(across.weeks[3].averages.protein, Number.MAX_VALUE)
  assert.equal(across.weeks[3].totals.protein, null)
  assert.equal(trend([row({ protein: Number.MIN_VALUE })], { protein_target: Number.MIN_VALUE }).days[0].totals.protein, Number.MIN_VALUE)
  assert.equal(trend([row({ protein: '1e-325' })]).days[0].totals.protein, null)
})

test('inputs stay immutable and each result is independent and JSON serializable', () => {
  const rows = Object.freeze(seven().map(Object.freeze)), targets = Object.freeze({ ...goals })
  const first = trend(rows, targets), expected = structuredClone(first)
  assert.doesNotThrow(() => JSON.stringify(first))
  first.days[0].totals.protein = 99; first.recent.dates.pop(); first.weeks.pop()
  assert.deepEqual(trend(rows, targets), expected)
})

test('actual copied controller supplies synthetic snapshot; OFF remains inert', async () => {
  let loads = 0
  const athlete = { id: 'synthetic-trend', kcal_target: '0,3', protein_target: '0,3' }
  const contracts = { async load() { loads++; return [0.1, 0.2].map(n => row({ athlete_id: athlete.id, kcal: n, protein: n })) } }
  for (const enabled of [false, true]) {
    const controller = createNutritionController({ enabled, athlete, date, contracts })
    if (!enabled) {
      assert.equal(controller, null)
      assert.equal(loads, 0)
      continue
    }
    try {
      await controller.load()
      const snapshot = controller.snapshot()
      const r = trend(snapshot.historyRows, athlete, snapshot.date)
      assert.equal(loads, enabled ? 1 : 0)
      assert.equal(r.days.length, enabled ? 1 : 0)
      if (enabled) assert.equal(r.weeks[3].proteinReachedShare, 1)
    } finally { controller.dispose() }
  }
})
