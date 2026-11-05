import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Explicit delivery scope: guard every new or changed source/test file, including
// this guard. Escaped code point keeps the guard itself free of corrupt text.
const changed = [
  "athlete/trainingFullscreen.test.js",
  "AthleteView.jsx",
  "entropi2/kostMaal/reactFixture.mjs",
  "entropi2/kostMaalKobling.test.js",
  "entropi2/kostMaalKvittering.test.js",
  "entropi2/kostplan/atlet/ActivePlan.mjs",
  "entropi2/kostplan/atlet/ActivePlan.synthetic.test.mjs",
  "entropi2/kostplan/coach/activation.fixture.mjs",
  "entropi2/kostplan/coach/activation.mjs",
  "entropi2/kostplan/coach/activation.react.test.mjs",
  "entropi2/kostplan/coach/activation.test.mjs",
  "entropi2/kostplan/coach/controller.mjs",
  "entropi2/kostplan/coach/portal.fixture.mjs",
  "entropi2/kostplan/coach/PortalPlan.mjs",
  "entropi2/kostplan/coach/view.mjs",
  "entropi2/kostplan/planAdapter.mjs",
  "entropi2/kostplan/activationEncoding.test.mjs"
]

test('all activation delivery files are valid UTF-8 without double-encoded Danish text', () => {
  const decoder = new TextDecoder('utf-8', { fatal: true })
  for (const name of changed) {
    const bytes = readFileSync(new URL('../../' + name, import.meta.url))
    const source = decoder.decode(bytes)
    assert.notEqual(bytes.subarray(0, 3).toString('hex'), 'efbbbf', name + ': no BOM')
    assert.doesNotMatch(source, /\u00c3/, name + ': double-encoded text')
  }
})
