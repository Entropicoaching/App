import test from 'node:test'
import assert from 'node:assert/strict'
import Analysis from './Analysis.mjs'

const now = new Date('2026-11-04T12:00:00Z')
const row = (logged_at, reps_completed = 3) => ({ exercise_id: `synthetic-${logged_at}`,
  logged_at, weight: 100, reps_completed,
  exercises: { name: 'Squat', sessions: { weeks: { block_name: 'Styrke' } } } })
const nodes = n => !n || typeof n !== 'object' ? []
  : [n, ...[n.props?.children].flat(Infinity).flatMap(nodes)]
const view = extra => Analysis({ entropi2: true, now, fremgangLogs: [], ...extra })
const explanations = tree => nodes(tree).filter(n => n.type === 'summary'
  && [n.props.children].flat().join('') === 'Sådan tælles det')

for (const [label, logs, count] of [
  ['records only', [row('2026-01-01')], 1],
  ['volume only', [row('2026-11-03', 12)], 1],
  ['records and volume', [row('2026-11-03')], 2],
]) {
  test(`44px explanations: ${label}, native and initially collapsed`, () => {
    const tree = view({ fremgangLogs: logs })
    const summaries = explanations(tree)
    assert.equal(summaries.length, count)
    for (const summary of summaries) {
      assert.ok(summary.props.style.minHeight >= 44)
      assert.equal(summary.props.style.boxSizing, 'border-box')
      assert.ok(summary.props.style.paddingTop > 0)
      assert.ok(summary.props.style.paddingBottom > 0)
      assert.equal(summary.props.style.cursor, 'pointer')
      assert.equal(summary.props.onClick, undefined)
      assert.equal(summary.props.onKeyDown, undefined)
      const parent = nodes(tree).find(n => [n.props?.children].flat().includes(summary))
      assert.equal(parent.type, 'details')
      assert.equal(parent.props.open, undefined)
      assert.equal(parent.props.role, undefined)
    }
    if (count === 2) assert.deepEqual(summaries[0].props.style, summaries[1].props.style)
  })
}

test('44px explanations: empty, absent, loading and error data create no empty folds', () => {
  for (const extra of [{}, { fremgangLogs: undefined },
    { fremgangLogs: [row('2026-11-03')], fremgangLoading: true },
    { fremgangLogs: [row('2026-11-03')], fremgangError: true }]) {
    assert.equal(explanations(view(extra)).length, 0)
  }
})

test('44px explanations: strict OFF stays inert before data access', () => {
  for (const entropi2 of [undefined, false, null, 0, 1, 'true']) {
    assert.equal(Analysis({ entropi2, get fremgangLogs() { throw Error('OFF read') } }), null)
  }
})
