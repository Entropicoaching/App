import test from 'node:test'
import assert from 'node:assert/strict'
import { readOwnTracking } from '../readOwnTracking.mjs'

// App npm-test discovery. Only actual React and ReactDOM SSR; no loader here.
let h, renderToStaticMarkup, Analysis, FremgangMineTal, missing = false
try {
  ;({ createElement: h } = await import('react'))
  ;({ renderToStaticMarkup } = await import('react-dom/server'))
} catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND' || !/package '(react|react-dom)'/.test(error.message)) throw error
  missing = true
}
if (!missing) {
  ;({ default: Analysis } = await import('../../analysis/Analysis.mjs'))
  ;({ default: FremgangMineTal } = await import('./FremgangMineTal.mjs'))
}
const options = { skip: missing ? 'Real React/react-dom absent in pinned public copy; Dhurva integration gate' : false }
const row = extra => ({ athlete_id: 'synthetic-a', source: 'readiness_logs', logged_date: '2026-11-03',
  sleep_hours: 0, energy: 2, stress: 3, soreness_level: 5, ...extra })
const snapshot = (dailyRows, extra) => ({ status: 'ready', complete: true, athleteId: 'synthetic-a',
  endDate: '2026-11-03', dailySource: 'readiness_logs', dailyRows, ...extra })
const render = trackingSnapshot => renderToStaticMarkup(h(Analysis, { entropi2: true,
  athlete: { id: 'synthetic-a' }, now: '2026-11-04', fremgangLogs: [], historicalMealLogs: [], weightLogs: [], trackingSnapshot }))

test('real React: existing production reader connects two closed native disclosures', options, async () => {
  const rows = [31, 1, 2, 3].map(day => row({ logged_date: day === 31 ? '2026-10-31' : `2026-11-0${day}` }))
  const calls = []
  const client = { from(table) {
    calls.push(table)
    const q = Object.fromEntries(['select', 'eq', 'gte', 'lte', 'order'].map(key => [key, () => q]))
    q.limit = () => ({ data: rows }); return q
  } }
  const input = await readOwnTracking({ enabled: true, client, athleteId: 'synthetic-a', day: '2026-11-04' })
  const html = render(input)
  assert.deepEqual(calls, ['readiness_logs'])
  for (const marker of ['data-fremgang-mine-tal', 'data-athlete-sleep', 'data-athlete-restitution']) {
    assert.match(html, new RegExp(`<details ${marker}="true"`))
    assert.doesNotMatch(html, new RegExp(`<details[^>]*${marker}[^>]* open`))
  }
  assert.match(html, /0,0 timer/); assert.match(html, /5,0 af 5 \(5 mest\)/)
  assert.match(html, /4\/7 dage/); assert.match(html, /min-height:44px/)
  assert.doesNotMatch(html, /Søvnkvalitet|Forsigtig restitutionsstatus|cyklus|cycle|synthetic-|NaN|Infinity/)
})

test('real React: absent, invalid, optimistic, stale and foreign data create no folds', options, () => {
  for (const input of [undefined, snapshot([]), snapshot([row({ _optimistic: true })]),
    snapshot([row({ sleep_hours: '8', energy: 0, stress: 6, soreness_level: 10 })]),
    snapshot([row()], { athleteId: 'foreign' }), snapshot([row()], { endDate: '2026-11-02' })]) {
    assert.doesNotMatch(render(input), /data-fremgang-mine-tal|data-athlete-sleep|data-athlete-restitution/)
  }
})

test('real React: independent fields, sparse coverage and failures stay truthful', options, () => {
  const sleep = render(snapshot([row({ energy: null, stress: null, soreness_level: null })]))
  assert.match(sleep, /data-athlete-sleep/); assert.doesNotMatch(sleep, /data-athlete-restitution/)
  const rest = render(snapshot([row({ sleep_hours: null })]))
  assert.match(rest, /data-athlete-restitution/); assert.doesNotMatch(rest, /data-athlete-sleep/)
  assert.match(rest, /For lidt data · 1\/7 dage/)
  assert.match(render(snapshot([row()], { status: 'loading' })), /Henter dine registreringer/)
  const failure = render(snapshot([row()], { status: 'error' }))
  assert.match(failure, /role="alert"/); assert.doesNotMatch(failure, /data-athlete-sleep/)
})

test('real React: strict OFF never reads props; default canonical presentation retained', options, () => {
  for (const enabled of [undefined, false, 1, 'true']) {
    assert.equal(FremgangMineTal({ enabled, get snapshot() { throw Error('OFF read') } }), null)
  }
  const html = render(snapshot([row({ source: 'athlete_manual', soreness: 0 })], { dailySource: undefined }))
  assert.match(html, /Se dine daglige svar/); assert.doesNotMatch(html, /data-athlete-sleep/)
})
