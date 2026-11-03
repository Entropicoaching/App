import test from 'node:test'
import assert from 'node:assert/strict'
import { personalRecords } from './personalRecords.mjs'
import Analysis from './testRender.mjs'

// Separate adversarial probes: synthetic rows only; import actual final modules.
const now = new Date('2026-11-03T12:00:00Z')
const log = (id, name, day, weight, reps, extra = {}) => ({ id, exercise_id: id,
  logged_at: day, weight, reps_completed: reps,
  exercises: { name, sessions: { weeks: { block_name: 'Strength' } } }, ...extra })
const props = rows => ({ entropi2: true, fremgangLogs: rows, now })

test('review probe: equal e1RM chooses heavier source even with earlier lighter estimate', () => {
  const p = props([log('a', 'Bench', '2026-01-01', 100, 6), log('b', 'Bænkpres', '2026-10-01', 112.5, 2)])
  const r = personalRecords(p, now).lifts[0]
  assert.equal(r.bestEstimate.value, 120)
  assert.equal(r.bestEstimate.weight, 112.5)
  assert.equal(r.heaviest.date, '2026-10-01')
})

test('review probe: four-lift display stays short and does not change answer navigation', () => {
  const rows = ['Back squat', 'Bench press', 'Conventional deadlift', 'Deadlift (sumo)']
    .map((name, i) => log(`lift-${i}`, name, '2026-10-01', 90 + i * 10, 2))
  rows.push(log('variant', 'Pause squat', '2026-10-01', 999, 1))
  const calls = []
  const tree = Analysis({ ...props(rows), setTab: x => calls.push(x) })
  const records = tree.querySelectorAll('[data-analysis-records]')[0]
  assert.equal(records.querySelectorAll('li').length, 4)
  assert.doesNotMatch(records.textContent, /999|Pause squat/)
  tree.querySelectorAll('[data-analysis-destination]').forEach(b => b.dispatchEvent({ type: 'click' }))
  assert.deepEqual(calls, ['hjem', 'hjem', 'program'])
})

test('review probe: invalid and pending outliers cannot dominate a valid prior record', () => {
  const clean = log('good', 'Deadlift', '2026-02-01', 170, 2)
  const base = personalRecords(props([clean]), now)
  for (const bad of [log('pending', 'Deadlift', '2026-10-01', 500, 1, { _optimistic: true }),
    log('rpe', 'Deadlift', '2026-10-01', null, 1, { rpe: 10 }),
    log('overflow', 'Deadlift', '2026-10-01', Number.MAX_VALUE, 8),
    log('future', 'Deadlift', '2026-11-04', 999, 1)]) {
    assert.deepEqual(personalRecords(props([bad, clean]), now), base)
    assert.deepEqual(personalRecords(props([clean, bad]), now), base)
  }
})
