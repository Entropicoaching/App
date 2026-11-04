import test from 'node:test'
import assert from 'node:assert/strict'
import { mountUgeplan } from './mount.mjs'
import { syntheticHost, find, flush } from '../synthetic-dom.mjs'

test('lazy island: strict OFF touches neither host nor inputs/loader', () => {
  const poison = new Proxy({}, { get() { throw Error('OFF read') } })
  for (const enabled of [false, undefined, null, 'true', 1]) {
    mountUgeplan(poison, { enabled, get athleteId() { throw Error('OFF input') } }, { load: poison })()
    mountUgeplan(poison, { enabled }, poison)()
  }
})

test('lazy island: import failure is visible and retryable; success and cleanup own the child', async () => {
  const host = syntheticHost(), props = { enabled: true }, seen = []
  let attempts = 0, disposed = 0
  const cleanup = mountUgeplan(host, props, { load: async () => {
    if (++attempts === 1) throw Error('synthetic chunk failure')
    return { mountUgeplanReact(child, inputs) { seen.push([child, inputs]); child.textContent = 'renderer sentinel'; return () => disposed++ } }
  } })
  assert.match(host.textContent, /Åbner ugeplan/)
  await flush()
  assert.equal(find(host, 'p', 'Ugeplanen kunne ikke åbnes. Prøv igen.').getAttribute('role'), 'alert')
  const retry = find(host, 'button', 'Åbn ugeplan igen')
  await retry.fire('click')
  assert.deepEqual(seen, [[host, props]])
  assert.equal(retry.events.click.length, 0)
  cleanup(); cleanup()
  assert.equal(disposed, 1)
  assert.equal(host.textContent, '')
})

test('lazy island: cleanup before import completion suppresses late mounts and late errors', async () => {
  for (const fail of [false, true]) {
    const host = syntheticHost()
    let resolve, reject, mounted = 0
    const promise = new Promise((yes, no) => { resolve = yes; reject = no })
    const cleanup = mountUgeplan(host, { enabled: true }, { load: () => promise })
    cleanup()
    if (fail) reject(Error('synthetic late error'))
    else resolve({ mountUgeplanReact() { mounted++; return () => {} } })
    await flush()
    assert.equal(mounted, 0)
    assert.equal(host.textContent, '')
  }
})
