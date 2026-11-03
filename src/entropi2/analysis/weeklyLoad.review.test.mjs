import test from 'node:test'
import assert from 'node:assert/strict'
import { weeklyLoad } from './weeklyLoad.mjs'

// Separate arithmetic oracle, no production date, number or RPE helper imports.
test('review: independent generated weekly sums, weighted set average and ratio', () => {
  const dates = ['2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02']
  for (let seed = 1; seed <= 30; seed++) {
    const logs = [], loads = [], ratings = []
    dates.forEach((day, week) => {
      let load = 0
      const rated = []
      for (let set = 0; set < seed % 7 + week + 1; set++) {
        const weight = seed + set + 10, reps = set % 12 + 1, rpe = (set + seed) % 11
        load += weight * reps
        if (set % 2) rated.push(rpe)
        logs.push({ id: `${week}-${set}`, logged_at: day, weight, reps_completed: reps,
          ...(set % 2 ? { rpe_actual: rpe, rpe_source: 'athlete' } : {}) })
      }
      loads.push(load)
      ratings.push(rated.length ? rated.reduce((a, b) => a + b, 0) / rated.length : null)
    })
    const result = weeklyLoad(logs, '2026-11-04')
    assert.deepEqual(result.weeks.map(w => w.tonnage), loads)
    result.weeks.forEach((week, i) => {
      if (ratings[i] === null) assert.equal(week.averageRpe, null)
      else assert.ok(Math.abs(week.averageRpe - ratings[i]) < 1e-12)
    })
    assert.ok(Math.abs(result.acuteChronicRatio - loads[3] * 3 / (loads[0] + loads[1] + loads[2])) < 1e-12)
  }
})

test('review: accumulated overflow and quotient overflow return null', () => {
  const days = ['2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02']
  const logs = days.map(logged_at => ({ logged_at, weight: 1e-300, reps_completed: 1 }))
  logs[3].weight = 1e300
  assert.equal(weeklyLoad(logs, '2026-11-04').acuteChronicRatio, null)
  logs.push({ ...logs[3], weight: Number.MAX_VALUE }, { ...logs[3], weight: Number.MAX_VALUE })
  assert.equal(weeklyLoad(logs, '2026-11-04').weeks[3].tonnage, null)
})

test('review: Copenhagen autumn clock repetition and date-only end of day', () => {
  const logs = ['2026-10-25T02:30:00+02:00', '2026-10-25T02:30:00+01:00',
    '2026-10-25T23:00:00Z'].map((logged_at, id) => ({ id, logged_at, weight: 10, reps_completed: 2 }))
  const sunday = weeklyLoad(logs, '2026-10-25')
  assert.equal(sunday.weeks[3].tonnage, 40)
  const monday = weeklyLoad(logs, '2026-10-26T00:00:00+01:00')
  assert.equal(monday.weeks[2].tonnage, 40)
  assert.equal(monday.weeks[3].tonnage, 20)
})

test('review: conflicting duplicate RPE never selects a winner, source order independent', () => {
  const a = { id: 'a', logged_at: '2026-11-03', weight: 50,
    reps_completed: 5, rpe_actual: 8, rpe_source: 'athlete' }
  const b = { ...a, rpe_actual: 9 }
  const result = weeklyLoad([a, b], '2026-11-04')
  assert.equal(result.weeks[3].sets, 0)
  assert.deepEqual(result, weeklyLoad([b, a], '2026-11-04'))
})
