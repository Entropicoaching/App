import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { setImmediate } from 'node:timers/promises'
import { createElement } from '../kostplan/coach/portal.fixture.mjs'

// This fixture runs the actual weight hook/effect; only hooks and client are synthetic.
const values = []
let cursor = 0, dependencies, cleanup, pendingEffect
globalThis.__syntheticWeightHooks = {
  createElement,
  useState(initial) {
    const i = cursor++
    if (!(i in values)) values[i] = initial
    return [values[i], update => { values[i] = typeof update === 'function' ? update(values[i]) : update }]
  },
  useEffect(effect, deps) {
    if (!dependencies || deps.some((value, i) => value !== dependencies[i])) {
      dependencies = deps; pendingEffect = effect
    }
  },
}
const adapter = new URL('../kostMaalKobling.mjs?audit-retry', import.meta.url).href
const hookSource = 'export const { createElement, useState, useEffect } = globalThis.__syntheticWeightHooks'
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'react') return { url: context.parentURL === adapter
    ? 'data:text/javascript,' + encodeURIComponent(hookSource)
    : new URL('../kostplan/coach/portal.fixture.mjs', import.meta.url).href, shortCircuit: true }
  return next(specifier, context)
} })
const { useEntropi2KostVaegt } = await import(adapter)
hooks.deregister()
delete globalThis.__syntheticWeightHooks

test('actual weight hook retries the same query and cancels stale answers on selection and OFF', async () => {
  const reads = []
  const client = { from(table) {
    const read = { table, operations: [] }; reads.push(read)
    const chain = Object.fromEntries(['select', 'eq', 'order'].map(method => [method, (...args) => {
      read.operations.push([method, ...args]); return chain
    }]))
    chain.limit = limit => { read.operations.push(['limit', limit]); return new Promise(resolve => { read.resolve = resolve }) }
    return chain
  } }
  const render = (athleteId = 'synthetic-a', enabled = true) => {
    cursor = 0
    const result = useEntropi2KostVaegt({ enabled, athleteId, client })
    if (pendingEffect) { cleanup?.(); cleanup = pendingEffect(); pendingEffect = null }
    return result
  }
  try {
    render(); await setImmediate()
    reads[0].resolve({ data: null, error: { message: 'synthetic' } }); await setImmediate()
    const failed = render(); assert.equal(failed.state, 'error')
    failed.retry(); render(); await setImmediate()
    assert.equal(render().state, 'loading')
    assert.deepEqual(reads[1].operations, reads[0].operations)
    assert.deepEqual(reads[1].operations, [['select', '*'], ['eq', 'athlete_id', 'synthetic-a'], ['order', 'logged_at', { ascending: false }], ['limit', 90]])
    render('synthetic-b'); await setImmediate()
    reads[1].resolve({ data: [{ athlete_id: 'synthetic-a', weight: 80 }], error: null }); await setImmediate()
    assert.equal(render('synthetic-b').athleteId, 'synthetic-b')
    reads[2].resolve({ data: [], error: null }); await setImmediate()
    assert.equal(render('synthetic-b').state, 'ready')
    render('synthetic-b', false); await setImmediate()
    assert.equal(reads.length, 3)
    assert.ok(reads.every(read => read.table === 'weight_logs'))
  } finally { cleanup?.() }
})
