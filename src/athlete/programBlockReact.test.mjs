// App dependency, no React replacement or custom test loader.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement, isValidElement } from 'react'
import BlockOverview from '../entropi2/program/blok/BlockOverview.mjs'
function nodes(value) {
  if (!isValidElement(value)) return []
  return [value, ...[value.props.children].flat(Infinity).flatMap(nodes)]
}
function text(value) {
  if (Array.isArray(value)) return value.map(text).join(' ')
  return isValidElement(value) ? text(value.props.children) : value == null ? '' : String(value)
}
const weeks = [0, 1, 1].map((week_number, i) => ({ id: `react-${i}`, week_number,
  block_name: 'Test', sessions: [{ exercises: [{ sets: 2 }] }] }))
const options = extra => ({ enabled: true, weeks, currentWeekId: 'react-1', ...extra })
test('real React view preserves weekly volume, zero and repeated numbers, and current-block markers', () => {
  const tree = BlockOverview(options())
  assert.ok(isValidElement(tree))
  assert.match(text(tree), /Uge 2 af 3/)
  assert.match(text(tree), /Næste test eller deload.*Test i programuge 1/)
  const rows = nodes(tree).filter(n => n.type === 'li')
  assert.equal(rows.length, 3)
  assert.match(text(rows[0]), /programuge 0/)
  assert.match(text(rows[1]), /2 planlagte sæt/)
  assert.equal(rows[1].props['aria-current'], 'step')
  assert.equal(nodes(tree).filter(n => n.props['aria-current'] === 'step').length, 1)
  assert.doesNotMatch(text(BlockOverview(options({ currentWeekId: 'react-2' }))), /Næste test eller deload/)
})
test('real React view keeps empty, unknown and OFF states honest', () => {
  assert.match(text(BlockOverview(options({ weeks: [] }))), /ikke planlagt endnu/)
  const failed = BlockOverview(options({ currentWeekId: 'missing' }))
  assert.doesNotMatch(text(failed), /Uge \d+ af|planlagte sæt/)
  assert.equal(nodes(failed).filter(n => n.props.role === 'status').length, 1)
  assert.equal(BlockOverview({ enabled: false, weeks: new Proxy([], { get() { throw Error('OFF inspected input') } }) }), null)
})
