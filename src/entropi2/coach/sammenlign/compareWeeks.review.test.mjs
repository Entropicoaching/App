// Separate adversarial checks: no producer fixture, expected values computed here.
import test from 'node:test'
import assert from 'node:assert/strict'
import { compareWeeks } from './compareWeeks.mjs'

function independentSnapshot() {
  const athleteId = 'review-synthetic'
  const period = (start, through, kg, reps) => {
    const source = rows => ({ state: 'ready', complete: true, athleteId, from: start, through, rows })
    return { start,
      training: source([{ id: start, athlete_id: athleteId, logged_at: start, weight: kg,
        reps_completed: reps, rpe_actual: 6, rpe_source: 'athlete',
        exercises: { name: 'Bench', sessions: { id: start, weeks: { block_name: 'Basis' } } } }]),
      nutrition: source([]), weight: source([]) }
  }
  return { athleteId, first: period('2026-03-23', '2026-03-29', 90, 3),
    second: period('2026-03-30', '2026-04-05', 96, 5) }
}

test('review: independently calculated Epley and volume differences survive permutation and duplicate delivery', () => {
  const p = independentSnapshot(), result = compareWeeks(p, '2026-04-06')
  assert.equal(result.ready, true)
  assert.equal(result.first.training.volume, 270); assert.equal(result.second.training.volume, 480)
  assert.equal(result.metrics.find(m => m.key === 'volume').delta, 210)
  assert.ok(Math.abs(result.lifts[0].delta - 13) < 1e-9) // 96 * 7/6 - 90 * 1.1
  for (const w of [p.first, p.second]) {
    w.training.rows.push(structuredClone(w.training.rows[0])); w.training.rows.reverse()
  }
  assert.deepEqual(compareWeeks(p, '2026-04-06'), result)
})

test('review: Copenhagen spring DST and missing receipts cannot manufacture known values', () => {
  const p = independentSnapshot(); p.first.training.rows[0].logged_at = '2026-03-29T21:59:59Z'
  assert.equal(compareWeeks(p, '2026-04-06').first.training.volume, 270)
  p.first.training.rows[0].logged_at = '2026-03-29T22:00:00Z'
  assert.equal(compareWeeks(p, '2026-04-06').first.training.volume, null)
  delete p.first.training
  const r = compareWeeks(p, '2026-04-06')
  assert.ok(r.metrics.filter(m => ['sessions', 'sets', 'volume', 'rpe'].includes(m.key)).every(m => m.first === null && m.delta === null))
})

test('review: changing athlete or replaying another week receipt never exposes its measurements', () => {
  const p = independentSnapshot(); p.athleteId = 'different-synthetic-athlete'
  const r = compareWeeks(p, '2026-04-06')
  assert.equal(r.ready, true); assert.ok(r.metrics.every(m => m.first === null && m.second === null && m.delta === null))
  const q = independentSnapshot(); q.second.training = q.first.training
  assert.equal(compareWeeks(q, '2026-04-06').second.training.volume, null)
})

test('review: literal RPE marker is validated against actual set values; changing a value invalidates evidence', () => {
  const p = independentSnapshot(), row = p.first.training.rows[0]
  delete row.rpe_source
  row.note = '\n[appData2-rpe-v1:' + JSON.stringify([row.rpe_actual, row.weight, row.reps_completed, row.logged_at]) + ']'
  assert.equal(compareWeeks(p, '2026-04-06').first.training.rpe, 6)
  row.weight = 91
  assert.equal(compareWeeks(p, '2026-04-06').first.training.rpe, null)
})

test('review: sum overflow, conflicting IDs and invalid nutrition remain unknown', () => {
  const p = independentSnapshot(), original = p.first.training.rows[0]
  p.first.training.rows = [1, 2].map(i => ({ ...original, id: `overflow-${i}`, weight: 1e308, reps_completed: 1 }))
  assert.equal(compareWeeks(p, '2026-04-06').first.training.volume, null)
  p.first.training.rows[1].id = 'overflow-1'; p.first.training.rows[1].weight = 20
  assert.equal(compareWeeks(p, '2026-04-06').first.training.sets, null)
  p.first.nutrition.rows = [{ id: 'bad', athlete_id: p.athleteId, date: p.first.start, meal: 'Synthetic', kcal: 1e308, protein: false }]
  assert.equal(compareWeeks(p, '2026-04-06').first.nutrition.days, null)
})
