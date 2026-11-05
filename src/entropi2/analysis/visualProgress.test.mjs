import test from 'node:test'
import assert from 'node:assert/strict'
import Analysis from './Analysis.mjs'
import DevelopmentView from './DevelopmentView.mjs'
import { renderTree } from './testDom.mjs'

const props = extra => ({ entropi2: true, now: '2026-11-04T12:00:00Z',
  athlete: { id: 'synthetic-visual' }, historicalMealLogs: [], weightLogs: [],
  fremgangLogs: [0, 7, 14, 21].map((day, index) => ({
    exercise_id: `synthetic-${index}`, logged_at: `2026-10-${String(7 + day).padStart(2, '0')}`,
    weight: 100 + index * 10, reps_completed: 3, exercises: { name: 'Squat', sessions: { weeks: { block_name: 'Styrke' } } },
  })), ...extra })
const tracking = rows => ({ athleteId: 'synthetic-visual', endDate: '2026-11-03',
  dailySource: 'readiness_logs', status: 'ready', complete: true, dailyRows: rows })
const row = extra => ({ athlete_id: 'synthetic-visual', source: 'readiness_logs',
  logged_date: '2026-11-03', sleep_hours: 8, energy: 3, stress: 2, soreness_level: 1, ...extra })

// Inspect actual imported view output, retaining ancestry and inline styles.
// Works with ordinary React elements and the isolated public element fixture.
function entries(node, ancestors = []) {
  if (!node || typeof node !== 'object') return []
  if (typeof node.type === 'function') return entries(node.type(node.props), ancestors)
  return [{ node, ancestors }, ...[node.props?.children].flat(Infinity)
    .flatMap(child => entries(child, [...ancestors, node]))]
}
const marked = (all, key) => all.filter(({ node }) => node.props?.[key])
const text = node => renderTree(node).textContent

test('Mine tal loses one collapsed ancestor and follows development before secondary analyses', () => {
  const tree = Analysis(props({ trackingSnapshot: tracking([row()]) })), all = entries(tree)
  const mine = marked(all, 'data-fremgang-mine-tal')
  assert.equal(mine.length, 1)
  assert.equal(mine[0].node.type, 'details')
  assert.equal(mine[0].node.props.open, undefined)
  assert.equal(mine[0].ancestors.filter(n => n.type === 'details').length, 0)
  const development = marked(all, 'data-development')[0].node
  const secondary = marked(all, 'data-analysis-secondary')[0].node
  assert.equal(marked(all, 'data-development')[0].ancestors.filter(n => n.type === 'details').length, 0)
  assert.ok(all.findIndex(e => e.node === development) < all.indexOf(mine[0]))
  assert.ok(all.indexOf(mine[0]) < all.findIndex(e => e.node === secondary))
  for (const key of ['data-athlete-sleep', 'data-athlete-restitution']) {
    const [section] = marked(all, key)
    assert.equal(section.node.type, 'details')
    assert.equal(section.node.props.open, undefined)
    assert.deepEqual(section.ancestors.filter(n => n.type === 'details'), [mine[0].node])
    assert.ok(section.node.props.children[0].props.style.minHeight >= 44)
  }
  assert.ok(mine[0].node.props.children[0].props.style.minHeight >= 44)
})

test('tracking alone creates no empty Ugerapport wrapper; each readiness section needs its own data', () => {
  for (const [fields, sleep, rest] of [
    [{}, 1, 1], [{ sleep_hours: null }, 0, 1],
    [{ energy: null, stress: null, soreness_level: null }, 1, 0],
    [{ sleep_hours: null, energy: null, stress: null, soreness_level: null }, 0, 0],
  ]) {
    const all = entries(Analysis(props({ fremgangLogs: [], trackingSnapshot: tracking([row(fields)]) })))
    assert.equal(marked(all, 'data-athlete-sleep').length, sleep)
    assert.equal(marked(all, 'data-athlete-restitution').length, rest)
    assert.equal(marked(all, 'data-fremgang-mine-tal').length, sleep || rest)
    assert.equal(marked(all, 'data-analysis-secondary').length, 0)
  }
})

test('latest estimate is primary, comparison secondary and observation date separate; existing evidence remains', () => {
  const tree = DevelopmentView(props()), all = entries(tree)
  const [latest] = marked(all, 'data-development-latest')
  assert.ok(latest)
  assert.match(text(latest.node), /Seneste e1RM143 kg/)
  const value = entries(latest.node).find(({ node }) => node.type === 'strong').node
  assert.equal(value.props.style.fontSize, 32)
  const [comparison] = marked(all, 'data-history-summary')
  assert.match(text(comparison.node), /steget 33 kg/)
  assert.equal(comparison.node.props.style.fontSize, 16)
  assert.ok(value.props.style.fontSize > comparison.node.props.style.fontSize)
  assert.equal(comparison.node.props.style.fontWeight, 600)
  const date = entries(latest.node).find(({ node }) => node.type === 'time').node
  assert.equal(date.props.dateTime, '2026-10-28')
  assert.equal(text(date), '28.10.2026')
  assert.equal(marked(all, 'data-history-bar').length, 4)
  assert.equal(marked(all, 'data-history-value').length, 4)
  assert.match(text(tree), /4 uger med data|4 uger/)
  assert.match(text(tree), /skøn ud fra dine sæt/)
})

test('insufficient comparison, stale history, unavailable and OFF preserve honest states', () => {
  const single = props({ fremgangLogs: props().fremgangLogs.slice(-1) })
  let all = entries(DevelopmentView(single))
  assert.equal(marked(all, 'data-development-latest').length, 1)
  assert.equal(marked(all, 'data-history-summary').length, 0)
  const stale = DevelopmentView({ ...single, now: '2026-11-20T12:00:00Z' })
  assert.match(text(stale), /mere end 14 dage gammelt/)
  for (const extra of [{ fremgangLogs: [] }, { fremgangLogs: undefined },
    { fremgangLoading: true }, { fremgangError: true }, { exerciseLogsError: true }]) {
    all = entries(DevelopmentView(props(extra)))
    assert.equal(marked(all, 'data-development-latest').length, 0)
    assert.equal(marked(all, 'data-history-summary').length, 0)
  }
  for (const entropi2 of [undefined, false, 1, 'true']) {
    const off = { entropi2, get now() { throw Error('OFF read') },
      get trackingSnapshot() { throw Error('OFF tracking') } }
    assert.equal(Analysis(off), null)
    assert.equal(DevelopmentView(off), null)
  }
})

test('tracking loading and error stay reachable in the top-level Mine tal fold with the existing retry', () => {
  const onRetryTracking = () => 'synthetic-retry'
  for (const status of ['loading', 'error']) {
    const all = entries(Analysis(props({ fremgangLogs: [], onRetryTracking,
      trackingSnapshot: { ...tracking([]), status } })))
    const [mine] = marked(all, 'data-fremgang-mine-tal')
    assert.equal(mine.ancestors.filter(n => n.type === 'details').length, 0)
    assert.match(text(mine.node), status === 'error' ? /Kunne ikke hente/ : /Henter dine registreringer/)
    assert.equal(marked(all, 'data-athlete-sleep').length, 0)
    assert.equal(marked(all, 'data-athlete-restitution').length, 0)
    if (status === 'error') {
      const button = entries(mine.node).find(({ node }) => node.type === 'button').node
      assert.equal(button.props.onClick, onRetryTracking)
    }
  }
})
