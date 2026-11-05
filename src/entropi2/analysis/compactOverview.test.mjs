import test from 'node:test'
import assert from 'node:assert/strict'
import Analysis from './Analysis.mjs'
import DevelopmentView from './DevelopmentView.mjs'
import { renderTree } from './testDom.mjs'

const days = ['2026-09-30', '2026-10-07', '2026-10-21', '2026-10-28']
const logs = (names = ['Squat']) => names.flatMap((name, lift) => days.map((day, i) => ({
  athlete_id: 'synthetic-compact', exercise_id: `${lift}-${day}`, logged_at: day,
  weight: 100 + i * 10, reps_completed: 3, reference_e1rm: 150,
  rpe_actual: 8, rpe_source: 'athlete',
  exercises: { name, sessions: { weeks: { block_name: 'Styrke' } } },
})))
const props = extra => ({ entropi2: true, now: '2026-11-04T12:00:00Z',
  athlete: { id: 'synthetic-compact' }, fremgangLogs: logs(),
  historicalMealLogs: [], weightLogs: [], ...extra })
function entries(node, ancestors = []) {
  if (!node || typeof node !== 'object') return []
  if (typeof node.type === 'function') return entries(node.type(node.props), ancestors)
  return [{ node, ancestors }, ...[node.props?.children].flat(Infinity)
    .flatMap(child => entries(child, [...ancestors, node]))]
}
const marked = (all, key) => all.filter(({ node }) => node.props?.[key])
const text = node => renderTree(node).textContent
const folds = entry => entry.ancestors.filter(node => node.type === 'details')

test('one and three lifts keep dated estimates, changes and stale warnings outside their closed graphs', () => {
  for (const names of [['Squat'], ['Squat', 'Bænkpres', 'Dødløft']]) {
    for (const stale of [false, true]) {
      const all = entries(DevelopmentView(props({ fremgangLogs: logs(names),
        now: stale ? '2026-11-20T12:00:00Z' : '2026-11-04T12:00:00Z' })))
      const charts = marked(all, 'data-development-chart')
      assert.equal(charts.length, names.length)
      assert.deepEqual(charts.map(({ node }) => node.props['data-development-chart']), names)
      for (const entry of charts) {
        const { node } = entry
        assert.equal(node.type, 'details')
        assert.equal(node.props.open, undefined)
        assert.equal(folds(entry).length, 0)
        const summary = node.props.children[0]
        assert.equal(text(summary), 'Se udviklingen over 26 uger')
        assert.ok(summary.props.style.minHeight >= 44)
        assert.match(node.props['aria-label'], new RegExp(node.props['data-development-chart']))
        const chartNodes = entries(node)
        const values = marked(chartNodes, 'data-history-value')
        assert.equal(values.length, 4)
        assert.equal(new Set(values.map(entry => text(entry.node))).size, 4)
        assert.deepEqual(values.map(entry => text(entry.node)), days.map((day, i) =>
          `${day.split('-').reverse().join('.')}: ${110 + i * 11} kg e1RM`))
        values.forEach(entry => assert.deepEqual(folds(entry), [node]))
        assert.equal(chartNodes.filter(({ node: n }) => n.type === 'h4' && text(n) === 'Registrerede tal').length, 1)
        assert.doesNotMatch(text(node), /Samme rep-område|mindst 4 uger/)
        const plot = chartNodes.find(({ node: n }) => n.props?.role === 'img').node
        const positions = [plot.props.children].flat(Infinity)
        assert.equal(positions.length, 26)
        assert.equal(positions.filter(n => n.props['data-history-bar']).length, 4)
        const holes = positions.filter(n => !n.props['data-history-bar'])
        assert.equal(holes.length, 22)
        for (const hole of holes) {
          assert.equal(hole.props.style.height, 0)
          assert.equal(hole.props.title, undefined)
        }
      }
      for (const latest of marked(all, 'data-development-latest')) {
        assert.equal(folds(latest).length, 0)
        assert.match(text(latest.node), /Seneste e1RM · skøn143 kgRegistreret 28.10.2026/)
      }
      const changes = marked(all, 'data-history-summary')
      assert.equal(changes.length, names.length)
      for (const change of changes) {
        assert.equal(folds(change).length, 0)
        assert.match(text(change.node), /steget 33 kg/)
      }
      const warnings = all.filter(({ node }) => node.type === 'p' && text(node).includes('mere end 14 dage gammelt'))
      assert.equal(warnings.length, stale ? names.length : 0)
      warnings.forEach(entry => assert.equal(folds(entry).length, 0))
      assert.equal(marked(all, 'data-history-value').length, names.length * 4)
      const evidence = all.filter(({ node }) => node.type === 'details' && node.props['aria-label']?.endsWith(': datagrundlag'))
      assert.equal(evidence.length, names.length)
      evidence.forEach(({ node }) => {
        assert.equal(text(node.props.children[0]), 'Datagrundlag')
        assert.equal(marked(entries(node), 'data-history-value').length, 0)
      })
    }
  }
})

test('one observation has no invented change; no observations and failed reads create no lift fold', () => {
  const single = entries(DevelopmentView(props({ fremgangLogs: logs().slice(-1) })))
  assert.equal(marked(single, 'data-development-chart').length, 1)
  assert.equal(marked(single, 'data-development-latest').length, 1)
  assert.equal(marked(single, 'data-history-summary').length, 0)
  for (const extra of [{ fremgangLogs: [] }, { fremgangLogs: undefined },
    { fremgangError: true }, { fremgangLoading: true }, { exerciseLogsError: true }]) {
    const all = entries(DevelopmentView(props(extra)))
    assert.equal(marked(all, 'data-development-chart').length, 0)
    assert.equal(marked(all, 'data-development-latest').length, 0)
  }
})

test('all secondary content is directly under the single outer fold; sharing takes two openings', () => {
  const all = entries(Analysis(props({ historicalMealLogs: [{ date: '2026-11-03', kcal: 500 }],
    fremgangLogs: [...logs(), { ...logs().at(-1), exercise_id: 'synthetic-current', logged_at: '2026-11-03' }] })))
  const [secondary] = marked(all, 'data-analysis-secondary')
  assert.equal(secondary.node.type, 'details')
  assert.equal(secondary.node.props.open, undefined)
  assert.ok(secondary.node.props.children[0].props.style.minHeight >= 44)
  assert.equal(marked(all, 'data-analysis-more').length, 0)
  for (const key of ['data-entropi2-ugerapport', 'data-analysis-mine-data', 'data-analysis-intensity',
    'data-analysis-share', 'data-analysis-rpe', 'data-analysis-records', 'data-analysis-volume', 'data-analysis-value']) {
    const matches = marked(all, key)
    assert.ok(matches.length, key)
    for (const match of matches) assert.deepEqual(folds(match), [secondary.node], key)
  }
  const [share] = marked(all, 'data-analysis-share')
  assert.equal(share.node.props.open, undefined)
  const [copy] = marked(all, 'data-analysis-copy')
  assert.deepEqual(folds(copy), [secondary.node, share.node])
  const readOnly = entries(Analysis(props({ readOnly: true, historicalMealLogs: [{ date: '2026-11-03', kcal: 500 }] })))
  assert.equal(marked(readOnly, 'data-analysis-share').length, 1)
  assert.equal(marked(readOnly, 'data-analysis-copy').length, 0)
  const empty = entries(Analysis(props({ fremgangLogs: [] })))
  assert.equal(marked(empty, 'data-analysis-secondary').length, 0)
  assert.equal(marked(empty, 'data-analysis-share').length, 0)
})
