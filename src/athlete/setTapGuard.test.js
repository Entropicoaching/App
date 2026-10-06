import { test } from 'node:test'
import assert from 'node:assert/strict'
import { canAcceptSetTap } from './setTapGuard.js'

test('a rapid double tap cannot act on the next set after a rerender', () => {
  assert.equal(canAcceptSetTap(-Infinity, 0), true)
  for (const time of [1, 100, 300, 499]) assert.equal(canAcceptSetTap(0, time), false)
  assert.equal(canAcceptSetTap(0, 500), true)
  assert.equal(canAcceptSetTap(0, 60000), true)
})
