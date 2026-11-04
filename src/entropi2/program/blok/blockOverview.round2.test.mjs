import test from 'node:test'
import assert from 'node:assert/strict'
import { buildBlockOverview } from './blockOverviewModel.mjs'
const week = (id, n, name = 'Basis') => ({ id, week_number: n, block_name: name, sessions: [] })
const model = (weeks, currentWeekId) => buildBlockOverview({ enabled: true, weeks, currentWeekId })
test('usable weeks survive zero, repeated numbers and an unusable row without mutating input', () => {
  const weeks = [week('zero', 0), week('a', 1), week('b', 1), week('invalid', -1), week('c', 3)]
  weeks.forEach(Object.freeze); Object.freeze(weeks)
  const result = model(weeks, 'b')
  assert.equal(result.state, 'ready')
  assert.deepEqual(result.weeks.map(w => w.id), ['zero', 'a', 'b', 'c'])
  assert.equal(result.currentWeek, 3)
  assert.equal(result.totalWeeks, 4)
})
test('ambiguous identity is excluded and cannot anchor a fabricated active week', () => {
  const weeks = [week('repeat', 1), week('repeat', 2), week('good', 3)]
  assert.deepEqual(model(weeks, 'good').weeks.map(w => w.id), ['good'])
  assert.equal(model(weeks, 'repeat').state, 'unknown')
})
test('mixed owners still fail closed even when an invalid row would be excluded', () => {
  const weeks = [{ ...week('a', 1), athlete_id: 'synthetic-a' },
    { ...week('b', -1), athlete_id: 'synthetic-b' }]
  assert.equal(model(weeks, 'a').state, 'unknown')
})
test('milestones stop at the boundary, including repeated block names', () => {
  const weeks = [week('a', 1, 'Test'), week('b', 2, 'Test'), week('c', 3), week('d', 4, 'Test')]
  assert.equal(model(weeks, 'a').next.weekNumber, 2)
  assert.equal(model(weeks, 'b').next, null)
  assert.equal(model(weeks, 'c').next, null)
})
