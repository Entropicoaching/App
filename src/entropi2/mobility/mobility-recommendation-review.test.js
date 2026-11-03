import test from 'node:test'
import assert from 'node:assert/strict'
import { recommendMobilityRoutine } from './mobility-recommendation.mjs'
import { WARMUP_BASE } from '../../athlete/mobilityCatalog.mjs'

// Separate review probes use explicit catalog expectations, not the selector's
// matching logic or focusPlan as an oracle. All session data is synthetic.
test('review: each recommendation preserves the actual catalog content and dose', () => {
  for (const [name, key, ids, reason] of [
    ['Squat', 'Squat', ['sq-mob-2', 'sq-mob-3', 'sq-mov-1'], /ankler og hofter/],
    ['Bench press', 'Bænkpres', ['bp-mob-2', 'bp-akt-3', 'bp-akt-1'], /skulder/],
    ['Deadlift', 'Dødløft — Konventionel', ['dk-mob-3', 'dk-akt-1', 'dk-mov-1'], /hofte/],
    ['Sumo deadlift', 'Dødløft — Sumo', ['ds-mob-2', 'ds-mob-1', 'ds-mov-1'], /brede stilling/],
  ]) {
    const result = recommendMobilityRoutine({ exercises: [{ name }] })
    assert.deepEqual(result.routine.map(ex => ex.id), ids)
    assert.match(result.reason, reason)
    const catalog = WARMUP_BASE[key].flatMap(slot => slot.options)
    for (const step of result.routine) {
      const { source, ...content } = step
      assert.equal(typeof source, 'string')
      assert.deepEqual(content, catalog.find(ex => ex.id === step.id))
    }
  }
})

test('review: supported lift after unknown entries and repeated fallback are stable', () => {
  const input = { exercises: [null, { name: 'Row' }, { name: 'Squat', sets: 0 },
    { name: 'Sumo deadlift', sets: '2' }, { name: 'Bench press' }] }
  const snapshot = structuredClone(input)
  const expected = recommendMobilityRoutine(input)
  for (let i = 0; i < 25; i++) assert.deepEqual(recommendMobilityRoutine(input), expected)
  assert.equal(expected.need, 'Plads i sumostilling')
  assert.deepEqual(input, snapshot)
  const fallback = recommendMobilityRoutine({ exercises: [] })
  assert.equal(fallback.isDefault, true)
  assert.match(fallback.reason, /Standardrutinen/)
  assert.deepEqual(fallback.routine, recommendMobilityRoutine({ exercises: [{ name: 'Squat' }] }).routine)
})
