import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { dataEnoughEnabled } from './dataEnough.mjs'
let savedLocation
beforeEach(() => { savedLocation = globalThis.location; globalThis.location = { search: '?appData2=1' }; assert.equal(dataEnoughEnabled(), true) })
afterEach(() => { if (savedLocation === undefined) delete globalThis.location; else globalThis.location = savedLocation })
import { bestHeavySetPerDay } from './exerciseProgress.js'
import { lokalDag, smerteNoter, planlagtLetUge } from './coachFremgang.js'
import { erAfsluttetUge } from './dashboard/coachUgeFeedback.js'
test('strength days across both DST changes', () => {
      const times = ['2026-03-28T23:30:00Z', '2026-03-29T22:30:00Z', '2026-10-24T22:30:00Z', '2026-10-25T23:30:00Z']
      const rows = times.map(logged_at => ({ logged_at, weight: 100, reps_completed: 5, exercises: { name: 'Squat' } }))
      const points = bestHeavySetPerDay(rows)
      assert.deepEqual(points.map(p => p.dag), ['2026-03-29', '2026-03-30', '2026-10-25', '2026-10-26'])
      assert.ok(points.every(p => Number.isFinite(p.e1rm)))
      const repeatedHour = bestHeavySetPerDay(['2026-10-25T00:30:00Z', '2026-10-25T01:30:00Z'].map((logged_at, i) => ({ logged_at, weight: 100 + i * 10, reps_completed: 5, exercises: { name: 'Squat' } })))
      assert.equal(repeatedHour.length, 1)
      assert.equal(repeatedHour[0].dag, '2026-10-25')
      assert.equal(repeatedHour[0].weight, 110)
      assert.deepEqual(bestHeavySetPerDay([{ logged_at: '2026-10-26', weight: 100, reps_completed: 5, exercises: { name: 'Squat' } }]).map(p => p.dag), ['2026-10-26'])
})
test('coach current Copenhagen day', () => {
      assert.equal(lokalDag(new Date('2026-03-29T22:30:00Z')), '2026-03-30')
      assert.equal(lokalDag(new Date('2026-10-25T23:30:00Z')), '2026-10-26')
})
test('pain history Copenhagen boundary', () => {
      const log = logged_at => ({ logged_at, exercise_id: 'sq', note: 'Ondt i knæet', exercises: { name: 'Squat' } })
      const recent = smerteNoter([log('2026-10-25T23:30:00Z')], '2026-10-26')
      assert.equal(recent[0].dag, '2026-10-26')
      const boundary = smerteNoter([log('2026-10-11T22:30:00Z')], '2026-10-26')
      assert.equal(boundary.length, 1)
      assert.equal(boundary[0].dag, '2026-10-12')
})
test('deload Copenhagen boundary', () => {
      const log = logged_at => ({ logged_at, exercises: { name: 'Squat', sessions: { weeks: { block_name: 'Deload' } } } })
      assert.equal(planlagtLetUge([log('2026-10-15T22:30:00Z')], '2026-10-26'), true)
      assert.equal(planlagtLetUge([log('2026-10-14T22:30:00Z')], '2026-10-26'), false)
})
test('week closes at Copenhagen Monday', () => {
      assert.equal(erAfsluttetUge({ start_date: '2026-03-23' }, new Date('2026-03-29T21:59:59.999Z')), false)
      assert.equal(erAfsluttetUge({ start_date: '2026-03-23' }, new Date('2026-03-29T22:00:00Z')), true)
      assert.equal(erAfsluttetUge({ start_date: '2026-10-19' }, new Date('2026-10-25T22:59:59.999Z')), false)
      assert.equal(erAfsluttetUge({ start_date: '2026-10-19' }, new Date('2026-10-25T23:00:00Z')), true)
})
