import test from 'node:test'
import assert from 'node:assert/strict'
import Analysis from './Analysis.mjs'
import FremgangMineTal from '../tracking/atlet/FremgangMineTal.mjs'
import { renderTree } from './testDom.mjs'
const props = extra => ({ entropi2: true, now: new Date('2026-11-04T12:00:00Z'),
  athlete: { id: 'synthetic-a' }, fremgangLogs: [], historicalMealLogs: [], weightLogs: [], ...extra })
const snapshot = (extra = {}) => Object.defineProperties({ athleteId: 'synthetic-a', endDate: '2026-11-03',
  status: 'ready', complete: true, dailyRows: [] }, Object.getOwnPropertyDescriptors(extra))
const view = extra => renderTree(Analysis(props(extra)))
const fold = dom => dom.querySelectorAll('[data-fremgang-mine-tal]')[0]

test('empty Mine tal and unavailable sources do not create folds', () => {
  for (const extra of [{}, { trackingSnapshot: snapshot() }]) {
    assert.equal(fold(view(extra)), undefined)
    assert.equal(view(extra).querySelectorAll('[data-analysis-secondary]').length, 0)
  }
})
test('actual copied view displays canonical wellbeing only, no duplicate numeric domains or cycle', () => {
  const dailyRows = [1, 2, 3].map(i => ({ athlete_id: 'synthetic-a', source: 'athlete_manual',
    logged_date: `2026-11-0${i}`, sleep_hours: 0, energy: 2, stress: 3, soreness: 0 }))
  const input = snapshot({ dailyRows, get cycle() { throw Error('private read') } })
  const dom = fold(view({ trackingSnapshot: input }))
  for (const label of ['Søvn', 'Energi', 'Stress', 'Ømhed', '0,0 timer', '2026-10-07–2026-11-03'])
    assert.ok(dom.textContent.includes(label), label)
  assert.deepEqual(dom.querySelectorAll('h3').map(n => n.textContent), Array(4).fill('Søvn, energi, stress og ømhed'))
  assert.doesNotMatch(dom.textContent, /ugeestimater|cyklus|cycle|kcal|e1RM|kg/)
})
test('missing, complete empty, loading, failed and foreign source stay distinct', () => {
  assert.equal(fold(view()), undefined)
  assert.equal(fold(view({ trackingSnapshot: snapshot() })), undefined)
  assert.match(fold(view({ trackingSnapshot: snapshot({ status: 'loading' }) })).textContent, /Henter dine registreringer/)
  const onRetryTracking = () => {}
  const error = fold(view({ trackingSnapshot: snapshot({ status: 'error' }), onRetryTracking }))
  assert.match(error.textContent, /Kunne ikke hente/)
  assert.equal(error.querySelectorAll('button')[0].listeners.click, onRetryTracking)
  assert.equal(fold(view({ trackingSnapshot: snapshot({ athleteId: 'foreign' }) })), undefined)
})
test('strict OFF is inert at host and fold boundary', () => {
  for (const enabled of [false, undefined, 'true', 1]) assert.equal(FremgangMineTal({ enabled,
    get snapshot() { throw Error('OFF read') } }), null)
  assert.equal(Analysis({ entropi2: false, get trackingSnapshot() { throw Error('OFF') } }), null)
})
