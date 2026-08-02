import test from 'node:test'
import assert from 'node:assert/strict'

import {
  customerSetPresentationState,
  isCustomerSessionReady,
  nextUnconfirmedSetIndex,
} from '../customerJourneyState.js'

test('sæthierarkiet har præcis én aktiv status: logget, aktivt eller kommende', () => {
  const confirmed = { 0: true }
  assert.equal(customerSetPresentationState({ index: 0, activeIndex: 1, confirmed }), 'logged')
  assert.equal(customerSetPresentationState({ index: 1, activeIndex: 1, confirmed }), 'active')
  assert.equal(customerSetPresentationState({ index: 2, activeIndex: 1, confirmed }), 'upcoming')
})

test('næste aktive sæt bliver altid det første ufærdige, og null når passet er færdigt', () => {
  assert.equal(nextUnconfirmedSetIndex(4, { 0: true }, 0), 1)
  assert.equal(nextUnconfirmedSetIndex(4, { 1: true, 2: true, 3: true }, 3), 0)
  assert.equal(nextUnconfirmedSetIndex(2, { 0: true, 1: true }, 1), null)
})

test('et pas kan først afsluttes, når alle sæt er bekræftet og gyldige', () => {
  const rows = [{ valid: true }, { valid: true }]
  const validate = row => ({ ok: row.valid })
  assert.equal(isCustomerSessionReady(rows, { 0: true }, validate), false)
  assert.equal(isCustomerSessionReady(rows, { 0: true, 1: true }, validate), true)
  assert.equal(isCustomerSessionReady([{ valid: false }], { 0: true }, validate), false)
})
