// U3 commit 1: flag, R5-kostdage og pas-tæller. Fejler på d8575047, fordi modulerne mangler.
import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_U3_DATA, u3DataEnabled } from './flag.mjs'
import { mealDays, weekNutrition } from './nutritionWeek.mjs'
import { sessionCounts } from './sessionCounts.mjs'
import { dayReceipt } from '../../mealEvidence.mjs'
import { analysisModel } from '../analysis/analysisModel.mjs'

const meal = (id, date, kcal, protein = 40) => ({ id, date, meal: 'Måltid', kcal, protein, carb: 50, fat: 20 })

test('u3DataEnabled: en eksplicit værdi vinder, ellers gælder default', () => {
  assert.equal(typeof DEFAULT_U3_DATA, 'boolean')
  assert.equal(u3DataEnabled(), DEFAULT_U3_DATA)
  assert.equal(u3DataEnabled(true), true)
  assert.equal(u3DataEnabled(false), false)
  assert.equal(u3DataEnabled('true'), false)
})

test('kvitteringsrækker tæller ikke som måltider og ikke som en kostdag', () => {
  const rows = [meal('a', '2026-11-03', 1200)]
  const receipt = dayReceipt(rows, '2026-11-03', '2026-11-10')
  const days = mealDays([...rows, receipt, { ...receipt, date: '2026-11-04' }], { today: '2026-11-10' })
  assert.deepEqual(days.map(d => [d.date, d.kcal, d.confirmed]), [['2026-11-03', 1200, true]])
})

test('en dag med 40 % af kcal-målet er en kostdag, men ikke brugbar', () => {
  const [day] = mealDays([meal('a', '2026-11-03', 1200)], { today: '2026-11-10', kcalTarget: 3000 })
  assert.equal(day.usable, false)
  const [ok] = mealDays([meal('a', '2026-11-03', 1800)], { today: '2026-11-10', kcalTarget: 3000 })
  assert.equal(ok.usable, true)
  const week = weekNutrition([meal('a', '2026-11-03', 1200), meal('b', '2026-11-04', 2900)],
    { start: '2026-11-02', end: '2026-11-08', today: '2026-11-10', kcalTarget: 3000, proteinTarget: 40 })
  assert.equal(week.days, 2)
  assert.equal(week.usableDays, 1)
  assert.equal(week.usableKcalAverage, 2900)
  assert.equal(week.proteinHitDays, 2)
})

test('uden kcal_target er ingen dag brugbar, medmindre den er kvitteret', () => {
  const rows = [meal('a', '2026-11-03', 3500), meal('b', '2026-11-04', 3500)]
  const receipt = dayReceipt([rows[1]], '2026-11-04', '2026-11-10')
  const days = mealDays([...rows, receipt], { today: '2026-11-10' })
  assert.deepEqual(days.map(d => [d.date, d.usable]), [['2026-11-03', false], ['2026-11-04', true]])
})

test('dagen i dag tæller aldrig som en kostdag', () => {
  const days = mealDays([meal('a', '2026-11-09', 2000), meal('b', '2026-11-10', 2000)], { today: '2026-11-10', kcalTarget: 2000 })
  assert.deepEqual(days.map(d => d.date), ['2026-11-09'])
  const week = weekNutrition([meal('b', '2026-11-10', 2000)], { start: '2026-11-10', end: '2026-11-16', today: '2026-11-10' })
  assert.equal(week.days, 0)
  assert.equal(week.proteinAverage, null)
})

test('sessionCounts giver samme tal som weekOverview.counts for den aktuelle uge og regner også forrige uge', () => {
  const now = new Date('2026-11-04T12:00:00Z')
  const ex = (id, sets) => ({ id, name: 'Squat', sets })
  const currentWeek = { start_date: '2026-11-02', block_name: 'Styrke', sessions: [
    { id: 's1', exercises: [ex('sq', 2)] }, { id: 's2', exercises: [ex('bp', 1)] }, { id: 's3', exercises: [ex('dl', 2)] }] }
  const log = (exercise_id, set_number, day, extra = {}) => ({ exercise_id, set_number, logged_at: `${day}T10:00:00Z`, weight: 100, reps_completed: 3, ...extra })
  const logs = [log('sq', 1, '2026-11-03'), log('sq', 2, '2026-11-03'), log('bp', 1, '2026-11-03', { skipped: true }), log('dl', 1, '2026-11-04')]
  const overview = analysisModel({ entropi2: true, now, currentWeek, exerciseLogs: logs, fremgangLogs: [] }, now).weekOverview
  const mine = sessionCounts(currentWeek, logs, { today: '2026-11-04', now })
  assert.deepEqual({ planned: mine.planned, done: mine.done, confirmed: mine.confirmed, skipped: mine.skipped }, overview.counts)
  assert.deepEqual(overview.counts, { planned: 3, done: 2, confirmed: 3, skipped: 1 })

  const previousWeek = { start_date: '2026-10-26', sessions: [{ id: 'p1', exercises: [ex('psq', 1)] }, { id: 'p2', exercises: [ex('pbp', 1)] }] }
  const previous = sessionCounts(previousWeek, [log('psq', 1, '2026-10-27')], { today: '2026-11-04', now })
  assert.equal(previous.planned, 2)
  assert.equal(previous.done, 1)
  assert.equal(previous.complete, true)
  assert.equal(mine.complete, false)
})
