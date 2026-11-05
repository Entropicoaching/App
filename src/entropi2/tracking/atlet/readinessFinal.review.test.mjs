// Separate exact-final check with independently constructed arithmetic/date data.
// A fresh Node process is not a separate human/model review or real ReactDOM.
import test from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'
import { renderTree } from '../../analysis/testDom.mjs'
register('../../analysis/reactElementLoader.mjs', import.meta.url)
const { default: Analysis } = await import('../../analysis/Analysis.mjs')

function input() {
  return { entropi2: true, now: '2026-10-26T00:30:00Z', athlete: { id: 'independent-fixture' },
    fremgangLogs: [], historicalMealLogs: [], weightLogs: [],
    trackingSnapshot: { athleteId: 'independent-fixture', endDate: '2026-10-25',
      status: 'ready', complete: true, dailySource: 'readiness_logs',
      dailyRows: ['19', '21', '23', '25'].map((day, index) => Object.freeze({
        athlete_id: 'independent-fixture', source: 'readiness_logs', logged_date: `2026-10-${day}`,
        sleep_hours: [0, 6, 8, 10][index], energy: [1, 2, 3, 4][index],
        stress: [5, 4, 3, 2][index], soreness_level: [1, 1, 3, 3][index],
      })) } }
}
const section = (tree, name) => tree.querySelectorAll(`[data-athlete-${name}]`)

test('independent: exact means, source separation and completed day across DST', () => {
  const props = input()
  Object.freeze(props.trackingSnapshot.dailyRows); Object.freeze(props.trackingSnapshot)
  const tree = renderTree(Analysis(props))
  const sleep = section(tree, 'sleep')[0], rest = section(tree, 'restitution')[0]
  assert.match(sleep.textContent, /2026-09-28–2026-10-25/)
  assert.match(sleep.textContent, /6,0 timer · 4\/7 dage/)
  assert.match(rest.textContent, /2026-10-19–2026-10-25/)
  for (const expected of ['2,5 af 5 (5 højest)', '3,5 af 5 (5 højest)', '2,0 af 5 (5 mest)']) {
    assert.ok(rest.textContent.includes(expected), expected)
  }
  assert.equal(sleep.getAttribute('open'), null); assert.equal(rest.getAttribute('open'), null)
  assert.doesNotMatch(rest.textContent, /Søvn|God|Lav|kg ×|Præstation/)
  assert.doesNotMatch(sleep.textContent, /Energi|Stress|Ømhed|Kvalitet/)
})

test('independent: each side disappears when its own observations disappear', () => {
  const props = input()
  props.trackingSnapshot.dailyRows = props.trackingSnapshot.dailyRows.map(row => ({ ...row, sleep_hours: null }))
  let tree = renderTree(Analysis(props))
  assert.equal(section(tree, 'sleep').length, 0); assert.equal(section(tree, 'restitution').length, 1)
  props.trackingSnapshot.dailyRows = props.trackingSnapshot.dailyRows.map(row => ({
    ...row, energy: null, stress: null, soreness_level: null,
  }))
  tree = renderTree(Analysis(props))
  assert.equal(tree.querySelectorAll('[data-fremgang-mine-tal]').length, 0)
  assert.equal(tree.querySelectorAll('[data-analysis-secondary]').length, 0)
})
