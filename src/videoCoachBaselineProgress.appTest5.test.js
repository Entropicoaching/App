import test from 'node:test'
import assert from 'node:assert/strict'
import { buildVideoCoachBaselineProfiles as profiles, countReadyVideoCoachBaselineProfiles as ready, videoCoachBaselineReviewImpact as impact } from './videoCoachBaselineProgress.js'

const analysis = (id = 'a1') => ({ id, lift: 'squat', variation: 'competition_squat', status: 'shared', low_conf_pct: 5,
  metrics: { rom: { value: 40, method: 'synthetic-v1', confidence: 0.9, eligible_for_baseline: true } } })
test('APP-TEST5 Progress: empty history cannot promise a baseline', () => {
  assert.deepEqual(profiles([], []), [])
  assert.equal(ready([]), 0)
  assert.equal(impact([], [], null), null)
})
test('APP-TEST5 Progress: one, three and five independent analyses have distinct stages', () => {
  for (const [n, stage] of [[1, 'building'], [3, 'preliminary'], [5, 'ready'], [20, 'ready']]) {
    const rows = Array.from({ length: n }, (_, i) => analysis('a' + i))
    const result = profiles([], rows)
    assert.equal(result[0].stage, stage)
    assert.equal(result[0].nAnalyses, n)
    assert.equal(result[0].remaining, Math.max(0, 5 - n))
    assert.equal(ready(result), n >= 5 ? 1 : 0)
    assert.equal(profiles([], [...rows, rows[0]])[0].nAnalyses, n)
  }
})
test('APP-TEST5 Progress: draft, invalid, low confidence and absent metrics do not count', () => {
  for (const patch of [{ status: 'draft' }, { status: 'invalid' }, { low_conf_pct: 16 }, { low_conf_pct: null }, { metrics: {} }])
    assert.deepEqual(profiles([], [{ ...analysis(), ...patch }]), [])
  const blocked = impact([], [], { ...analysis(), status: 'draft', metrics: {} })
  assert.equal(blocked.kind, 'blocked')
  assert.equal(blocked.after, 0)
})
test('APP-TEST5 Progress: invalid numeric confidence must not create a usable analysis', () => {
  for (const value of [NaN, Infinity, -Infinity, 'invalid'])
    assert.deepEqual(profiles([], [{ ...analysis(), low_conf_pct: value }]), [], String(value))
})
test('APP-TEST5 Progress: null metric is missing evidence, not numeric zero', () => {
  const row = analysis()
  row.metrics.rom.value = null
  assert.deepEqual(profiles([], [row]), [])
})
test('APP-TEST5 Progress: draft impact predicts one approval without changing history', () => {
  const rows = Array.from({ length: 4 }, (_, i) => analysis('old' + i)), before = structuredClone(rows)
  const result = impact([], rows, { ...analysis('new'), status: 'draft' })
  assert.equal(result.current, 4)
  assert.equal(result.after, 5)
  assert.equal(result.kind, 'ready')
  assert.match(result.detail, /Godkendelse/)
  assert.deepEqual(rows, before)
})
