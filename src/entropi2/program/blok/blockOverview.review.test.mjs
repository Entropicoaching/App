// Independent fixtures for a separate Node test process; no producer test helpers.
import test from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'
import { buildBlockOverview, plannedWeekSets } from './blockOverviewModel.mjs'
register('./viewLoader.mjs', import.meta.url)
const { default: View } = await import('./BlockOverview.mjs')

test('review: every week in a long block has the correct ordinal and invariant volume', () => {
  const weeks = Array.from({ length: 52 }, (_, index) => ({
    id: index + 1, week_number: index + 11, block_name: index < 40 ? 'Basis' : 'Test',
    sessions: [{ exercises: [{ sets: '2' }, { sets: 3 }] }, { exercises: [{ sets: 1 }] }],
  }))
  const original = JSON.stringify(weeks)
  for (let i = 0; i < 40; i++) {
    const result = buildBlockOverview({ enabled: true, weeks, currentWeekId: i + 1 })
    assert.equal(result.currentWeek, i + 1)
    assert.equal(result.totalWeeks, 40)
    assert.equal(result.next.weekNumber, 51)
    assert.equal(result.weeks.filter(w => w.current).length, 1)
    assert.ok(result.weeks.every(w => w.plannedSets === 6))
  }
  assert.equal(JSON.stringify(weeks), original)
})

test('review: synthetic view keeps supplied text as text and has no writes or event handlers', () => {
  const label = '<img src=x onerror=synthetic()>'
  const tree = View({ enabled: true, currentWeekId: 'one', weeks: [
    { id: 'one', week_number: 1, block_name: label, sessions: [] },
  ] })
  let sawLabel = false
  function inspect(node) {
    if (typeof node === 'string') { if (node === label) sawLabel = true; return }
    if (!node || typeof node !== 'object') return
    assert.equal(typeof node.type, 'string')
    assert.equal(node.props.dangerouslySetInnerHTML, undefined)
    assert.ok(Object.keys(node.props).every(key => !/^on[A-Z]/.test(key)))
    node.children.forEach(inspect)
  }
  inspect(tree)
  assert.equal(sawLabel, true)
  assert.equal(plannedWeekSets({ sessions: [{ exercises: [{ sets: '9007199254740992' }] }] }), null)
})
