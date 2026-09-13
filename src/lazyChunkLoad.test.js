import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadChunkWithRetry, isChunkLoadError } from './lazyChunkLoad.js'

function chunkError(msg = 'Failed to fetch dynamically imported module') {
  return new Error(msg)
}

test('lykkes kaldet første gang, hentes intet igen og genindlæses intet', async () => {
  let calls = 0
  const mod = await loadChunkWithRetry(async () => { calls++; return { ok: true } }, {
    wait: async () => {}, hasReloadedOnce: () => false, markReloaded: () => assert.fail('skulle ikke markere genindlæst'), reload: () => assert.fail('skulle ikke genindlæse'),
  })
  assert.deepEqual(mod, { ok: true })
  assert.equal(calls, 1)
})

test('en fejlende chunk-hentning prøver igen og lykkes andet forsøg — ordre 163 test', async () => {
  let calls = 0
  let waited = 0
  const mod = await loadChunkWithRetry(async () => {
    calls++
    if (calls === 1) throw chunkError()
    return { ok: true }
  }, {
    wait: async (ms) => { waited = ms },
    hasReloadedOnce: () => false,
    markReloaded: () => assert.fail('skulle ikke markere genindlæst — andet forsøg lykkedes'),
    reload: () => assert.fail('skulle ikke genindlæse — andet forsøg lykkedes'),
  })
  assert.deepEqual(mod, { ok: true })
  assert.equal(calls, 2, 'skulle prøve igen efter første fejl')
  assert.ok(waited > 0, 'skulle vente (back-off) mellem forsøg')
})

test('en vedvarende stale chunk (begge forsøg fejler) udløser ét helside-genload', async () => {
  let calls = 0
  let reloaded = false
  let markedReloaded = false
  const pending = loadChunkWithRetry(async () => { calls++; throw chunkError() }, {
    wait: async () => {},
    hasReloadedOnce: () => false,
    markReloaded: () => { markedReloaded = true },
    reload: () => { reloaded = true },
  })
  // Løftet hænger bevidst (venter på den rigtige side-genindlæsning) — vi
  // tjekker kun at genindlæsningen faktisk blev udløst, ikke at løftet indfries.
  await Promise.race([pending, new Promise((r) => setTimeout(r, 20))])
  assert.equal(calls, 2)
  assert.equal(reloaded, true)
  assert.equal(markedReloaded, true)
})

test('har siden allerede genindlæst én gang (fejlen er ægte, ikke stale chunk), kastes fejlen videre — ingen uendelig løkke', async () => {
  let reloadCalls = 0
  await assert.rejects(
    () => loadChunkWithRetry(async () => { throw chunkError() }, {
      wait: async () => {},
      hasReloadedOnce: () => true,
      markReloaded: () => assert.fail('skulle ikke markere igen'),
      reload: () => { reloadCalls++ },
    }),
    /Failed to fetch/,
  )
  assert.equal(reloadCalls, 0, 'må ikke genindlæse en anden gang i samme session')
})

test('en ægte runtime-fejl i modulet (ikke en chunk-hentefejl) prøves IKKE igen', async () => {
  let calls = 0
  await assert.rejects(
    () => loadChunkWithRetry(async () => { calls++; throw new Error('TypeError: x is not a function') }, {
      wait: async () => assert.fail('skulle ikke vente/genforsøge en ægte fejl'),
      hasReloadedOnce: () => false,
      markReloaded: () => assert.fail('skulle ikke genindlæse en ægte fejl'),
      reload: () => assert.fail('skulle ikke genindlæse en ægte fejl'),
    }),
    /not a function/,
  )
  assert.equal(calls, 1)
})

test('isChunkLoadError genkender de kendte browser-fejltekster for en stale/afbrudt chunk', () => {
  assert.equal(isChunkLoadError(new Error('Failed to fetch dynamically imported module: /assets/Dashboard-abc.js')), true)
  assert.equal(isChunkLoadError(new Error('Importing a module script failed')), true)
  assert.equal(isChunkLoadError({ message: 'Failed to fetch' }), true)
  assert.equal(isChunkLoadError(new Error('Cannot read properties of undefined')), false)
  assert.equal(isChunkLoadError(undefined), false)
})
