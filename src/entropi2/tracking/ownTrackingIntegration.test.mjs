import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { register } from 'node:module'
import { begin, reset, flush, cleanup } from './ownTrackingHookFixture.mjs'
register('./ownTrackingSyntheticLoader.mjs', import.meta.url)
const { useOwnTracking } = await import('./useOwnTracking.mjs')
const { default: Analysis } = await import('../analysis/Analysis.mjs')
const { renderTree } = await import('../analysis/testDom.mjs')
const scope = { enabled: true, athleteId: 'synthetic-a', day: '2026-11-04' }
const render = p => { begin(); return useOwnTracking(p) }
const tick = () => new Promise(resolve => setImmediate(resolve))
function fixture() {
  const pending = []
  const client = { from(table) {
    const q = Object.fromEntries(['select', 'eq', 'gte', 'lt', 'lte', 'order'].map(k => [k, () => q]))
    q.limit = () => table === 'readiness_logs' ? new Promise(resolve => pending.push(resolve)) : { data: [] }
    return q
  } }
  const data = [31, 1, 2, 3].map(n => ({ athlete_id: scope.athleteId,
    logged_date: n === 31 ? '2026-10-31' : `2026-11-0${n}`, sleep_hours: 0, energy: 2, stress: 3, soreness_level: 5 }))
  return { client, pending, data }
}

test('synthetic actual hook: OFF inert; load, retry/error, tab return, day and athlete changes', async () => {
  reset()
  const off = { enabled: false, get day() { throw Error('OFF clock') },
    get client() { throw Error('OFF client') }, get athleteId() { throw Error('OFF identity') } }
  assert.equal(render(off).trackingSnapshot, null); flush()
  const f = fixture(), props = { ...scope, client: f.client }
  assert.equal(render(props).trackingSnapshot.status, 'loading'); flush()
  assert.equal(f.pending.length, 1)
  f.pending[0]({ data: f.data }); await tick()
  const ready = render(props)
  assert.equal(ready.trackingSnapshot.status, 'ready')
  ready.onRetryTracking()
  assert.equal(render(props).trackingSnapshot.status, 'loading'); flush()
  f.pending[1]({ error: { message: 'synthetic failure' } }); await tick()
  assert.equal(render(props).trackingSnapshot.status, 'error')
  render(props).onRetryTracking(); render(props); flush()
  f.pending[2]({ data: [] }); await tick()
  assert.equal(render(props).trackingSnapshot.status, 'ready')
  render(off); flush()
  assert.equal(render(props).trackingSnapshot.status, 'loading'); flush()
  assert.equal(f.pending.length, 4)
  const other = { ...props, athleteId: 'synthetic-b' }
  assert.equal(render(other).trackingSnapshot.status, 'loading'); flush()
  f.pending[3]({ data: f.data }); await tick()
  assert.equal(render(other).trackingSnapshot.status, 'loading')
  f.pending[4]({ data: [] }); await tick()
  assert.equal(render(other).trackingSnapshot.athleteId, 'synthetic-b')
  const nextDay = { ...other, day: '2026-11-05' }
  assert.equal(render(nextDay).trackingSnapshot.status, 'loading'); flush()
  cleanup(); f.pending[5]({ data: [] }); await tick()
  assert.equal(render(nextDay).trackingSnapshot.status, 'loading')
  reset()
})

test('actual reader/hook -> actual analysis view shows data and one heading, no repeated domains', async () => {
  reset()
  const f = fixture(), props = { ...scope, client: f.client }
  const view = result => renderTree(Analysis({ entropi2: true, athlete: { id: scope.athleteId },
    now: scope.day, fremgangLogs: [], historicalMealLogs: [], weightLogs: [], ...result }))
  const fold = tree => tree.querySelectorAll('[data-fremgang-mine-tal]')[0]
  assert.match(fold(view(render(props))).textContent, /Henter dine registreringer/); flush()
  f.pending[0]({ data: f.data }); await tick()
  const node = fold(view(render(props)))
  assert.equal(node.getAttribute('open'), null)
  assert.match(node.textContent, /0,0 timer/); assert.match(node.textContent, /5,0 af 5 \(5 mest\)/)
  assert.match(node.textContent, /oprindelige skala fra 1 til 5/)
  assert.match(node.textContent, /4\/7 dage/)
  assert.equal(node.querySelectorAll('h2').length, 0)
  assert.equal(node.querySelectorAll('summary').filter(n => n.textContent === 'Mine tal').length, 1)
  assert.doesNotMatch(node.textContent, /Styrke · ugeestimater|Vis vægtgrundlag|Vis kostgrundlag|Vis træningsgrundlag|cyklus|cycle/)
  render(props).onRetryTracking(); const loading = fold(view(render(props))); flush()
  assert.equal(loading.querySelectorAll('h2').length, 0)
  f.pending[1]({ error: true }); await tick()
  const failed = fold(view(render(props)))
  assert.equal(failed.querySelectorAll('h2').length, 0)
  assert.equal(failed.querySelectorAll('button').length, 1)
  assert.match(failed.textContent, /Kunne ikke hente/)
  reset()
})

test('exact host tracking hook args require own athlete and active analysis tab', () => {
  const source = readFileSync(new URL('../../AthleteView.jsx', import.meta.url), 'utf8')
  const block = source.match(/  const \{ trackingSnapshot, onRetryTracking \} = useOwnTracking\(\{[\s\S]*?\n  \}\)/)?.[0]
  assert.ok(block)
  const evaluate = new Function('useOwnTracking', 'e2', 'role', 'coachAthleteId', 'onExitPreview',
    'tab', 'session', 'athlete', 'e2Dag', 'inboxDatabase', block)
  const capture = (change = {}) => {
    let result
    const state = { e2: true, role: 'athlete', coachAthleteId: null, onExitPreview: null,
      tab: 'fremgang', session: { user: { id: 'synthetic-user' } },
      athlete: { id: scope.athleteId, user_id: 'synthetic-user' }, e2Dag: { day: scope.day }, inboxDatabase: {}, ...change }
    evaluate(p => { result = p; return {} }, ...Object.values(state))
    return result
  }
  assert.equal(capture().enabled, true)
  for (const change of [{ e2: false }, { role: 'coach' }, { tab: 'hjem' }, { coachAthleteId: 'other' },
    { onExitPreview() {} }, { session: null }, { athlete: null }, { athlete: { id: 'other', user_id: 'other' } }])
    assert.notEqual(capture(change).enabled, true)
  const host = source.match(/<Entropi2Analysis[\s\S]*?\/>/)[0]
  assert.ok(host.includes('trackingSnapshot={trackingSnapshot} onRetryTracking={onRetryTracking}'))
})
