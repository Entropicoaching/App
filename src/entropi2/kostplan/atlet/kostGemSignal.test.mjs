import test from 'node:test'
import assert from 'node:assert/strict'
import { markerKostGem, harNyKostGem } from './kostGemSignal.mjs'

test('2411: kun samme atlet og dag, og kun i et minut efter gem', () => {
  assert.equal(harNyKostGem('a', '2026-11-30', 1000), false)
  markerKostGem('a', '2026-11-30', 1000)
  assert.equal(harNyKostGem('a', '2026-11-30', 1500), true)
  assert.equal(harNyKostGem('b', '2026-11-30', 1500), false)
  assert.equal(harNyKostGem('a', '2026-12-01', 1500), false)
  assert.equal(harNyKostGem('a', '2026-11-30', 1000 + 60000), false)
})
