import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
const path = existsSync(new URL('./kostUge.mjs', import.meta.url)) ? './kostUge.mjs' : './input-185-182-kostUge.mjs'
const { summarizeKostWeek } = await import(path)
const input = (date = '2026-03-29', logs = []) => ({ selectedDate: date, asOfDate: date, coveredDates: [date], logs, targetHistory: [] })
const row = (date, kcal, protein = 0) => ({ date, kcal, protein })

test('APP-TEST6: tom kostuge holder ukendt adskilt fra nul', () => {
  const i = input(), before = JSON.stringify(i), s = summarizeKostWeek(i)
  assert.equal(s.days[6].status, 'missing')
  assert.equal(s.days[6].totals.kcal, null)
  assert.equal(s.metrics.kcal.average, null)
  i.logs.push(row(i.selectedDate, 0))
  const zero = summarizeKostWeek(i)
  assert.equal(zero.days[6].status, 'logged')
  assert.equal(zero.metrics.kcal.average, 0)
  assert.equal(JSON.stringify(input()), before)
})
test('APP-TEST6: begge DST uger har syv entydige kalenderdatoer', () => {
  for (const [date, start, end] of [['2026-03-29', '2026-03-23', '2026-03-29'], ['2026-10-25', '2026-10-19', '2026-10-25']]) {
    const s = summarizeKostWeek(input(date, [row(date, 123.5, 12.5)]))
    assert.equal(s.startDate, start); assert.equal(s.endDate, end)
    assert.equal(new Set(s.days.map(d => d.date)).size, 7)
    assert.equal(s.days[6].totals.kcal, 123.5)
    for (let n = 1; n < 7; n++) assert.equal(Date.parse(s.days[n].date) - Date.parse(s.days[n - 1].date), 86400000)
  }
})
test('APP-TEST6: negative og ugyldige vaerdier bliver ukendt pr makro', () => {
  for (const value of [-1, NaN, Infinity, -Infinity, '12,5', '12.5', null, undefined]) {
    const i = input(); i.logs = [row(i.selectedDate, value, 5)]
    const s = summarizeKostWeek(i)
    assert.equal(s.days[6].totals.kcal, null)
    assert.equal(s.days[6].totals.protein, 5)
  }
})
test('APP-TEST6: uge beholder decimaler og runder foerst ved visningsgraensen', () => {
  const i = input(); i.logs = [row(i.selectedDate, 12.25, 1.25), row(i.selectedDate, 12.25, 1.25)]
  const s = summarizeKostWeek(i)
  assert.deepEqual(s.days[6].totals, { kcal: 24.5, protein: 2.5 })
  assert.equal(s.metrics.kcal.average, 24.5)
  assert.equal(Math.round(s.metrics.kcal.average), 25)
  assert.equal(Math.round(s.days[6].totals.kcal), 25)
})
test('APP-TEST6: store endelige ugetal accepteres og overloeb afvises', () => {
  const i = input(); i.logs = [row(i.selectedDate, 1e100), row(i.selectedDate, 1e100)]
  assert.equal(summarizeKostWeek(i).metrics.kcal.average, 2e100)
  i.logs = [row(i.selectedDate, Number.MAX_VALUE), row(i.selectedDate, Number.MAX_VALUE)]
  assert.throws(() => summarizeKostWeek(i), RangeError)
})
test('APP-TEST6: sammenligningsgrundlag og input bevares ved datoskift', () => {
  const i = input('2026-10-25', [row('2026-10-25', 100), row('2026-10-19', 200)])
  i.coveredDates.push('2026-10-19')
  i.targetHistory = [{ effectiveFrom: '2026-10-19', kcal: 150, protein: 0 }, { effectiveFrom: '2026-10-25', kcal: 0, protein: null }]
  const before = JSON.stringify(i), s = summarizeKostWeek(i)
  assert.equal(JSON.stringify(i), before)
  assert.deepEqual(s.metrics.kcal.comparison, { days: 2, intakeAverage: 150, targetAverage: 75, difference: 75 })
  assert.equal(s.days[6].targets.kcal, 0)
  assert.equal(s.days[6].targets.protein, null)
})
