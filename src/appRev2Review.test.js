import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calendarDay } from './calendarDate.js'
import { applyWarmupCorrection, saveWarmupOverride, loadWarmupOverride } from './warmupOverride.js'
import { summarizeReadinessForCoach } from './readinessInsight.js'
import { nextWeekStartDate, fillMissingWeekDates } from './weekDates.js'

test('K1 ugyldige kalenderdele afvises i alle tre timestampformer', () => {
  for (const sep of ['T', 't', ' ']) {
    for (const date of ['2026-02-30', '2025-02-29', '2026-04-31']) {
      assert.equal(calendarDay(`${date}${sep}12:00:00Z`), null, `${date}${sep}`)
    }
    assert.equal(calendarDay(`2024-02-29${sep}12:00:00Z`), '2024-02-29')
  }
  assert.equal(calendarDay('2026-12-31T23:30:00Z'), '2027-01-01')
})
test('K2 opvarmningsrettelser bruger dansk decimal og bevarer rampen', () => {
  const sets = [{ weight: 40, reps: 5 }, { weight: 60, reps: 3 }]
  const comma = applyWarmupCorrection(sets, 0, { weight: '42,5' })
  assert.equal(comma[0].weight, 42.5)
  assert.deepEqual(comma[0].warmupOverride, { anbefalet: 40, faktisk: 42.5 })
  assert.deepEqual(comma, applyWarmupCorrection(sets, 0, { weight: '42.5' }))
  assert.equal(comma[1], sets[1])
  assert.equal(sets[0].weight, 40)
  for (const weight of ['', ' ', null, undefined, NaN, Infinity, '42kg', '-2', '0']) {
    assert.deepEqual(applyWarmupCorrection(sets, 0, { weight }), sets)
  }
  assert.deepEqual(applyWarmupCorrection(sets, 0, { skipped: true }), [sets[1]])
  const storage = { value: null, setItem(k, v) { this.value = v }, getItem() { return this.value } }
  assert.equal(saveWarmupOverride('synthetic', 'squat', 100, comma, storage), true)
  assert.deepEqual(loadWarmupOverride('synthetic', 'squat', storage).sets, comma)
})
test('K3 ugyldige scorer afbryder serien af lave check-ins', () => {
  const row = (day, score) => ({ logged_date: `2026-10-${day}`, readiness_score: score })
  for (const score of [NaN, Infinity, -Infinity, null, undefined, '', '40']) {
    assert.equal(summarizeReadinessForCoach([row('24', 40), row('23', score), row('22', 30)]).lowStreak, 1)
    assert.equal(summarizeReadinessForCoach([row('24', score), row('23', 40)]).lowStreak, 0)
  }
  assert.equal(summarizeReadinessForCoach([row('23', 30), row('24', 40)]).lowStreak, 2)
  assert.equal(summarizeReadinessForCoach([row('24', 50), row('23', 40)]).lowStreak, 0)
})
test('K4 tomme ugenumre er hverken ankre eller udfyldningsmaal', () => {
  for (const week_number of [null, undefined, '', ' ', '\t', true, false, [], {}, NaN, Infinity, '1.5']) {
    const bad = { id: 'bad', week_number, start_date: '2026-01-05' }
    assert.deepEqual(fillMissingWeekDates([bad, { id: 'next', week_number: 1 }]), [], String(week_number))
    assert.equal(nextWeekStartDate([bad], new Date('2026-10-24T12:00:00Z')), '2026-10-26')
    assert.deepEqual(fillMissingWeekDates([{ id: 'anchor', week_number: 1, start_date: '2026-01-05' }, { id: 'bad', week_number }]), [])
  }
  assert.deepEqual(fillMissingWeekDates([{ id: 'anchor', week_number: '1', start_date: '2026-12-28' }, { id: 'next', week_number: 2 }]), [{ id: 'next', week_number: 2, start_date: '2027-01-04' }])
  assert.equal(nextWeekStartDate([{ week_number: 2, start_date: '2026-12-28' }]), '2027-01-04')
})
