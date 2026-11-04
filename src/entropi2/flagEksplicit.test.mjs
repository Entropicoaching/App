import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DEFAULT_ENTROPI2, entropi2Enabled } from './flag.mjs'

// K-R4-ENTROPI-SAMLET fund 2: en eksplicit OFF-vaerdi skal vinde over standarden.
test('uden argument gaelder standarden (taendt for alle efter Marcs valg)', () => {
  assert.equal(DEFAULT_ENTROPI2, true)
  assert.equal(entropi2Enabled(), true)
  assert.equal(entropi2Enabled(undefined), true)
})

test('eksplicit true taender, alt andet eksplicit slukker', () => {
  assert.equal(entropi2Enabled(true), true)
  for (const off of [false, null, 0, 'false', 'true', 1, {}]) assert.equal(entropi2Enabled(off), false, String(off))
})

test('AthleteView og Dashboard har ingen false-standard, saa flagets standard gaelder uden prop', () => {
  for (const file of ['../AthleteView.jsx', '../Dashboard.jsx']) {
    const src = readFileSync(new URL(file, import.meta.url), 'utf8')
    assert.ok(!/entropi2 = false\s*\}\)/.test(src), file)
    assert.ok(/entropi2Enabled\(entropi2\) === true/.test(src), file)
  }
})
