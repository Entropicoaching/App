import test from 'node:test'
import assert from 'node:assert/strict'

import { runSubscriptionPilotSmoke } from '../../../scripts/verify-subscription-pilot-smoke.mjs'

test('lokal pilotrejse passerer den deterministiske end-to-end smoke-kontrakt', () => {
  const result = runSubscriptionPilotSmoke()
  assert.equal(result.checkCount, 20)
  assert.equal(result.checks.length, 20)
})
