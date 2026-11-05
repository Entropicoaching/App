import test from 'node:test'
import assert from 'node:assert/strict'
import { buildActivePlanNutritionReport as build } from './nutritionReport.mjs'
import { nutritionReportView } from './reportView.mjs'
import { createElement, expand, nodes, text } from './viewFixture.mjs'
import { meal, athleteId, targets } from './reportFixture.mjs'

const date = '2026-11-05'
const plan = () => ({ id: 'synthetic-plan', revision: 'synthetic-version', athlete_id: athleteId,
  date, active: true, targets: { ...targets }, meals: [{ id: 'synthetic-meal' }] })
const input = patch => ({ enabled: true, athleteId, date, activePlan: plan(),
  mealLogs: [meal('2026-10-30', 'first'), meal(date, 'last', { kcal: 2500, protein: null, carb: undefined, fat: undefined })], ...patch })

test('active-plan report uses seven calendar days across month/week boundaries and only logged-day targets', () => {
  const report = build(input())
  assert.deepEqual([report.from, report.through, report.date], ['2026-10-30', date, date])
  assert.deepEqual(report.days.map(d => d.date), ['2026-10-30', '2026-10-31', '2026-11-01',
    '2026-11-02', '2026-11-03', '2026-11-04', date])
  assert.equal(report.comparison, 'active-plan'); assert.equal(report.planRevision, 'synthetic-version')
  assert.ok(report.days.every(d => !d.future && d.planId === 'synthetic-plan'))
  assert.deepEqual(report.week.metrics.kcal, { actual: 3500, target: 4000, percent: 87.5 })
  assert.deepEqual([report.week.loggedDays, report.week.missingDays], [2, 5])
  assert.equal(report.week.metrics.protein.actual, null)
  assert.equal(report.week.metrics.carb.actual, null); assert.equal(report.week.metrics.fat.actual, null)
  assert.equal(report.days[1].totals.kcal, null)
})

test('active report presentation names its reference honestly, keeps days folded and avoids duplicate weight', () => {
  const tree = expand(nutritionReportView(createElement, { enabled: true, report: build(input()) }))
  assert.match(text(tree), /Seneste 7 dage|Periodens kost|Den aktive plans dagsmål er reference/)
  assert.match(text(tree), /Tidligere planmål er ikke med/)
  assert.match(text(tree), /Ukendt registreret/)
  assert.doesNotMatch(text(tree), /Ugens kost|dage med entydig aktiveret plan|Vægttrend/)
  assert.ok(nodes(tree).filter(n => n.type === 'details').every(n => !n.props.open))
  assert.equal(nodes(tree).filter(n => n.type === 'time').length, 7)
})

test('zero intake is known, unknown targets never create percentages, and no extra data is read', () => {
  const activePlan = plan(); activePlan.targets = { kcal: 0, protein: null, carb: 250, fat: 60 }
  const report = build({ ...input({ activePlan, mealLogs: [meal(date, 'zero', { kcal: 0, protein: 0, carb: 0, fat: 0 })] }),
    get plans() { throw Error('No invented history') }, get weightLogs() { throw Error('No duplicate weights') } })
  assert.equal(report.week.metrics.kcal.actual, 0); assert.equal(report.week.metrics.kcal.percent, null)
  assert.equal(report.week.metrics.protein.target, null); assert.equal(report.week.metrics.carb.percent, 0)
})

test('OFF and absent active plan hide; malformed, stale and foreign active plans fail closed', () => {
  for (const enabled of [undefined, false, 1, 'true']) assert.equal(build({ enabled,
    get activePlan() { throw Error('OFF') } }), null)
  assert.equal(build(input({ activePlan: null })), null)
  for (const patch of [{ active: false }, { athlete_id: 'foreign' }, { date: '2026-11-04' },
    { revision: '' }, { meals: [] }, { targets: { ...targets, kcal: Infinity } }, { targets: { ...targets, protein: undefined } }]) {
    assert.throws(() => build(input({ activePlan: { ...plan(), ...patch } })), /Ugyldig aktiv plan/)
  }
  assert.throws(() => build(input({ date: '2026-02-30', activePlan: { ...plan(), date: '2026-02-30' } })), /gyldig rapportdato/)
  assert.throws(() => build(input({ date: '1900-01-01', activePlan: { ...plan(), date: '1900-01-01' } })), /datointervallet/)
})

test('foreign/outside/future meals and whitespace-prefixed day receipts cannot change actual totals', () => {
  const source = input(), original = structuredClone(source)
  const report = build({ ...source, mealLogs: [...source.mealLogs,
    meal('2026-10-29', 'old'), meal('2026-11-06', 'future'),
    meal(date, 'foreign', { athlete_id: 'foreign' }), meal(date, 'receipt', { meal: '  [appData2-day-v1][]' })] })
  assert.deepEqual(report, build(original)); assert.deepEqual(source, original)
  assert.throws(() => build(input({ mealLogs: [meal(date, 'same'), meal(date, 'same')] })), /gentagne/)
  const leap = build(input({ date: '2024-03-01', activePlan: { ...plan(), date: '2024-03-01' }, mealLogs: [] }))
  assert.equal(leap.from, '2024-02-24'); assert.equal(leap.days[5].date, '2024-02-29')
})
