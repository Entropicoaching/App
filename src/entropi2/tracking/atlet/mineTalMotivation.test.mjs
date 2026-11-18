import test from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'
import { renderTree } from '../../analysis/testDom.mjs'
import { readOwnTracking } from '../readOwnTracking.mjs'
register('../../analysis/reactLoader.mjs', import.meta.url)
const { default: Analysis } = await import('../../analysis/Analysis.mjs')

// Ordre 1700: atleten ser sin egen motivation (1 til 5) for de sidste 7 dage i Mine tal.
const row = extra => ({ athlete_id: 'synthetic-m', source: 'readiness_logs', logged_date: '2026-11-03',
  sleep_hours: 7, energy: 4, motivation: 3, stress: 2, soreness_level: 2, ...extra })
const snapshot = dailyRows => ({ status: 'ready', complete: true, athleteId: 'synthetic-m',
  endDate: '2026-11-03', dailySource: 'readiness_logs', dailyRows })
const view = trackingSnapshot => renderTree(Analysis({ entropi2: true, athlete: { id: 'synthetic-m' },
  now: '2026-11-04', fremgangLogs: [], historicalMealLogs: [], weightLogs: [], trackingSnapshot }))
const rest = tree => tree.querySelectorAll('[data-athlete-restitution]')[0]

test('læsningen henter motivation uden nye forespørgsler', async () => {
  const selects = []
  const query = { select(columns) { selects.push(columns); return query }, eq: () => query, gte: () => query,
    lte: () => query, order: () => query, limit: () => ({ data: [row()] }) }
  const data = await readOwnTracking({ enabled: true, client: { from: () => query }, athleteId: 'synthetic-m', day: '2026-11-04' })
  assert.equal(selects.length, 1); assert.match(selects[0], /\bmotivation\b/)
  assert.equal(data.dailyRows[0].motivation, 3)
})

test('Mine tal viser motivation for 7 dage; under 4 dage er et gennemsnit ukendt som ved energi', () => {
  const days = ['2026-10-30', '2026-11-01', '2026-11-03']
  const tree = view(snapshot(days.map((logged_date, i) => row({ logged_date, motivation: [2, 4, 3][i] }))))
  assert.match(rest(tree).textContent, /MotivationFor lidt data · 3\/7 dage/)
})

test('motivation med mindst 4 dage vises som gennemsnit; uden logs står der ingen tal', () => {
  const four = ['2026-10-29', '2026-10-31', '2026-11-02', '2026-11-03']
  const full = view(snapshot(four.map((logged_date, i) => row({ logged_date, motivation: [2, 4, 3, 5][i] }))))
  assert.match(rest(full).textContent, /Motivation3,5 af 5 \(5 højest\) · 4\/7 dage/)
  const none = view(snapshot([row({ motivation: null })]))
  assert.match(rest(none).textContent, /MotivationFor lidt data · 0\/7 dage/)
  assert.doesNotMatch(rest(none).textContent, /Motivation\d|NaN|undefined/)
})
