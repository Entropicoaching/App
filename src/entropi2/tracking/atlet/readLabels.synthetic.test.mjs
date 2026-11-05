import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { renderTree } from '../../analysis/testDom.mjs'

// Actual view and model; only createElement uses the pinned synthetic text/event host.
const target = new URL('./MineTal.mjs', import.meta.url).href
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (context.parentURL === target && specifier === 'react') return {
    url: new URL('../../analysis/testDom.mjs', import.meta.url).href, shortCircuit: true,
  }
  return next(specifier, context)
} })
const { default: MineTal } = await import('./MineTal.mjs')
hooks.deregister()

test('Mine tal: Hent igen invokes the existing read callback exactly once; loading stays distinct', () => {
  let reads = 0
  const tree = renderTree(MineTal({ enabled: true, snapshot: { status: 'error' }, onRetry() { reads++ } }))
  const button = tree.querySelectorAll('button')[0]
  assert.equal(button.textContent, 'Hent igen')
  button.dispatchEvent({ type: 'click' })
  assert.equal(reads, 1)
  const loading = renderTree(MineTal({ enabled: true, snapshot: { status: 'loading' } }))
  assert.match(loading.textContent, /Henter dine registreringer…/)
  assert.equal(loading.querySelectorAll('button').length, 0)
  const noCallback = renderTree(MineTal({ enabled: true, snapshot: { status: 'error' } }))
  assert.equal(noCallback.querySelectorAll('button').length, 0)
})

test('Mine tal: text-only change preserves strict OFF without inspecting data', () => {
  const poison = new Proxy({}, { get() { assert.fail('OFF read') } })
  for (const enabled of [undefined, false, 0, 1, 'true']) {
    assert.equal(MineTal({ enabled, snapshot: poison, onRetry: poison }), null)
  }
})
