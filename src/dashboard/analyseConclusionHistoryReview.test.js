import test from 'node:test'
import assert from 'node:assert/strict'
import { install } from './analyseConclusionLoader.mjs'
import { mount, nodes, text } from './analyseTestDom.mjs'
install()
const { default: Conclusion } = await import('./analyseConclusion.mjs')
const row = (id, date, lift = 'squat') => ({ id, athlete_id: 'demo', lift, status: 'coach_approved', analyzed_at: date, athlete_feedback: { focus: [{ text: `Fokus ${id}.` }] } })
const history = tree => nodes(tree, n => n.props['aria-label'] === 'Tidligere konklusioner')
const render = extra => mount(Conclusion, { enabled: true, athleteId: 'demo', analyses: [], logs: [], children: 'Grundlag', ...extra }).render()

test('counter: a newer other lift cannot leak its earlier reviews into the selected headline history', () => {
  const analyses = [row('bench-new', '2026-10-28', 'bench'), row('squat-old', '2026-10-20'), row('squat-older', '2026-10-19')]
  assert.equal(history(render({ analyses })).length, 0)
  assert.match(text(history(render({ analyses, liftFilter: 'squat' }))[0]), /squat-older/)
})

test('counter: all unapproved states and missing focus stay absent even with an old valid current row', () => {
  const analyses = [row('current', '2026-10-01'), ...['draft', 'invalid', 'processing', undefined].map((status, i) => ({ ...row('bad' + i, '2026-09-30'), status })), { ...row('empty', '2026-09-29'), athlete_feedback: {} }]
  assert.equal(history(render({ analyses })).length, 0)
})

test('counter: one mount clears history on failed, loading and absent-athlete rerenders', () => {
  const props = { enabled: true, athleteId: 'demo', analyses: [row('new', '2026-10-24'), row('old', '2026-10-10')], logs: [], children: 'Grundlag' }
  const instance = mount(Conclusion, props)
  assert.equal(history(instance.render()).length, 1)
  for (const extra of [{ error: 'failure' }, { loading: true }, { athleteId: null }, { enabled: false }]) {
    assert.equal(history(instance.render({ ...props, ...extra })).length, 0)
  }
  instance.dispose()
})

test('counter: history is separate from the existing evidence fold and has no write handler', () => {
  const tree = render({ analyses: [row('new', '2026-10-24'), row('old', '2026-10-10')] })
  assert.equal(nodes(tree, n => n.type === 'details').length, 2)
  const fold = history(tree)[0]
  assert.equal(nodes(fold, n => Object.keys(n.props).some(k => /^on[A-Z]/.test(k)) || n.props.dangerouslySetInnerHTML).length, 0)
  assert.equal(fold.props.open, undefined)
})
