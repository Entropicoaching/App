import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'

// Import the real pure graph. A transitive client import must fail before evaluation.
const guard = registerHooks({
  resolve(specifier, context, next) {
    if (/^(?:https?:|@supabase\/)/.test(specifier)) throw Error('Client dependency in pure graph')
    return next(specifier, context)
  },
  load(url, context, next) {
    if (/\/supabase\.js(?:[?#]|$)/.test(url)) throw Error('Client dependency in pure graph')
    return next(url, context)
  },
})
let block, copy, shared, progress, data
try {
  block = await import('./blokFremgang.mjs')
  copy = await import('./dashboard/programCopy.js')
  shared = await import('./dashboardShared.js')
  progress = await import('./exerciseProgress.js')
  data = await import('./dataEnough.mjs')
} finally { guard.deregister() }

test('pure import graph retains opt-in defaults and calculations without client or env', () => {
  assert.equal(block.DEFAULT_BLOK_FREMGANG, false)
  assert.equal(copy.DEFAULT_PROGRAM_COPY, false)
  assert.equal(data.dataEnoughEnabled(), false)
  assert.deepEqual(shared.computePhases([]), [])
  assert.equal(progress.estimatedOneRepMax(100, 3), 110.00000000000001)
  assert.deepEqual(copy.progressedPrescription({ name: 'Squat', reps: '3', recommended_weight: 0 }, 'weight'),
    { reps: '3', recommended_weight: 2.5 })
})

test('actual block reader scopes pages to athlete and discards partial results on error', async () => {
  for (const fail of [false, true]) {
    const calls = [], row = { id: 'synthetic-log', weight: 100 }
    const client = { from(table) {
      assert.equal(table, 'exercise_logs')
      return { select() { return this }, eq(key, id) { assert.equal(key, 'athlete_id'); assert.equal(id, 'synthetic-a'); return this },
        order() { return this }, async range(from, to) {
          calls.push([from, to])
          if (from === 0) return { data: [row], error: null }
          return fail ? { data: null, error: { message: 'synthetic failure' } } : { data: [], error: null }
        } }
    } }
    const result = await block.readBlockLogs(client, 'synthetic-a')
    assert.deepEqual(calls, [[0, 999], [1, 1000]])
    assert.deepEqual(result, fail ? { data: null, error: { message: 'synthetic failure' } } : { data: [row], error: null })
  }
})
