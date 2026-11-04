import test from 'node:test'
import assert from 'node:assert/strict'
import { transitionPlan } from '../plan.mjs'
import { buildNutritionReport as build, namespace } from './nutritionReport.mjs'
import { activePlan, athleteId, coach, deepFreeze, input, meal, targets } from './reportFixture.mjs'

test('OFF requires literal true and reads no other options', () => {
  for (const enabled of [false, undefined, null, 0, 1, 'true']) {
    const options = new Proxy({ enabled }, { get(target, key) {
      if (key !== 'enabled') throw Error('OFF read')
      return target.enabled
    } })
    assert.equal(build(options), null)
  }
  assert.equal(build(), null)
})

test('actual activated plan: four daily nutrients, uncapped percentages and weekly logged-day denominators', () => {
  const r = build(input())
  assert.equal(r.namespace, namespace)
  assert.equal(r.from, '2026-11-02'); assert.equal(r.through, '2026-11-08')
  assert.deepEqual(r.days[0].totals, { kcal: 1000, protein: 100, carb: 100, fat: 25 })
  assert.deepEqual(r.days[0].targets, targets)
  assert.equal(r.days[2].percentages.kcal, 125)
  assert.equal(r.days[2].percentages.protein, 120)
  assert.deepEqual(r.week.metrics.kcal, { actual: 3500, target: 4000, percent: 87.5 })
  assert.equal(r.week.metrics.protein.actual, 280)
  assert.equal(r.week.metrics.protein.target, 300)
  assert.equal(r.week.metrics.carb.actual, 320)
  assert.equal(r.week.metrics.carb.target, 500)
  assert.equal(r.week.metrics.fat.actual, 85)
  assert.equal(r.week.metrics.fat.target, 120)
  assert.deepEqual([r.week.elapsedDays, r.week.loggedDays, r.week.missingDays, r.week.plannedDays], [7, 2, 5, 7])
})

test('missing log is unknown, while a real zero meal is known zero', () => {
  const r = build(input({ mealLogs: [meal('2026-11-02', 'zero', { kcal: 0, protein: 0, carb: 0, fat: 0 })] }))
  assert.equal(r.days[0].logState, 'logged'); assert.equal(r.days[0].percentages.kcal, 0)
  assert.equal(r.days[1].logState, 'missing')
  assert.deepEqual(r.days[1].totals, { kcal: null, protein: null, carb: null, fat: null })
  assert.equal(r.week.metrics.kcal.actual, 0); assert.equal(r.week.metrics.kcal.target, 2000)
})

test('empty reads show no diet evidence, no plan and insufficient weight evidence', () => {
  const r = build(input({ plans: [], mealLogs: [], weightLogs: [] }))
  assert.equal(r.week.loggedDays, 0); assert.equal(r.week.missingDays, 7)
  assert.equal(r.week.plannedDays, 0); assert.equal(r.week.metrics.kcal.actual, null)
  assert.equal(r.week.metrics.kcal.target, null); assert.equal(r.week.metrics.kcal.percent, null)
  assert.ok(r.days.every(day => day.planState === 'none'))
  assert.equal(r.weight.average, null); assert.equal(r.weight.changeKg, null)
})

test('current week ends at explicit date; future logs, plans and measurements cannot enter summaries', () => {
  const r = build(input({ date: '2026-11-04' }))
  assert.deepEqual([r.week.elapsedDays, r.week.loggedDays, r.week.missingDays], [3, 2, 1])
  assert.ok(r.days.slice(3).every(day => day.future && day.logState === 'future' && day.targets.kcal === null))
  assert.equal(r.weight.days, 3); assert.ok(Math.abs(r.weight.average - (80 + 80 + 81) / 3) < 1e-10)
  const future = build(input({ plans: [activePlan({ on: '2026-11-09' })] }))
  assert.equal(future.week.plannedDays, 0)
})

test('archived plan and replacement retain each historical target with exclusive archive day', () => {
  const old = transitionPlan(activePlan(), { to: 'archived', actor: coach, on: '2026-11-04' })
  const replacement = activePlan({ id: 'replacement', on: '2026-11-04', dailyTargets: { ...targets, kcal: 2400 } })
  const r = build(input({ plans: [replacement, old] }))
  assert.equal(r.days[0].targets.kcal, 2000); assert.equal(r.days[1].targets.kcal, 2000)
  assert.equal(r.days[2].targets.kcal, 2400); assert.equal(r.days[2].planId, 'replacement')
  assert.equal(r.week.metrics.kcal.target, 4400)
  assert.equal(r.week.metrics.kcal.percent, 3500 / 4400 * 100)
  const sameDay = transitionPlan(activePlan(), { to: 'archived', actor: coach, on: '2026-11-01' })
  assert.equal(build(input({ plans: [sameDay] })).week.plannedDays, 0)
})

test('draft plans never count and overlapping activations are explicit conflicts', () => {
  const draft = { ...activePlan(), status: 'draft', activated: null }
  assert.equal(build(input({ plans: [draft] })).week.plannedDays, 0)
  const r = build(input({ plans: [activePlan(), activePlan({ id: 'overlap', on: '2026-11-04' })] }))
  assert.equal(r.week.conflictDays, 5); assert.equal(r.days[2].planState, 'conflict')
  assert.equal(r.days[2].totals.kcal, 2500); assert.equal(r.days[2].percentages.kcal, null)
  assert.equal(r.week.metrics.kcal.actual, 3500); assert.equal(r.week.metrics.kcal.target, null)
})

test('no plan on a logged day and missing/invalid goals suppress that weekly percentage', () => {
  const r = build(input({ plans: [activePlan({ on: '2026-11-04' })] }))
  assert.equal(r.days[0].planState, 'none'); assert.equal(r.week.metrics.kcal.percent, null)
  const p = activePlan(); p.dailyTargets = { kcal: 0, protein: null, carb: '', fat: '60,5' }
  const missing = build(input({ plans: [p] }))
  assert.equal(missing.days[0].targets.kcal, null)
  assert.equal(missing.week.metrics.protein.percent, null)
  assert.equal(missing.week.metrics.carb.target, null)
  assert.equal(missing.week.metrics.fat.target, 121)
})

test('unknown nutrients propagate individually to weekly total; other metrics stay available', () => {
  const r = build(input({ mealLogs: [meal('2026-11-02', 'a', { protein: null }), meal('2026-11-02', 'b')] }))
  assert.equal(r.days[0].logState, 'unknown'); assert.equal(r.week.unknownDays, 1)
  assert.equal(r.days[0].totals.kcal, 2000); assert.equal(r.days[0].totals.protein, null)
  assert.equal(r.week.metrics.protein.actual, null); assert.equal(r.week.metrics.protein.percent, null)
  assert.equal(r.week.metrics.kcal.percent, 100)
  for (const value of [undefined, '', -1, Infinity, NaN, true, 'abc']) {
    assert.equal(build(input({ mealLogs: [meal('2026-11-02', 'bad', { fat: value })] })).days[0].totals.fat, null)
  }
})

test('receipt-only days remain unlogged, while distinct identical meals both count', () => {
  const receipt = meal('2026-11-03', 'receipt', { meal: '  [appData2-day-v1][]', kcal: 9999 })
  const r = build(input({ mealLogs: [receipt, meal('2026-11-02', 'a'), meal('2026-11-02', 'b')] }))
  assert.equal(r.days[1].logState, 'missing'); assert.equal(r.days[0].mealCount, 2)
  assert.equal(r.week.metrics.kcal.actual, 2000)
  assert.throws(() => build(input({ mealLogs: [meal('2026-11-02', 'same'), meal('2026-11-04', 'same')] })), /gentagne/)
})

test('invalid meal identity or name is unknown evidence, never known zero or silently omitted', () => {
  for (const patch of [{ id: '' }, { meal: '' }, { meal: null }]) {
    const r = build(input({ mealLogs: [meal('2026-11-02', 'a', patch)] }))
    assert.equal(r.days[0].logState, 'unknown'); assert.equal(r.days[0].mealCount, 1)
    assert.equal(r.days[0].totals.kcal, null)
  }
})

test('foreign athlete, invalid date, out-of-week and future meal rows cannot contaminate a report', () => {
  const original = input(), foreign = { ...activePlan(), athleteId: 'other', dailyTargets: { kcal: 99999 } }
  const r = build({ ...original, plans: [...original.plans, foreign],
    mealLogs: [...original.mealLogs, meal('2026-11-02', 'foreign', { athlete_id: 'other', meal: '<private>', kcal: 99999 }),
      meal('2026-02-30', 'bad'), meal('2026-11-01', 'old'), meal('2026-11-09', 'future')],
    weightLogs: [...original.weightLogs, { athlete_id: 'other', logged_at: '2026-11-02', weight: 300 }] })
  assert.deepEqual(r, build(original)); assert.ok(!JSON.stringify(r).includes('<private>'))
})

test('existing weightTrend: measured-day averages and prior seven-day difference; latest valid correction wins', () => {
  const source = input(), r = build(source)
  assert.equal(r.weight.average, 81); assert.equal(r.weight.changeKg, 2)
  assert.equal(r.weight.days, 3); assert.equal(r.weight.previousDays, 3)
  assert.equal(r.weight.from, '2026-11-02'); assert.equal(r.weight.previousFrom, '2026-10-26')
  const corrected = build({ ...source, weightLogs: [...source.weightLogs,
    { athlete_id: athleteId, logged_at: '2026-11-02', weight: '83,0', created_at: '2026-11-03T10:00:00Z' },
    { athlete_id: athleteId, logged_at: '2026-11-09', weight: 200, created_at: '2026-11-09T10:00:00Z' }] })
  assert.equal(corrected.weight.average, 82); assert.equal(corrected.weight.changeKg, 3)
  assert.equal(corrected.weight.daily[0].kg, 83)
})

test('one or two weight days never masquerade as a trend; missing previous window suppresses change', () => {
  const source = input()
  const sparse = build({ ...source, weightLogs: source.weightLogs.slice(-2) })
  assert.equal(sparse.weight.average, null); assert.equal(sparse.weight.changeKg, null)
  const noPrevious = build({ ...source, weightLogs: source.weightLogs.slice(-3) })
  assert.equal(noPrevious.weight.average, 81); assert.equal(noPrevious.weight.changeKg, null)
})

test('strict read contract and lifecycle errors fail visibly instead of manufacturing empty evidence', () => {
  for (const patch of [{ athleteId: '' }, { date: '2026-02-30' }, { date: '0000-01-01' }, { date: '2026-11-04T12:00:00Z' },
    { date: '9999-12-25' }, { plans: null }, { mealLogs: undefined }, { weightLogs: {} }]) {
    assert.throws(() => build(input(patch)), TypeError)
  }
  for (const patch of [{ activated: null }, { schema: 'wrong' }, { status: 'wrong' },
    { activated: { by: 'other', on: '2026-11-01' } }, { createdOn: '2026-11-02' },
    { status: 'archived', archived: { by: coach.id, on: '2026-10-31' } },
    { archived: { by: coach.id, on: '2026-11-02' } }]) {
    assert.throws(() => build(input({ plans: [{ ...activePlan(), ...patch }] })), TypeError)
  }
  assert.throws(() => build(input({ plans: [activePlan(), activePlan()] })), TypeError)
})

test('UTC calendar arithmetic crosses year/leap boundaries and results are detached from frozen input', () => {
  const source = deepFreeze(input()), before = JSON.stringify(source), result = build(source)
  assert.equal(JSON.stringify(source), before)
  result.days[0].targets.kcal = 5
  assert.equal(source.plans[0].dailyTargets.kcal, 2000)
  for (const [date, from, through] of [['2026-01-01', '2025-12-29', '2026-01-04'],
    ['2024-02-29', '2024-02-26', '2024-03-03'], ['2026-03-29', '2026-03-23', '2026-03-29']]) {
    const r = build(input({ date, plans: [], mealLogs: [], weightLogs: [] }))
    assert.equal(r.from, from); assert.equal(r.through, through); assert.equal(r.days.length, 7)
  }
})

test('decimal meals sum before display, and numeric overflow is unknown, never Infinity', () => {
  const r = build(input({ mealLogs: [meal('2026-11-02', 'a', { kcal: '100,25' }), meal('2026-11-02', 'b', { kcal: 100.25 })] }))
  assert.equal(r.days[0].totals.kcal, 200.5)
  const huge = meal('2026-11-02', 'a', { kcal: Number.MAX_VALUE })
  const overflow = build(input({ mealLogs: [huge, { ...huge, id: 'b' }] }))
  assert.equal(overflow.days[0].totals.kcal, null)
  assert.equal(overflow.week.metrics.kcal.percent, null)
})
