import test from 'node:test'
import assert from 'node:assert/strict'
import { weekText } from './weekText.mjs'

const date = '2026-11-03'
const row = (values = {}) => ({ date, meal: 'Synthetic meal',
  kcal: 2000, protein: 100, carb: 150, fat: 50, ...values })

test('week text: exact neutral text, Danish numbers, daily goals and logged-day denominator', () => {
  assert.equal(weekText([row(), row({ date: '2026-11-02', kcal: '2001,5', protein: '101,5' })],
    { kcal: '2500,5', protein: 150 }, date),
  'Kost 28.10.2026–03.11.2026: 2 af 7 dage logget. Gennemsnit pr. logget dag: energi 2.000,8 kcal; protein 100,8 g. Daglige mål: energi 2.500,5 kcal; protein 150 g.')
})

test('week text: sums meals on each date; ignores receipts and dates outside inclusive window', () => {
  const text = weekText([row(), row(), row({ date: '2026-10-28' }),
    row({ date: '2026-10-27', kcal: 9000 }), row({ date: '2026-11-04' }),
    row({ date: '2026-11-01', meal: '[appData2-day-v1][]' })], {}, date)
  assert.match(text, /2 af 7 dage logget/)
  assert.match(text, /energi 3.000 kcal; protein 150 g/)
})

test('week text: absent history and targets are explicit; invalid dates never claim a week', () => {
  for (const rows of [undefined, null, {}, [], [null, {}, row({ date: '2026-02-30' })]]) {
    assert.equal(weekText(rows, null, date),
      'Kost 28.10.2026–03.11.2026: 0 af 7 dage logget. Gennemsnit pr. logget dag: ingen loggede dage. Daglige mål: energi ikke angivet; protein ikke angivet.')
  }
  for (const bad of [undefined, null, '', 'bad', '2026-02-30', '2026-1-01', 0]) {
    assert.equal(weekText([row()], {}, bad), 'Kostuge: perioden er ukendt.')
  }
})

test('week text: unknown nutrients never turn into zero or an average of only the known days', () => {
  for (const key of ['kcal', 'protein', 'carb', 'fat']) {
    for (const bad of [undefined, null, '', -1, NaN, Infinity, 'bad', {}, [], true]) {
      const text = weekText([row({ [key]: bad }), row({ date: '2026-11-02' })], {}, date)
      assert.match(text, /2 af 7 dage logget/)
      assert.match(text, /energi ukendt; protein ukendt/)
    }
  }
  assert.match(weekText([row({ kcal: 0, protein: 0 })], {}, date), /energi 0 kcal; protein 0 g/)
  assert.match(weekText([row({ kcal: Number.MAX_VALUE }), row({ kcal: Number.MAX_VALUE })], {}, date), /energi ukendt/)
})

test('week text: goals are independent, positive numbers using snapshot keys only', () => {
  for (const bad of [undefined, null, '', 0, -1, NaN, Infinity, 'bad', {}, [], true]) {
    assert.match(weekText([], { kcal: bad, protein: bad }, date), /energi ikke angivet; protein ikke angivet/)
  }
  assert.match(weekText([], { kcal: 2000 }, date), /energi 2.000 kcal; protein ikke angivet/)
  assert.match(weekText([], { protein: '125,5' }, date), /energi ikke angivet; protein 125,5 g/)
  assert.match(weekText([], { kcal_target: 2000, protein_target: 100 }, date), /energi ikke angivet; protein ikke angivet/)
})

test('week text: deterministic calendar boundaries across year, leap day and DST', () => {
  for (const [end, first, label] of [
    ['2027-01-01', '2026-12-26', '26.12.2026–01.01.2027'],
    ['2028-03-01', '2028-02-24', '24.02.2028–01.03.2028'],
    ['2026-03-30', '2026-03-24', '24.03.2026–30.03.2026'],
    ['2026-10-26', '2026-10-20', '20.10.2026–26.10.2026'],
  ]) {
    const text = weekText([row({ date: first }), row({ date: end })], {}, end)
    assert.ok(text.startsWith(`Kost ${label}: 2 af 7 dage logget.`))
  }
})

test('week text: frozen snapshots unchanged and arbitrary identity/free text never interpolated', () => {
  const rows = Object.freeze([Object.freeze(row({ meal: 'DO_NOT_INCLUDE_ME', athlete_id: 'PRIVATE_ID', name: 'PRIVATE_NAME' }))])
  const targets = Object.freeze({ kcal: 2200, protein: 120, name: 'PRIVATE_TARGET' })
  const before = JSON.stringify({ rows, targets })
  const first = weekText(rows, targets, date)
  assert.equal(weekText(rows, targets, date), first)
  assert.equal(JSON.stringify({ rows, targets }), before)
  assert.doesNotMatch(first, /PRIVATE|DO_NOT_INCLUDE|undefined|NaN|Infinity/)
  assert.ok(first.length < 350)
})
