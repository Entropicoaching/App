import test from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'
import { renderTree } from '../../analysis/testDom.mjs'
import { readOwnTracking } from '../readOwnTracking.mjs'
register('../../analysis/reactLoader.mjs', import.meta.url)
const { default: Analysis } = await import('../../analysis/Analysis.mjs')
const { default: FremgangMineTal } = await import('./FremgangMineTal.mjs')

const row = extra => ({ athlete_id: 'synthetic-a', source: 'readiness_logs', logged_date: '2026-11-03',
  sleep_hours: 0, energy: 2, stress: 3, soreness_level: 5, ...extra })
const snapshot = (dailyRows, extra) => ({ status: 'ready', complete: true, athleteId: 'synthetic-a',
  endDate: '2026-11-03', dailySource: 'readiness_logs', dailyRows, ...extra })
const view = trackingSnapshot => renderTree(Analysis({ entropi2: true, athlete: { id: 'synthetic-a' },
  now: '2026-11-04', fremgangLogs: [], historicalMealLogs: [], weightLogs: [], trackingSnapshot }))
const marked = (tree, name) => tree.querySelectorAll(`[data-athlete-${name}]`)

test('actual reader -> Analysis -> existing sleep/restitution leaves; one production read only', async () => {
  const calls = []
  const rows = [31, 1, 2, 3].map(day => row({ logged_date: day === 31 ? '2026-10-31' : `2026-11-0${day}` }))
  const client = { from(table) {
    calls.push(table)
    const query = Object.fromEntries(['select', 'eq', 'gte', 'lte', 'order'].map(key => [key, () => query]))
    query.limit = () => ({ data: rows })
    return query
  } }
  const data = await readOwnTracking({ enabled: true, client, athleteId: 'synthetic-a', day: '2026-11-04' })
  const tree = view(data), sleep = marked(tree, 'sleep')[0], rest = marked(tree, 'restitution')[0]
  assert.deepEqual(calls, ['readiness_logs'])
  assert.equal(sleep.getAttribute('open'), null); assert.equal(rest.getAttribute('open'), null)
  assert.equal(tree.querySelectorAll('[data-fremgang-mine-tal]')[0].getAttribute('open'), null)
  assert.match(sleep.textContent, /0,0 timer.*4\/7 dage/)
  assert.match(sleep.textContent, /2026-10-07–2026-11-03/)
  assert.match(rest.textContent, /5,0 af 5 \(5 mest\).*4\/7 dage/)
  assert.match(rest.textContent, /2026-10-28–2026-11-03/)
  assert.doesNotMatch(sleep.textContent, /Energi|Stress|Ømhed|Søvnkvalitet|RPE|e1RM/)
  assert.doesNotMatch(rest.textContent, /Søvn|Forsigtig restitutionsstatus|kg|sæt/)
  const fold = tree.querySelectorAll('[data-fremgang-mine-tal]')[0]
  assert.equal(fold.querySelectorAll('h2').length, 0)
  assert.equal(fold.querySelectorAll('summary').filter(n => n.textContent === 'Mine tal').length, 1)
  assert.doesNotMatch(fold.textContent, /cyklus|cycle|synthetic-|NaN|Infinity|undefined/)
})

test('independent presence gates, invalid-only, old-only and optimistic rows leave no empty folds', () => {
  const sleep = view(snapshot([row({ energy: null, stress: null, soreness_level: null })]))
  assert.equal(marked(sleep, 'sleep').length, 1); assert.equal(marked(sleep, 'restitution').length, 0)
  const rest = view(snapshot([row({ sleep_hours: null })]))
  assert.equal(marked(rest, 'sleep').length, 0); assert.equal(marked(rest, 'restitution').length, 1)
  for (const dailyRows of [[], [row({ _optimistic: true })],
    [row({ sleep_hours: NaN, energy: '3', stress: -1, soreness_level: 10 })],
    [row({ sleep_hours: null, logged_date: '2026-10-20' })]]) {
    const tree = view(snapshot(dailyRows))
    assert.equal(tree.querySelectorAll('[data-fremgang-mine-tal]').length, 0)
    assert.equal(tree.querySelectorAll('[data-analysis-secondary]').length, 0)
  }
})

test('loading/error retained rows never appear as fresh data; foreign/stale scopes hidden', () => {
  for (const status of ['loading', 'error']) {
    const tree = view(snapshot([row()], { status }))
    assert.equal(marked(tree, 'sleep').length, 0); assert.equal(marked(tree, 'restitution').length, 0)
    assert.match(tree.textContent, status === 'loading' ? /Henter dine registreringer/ : /Kunne ikke hente/)
  }
  for (const changes of [{ athleteId: 'foreign' }, { endDate: '2026-11-02' }]) {
    assert.equal(view(snapshot([row()], changes)).querySelectorAll('[data-fremgang-mine-tal]').length, 0)
  }
  for (const enabled of [undefined, false, 1, 'true']) assert.equal(FremgangMineTal({ enabled,
    get snapshot() { throw Error('OFF read') }, get now() { throw Error('OFF clock') } }), null)
})

test('duplicates/foreign rows show existing error/retry instead of partial numbers', () => {
  for (const rows of [[row(), row()], [row({ athlete_id: 'foreign' })]]) {
    let retries = 0
    const tree = renderTree(FremgangMineTal({ enabled: true, athleteId: 'synthetic-a', now: '2026-11-04',
      snapshot: snapshot(rows), onRetry() { retries++ } }))
    assert.match(tree.textContent, /Kunne ikke hente/)
    assert.equal(marked(tree, 'sleep').length, 0)
    tree.querySelectorAll('button')[0].dispatchEvent({ type: 'click' })
    assert.equal(retries, 1)
  }
})

test('sparse data discloses coverage; existing canonical and coach/leaf modes stay intact', () => {
  const tree = view(snapshot([row()]))
  assert.match(marked(tree, 'sleep')[0].textContent, /For lidt data · 1\/7 dage/)
  assert.match(marked(tree, 'sleep')[0].textContent, /0,0 timer/)
  assert.match(marked(tree, 'restitution')[0].textContent, /For lidt data · 1\/7 dage/)
  assert.match(marked(tree, 'restitution')[0].textContent, /ingen samlet restitutionsstatus/)
  const canonical = view(snapshot([row({ source: 'athlete_manual', soreness: 0 })], { dailySource: undefined }))
  assert.equal(marked(canonical, 'sleep').length, 0)
  assert.match(canonical.textContent, /Se dine daglige svar/)
})
