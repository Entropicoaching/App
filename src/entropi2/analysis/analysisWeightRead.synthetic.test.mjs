import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { readFileSync } from 'node:fs'
import { jsx } from '../../athlete/contactJsx.mjs'
import { setBackend } from '../../athlete/contactFakes.mjs'
import { renderTree } from './testDom.mjs'
import { readInitialAnalysisWeight } from './analysisWeight.mjs'

const target = new URL('../../athlete/beskederOgVaegt.jsx', import.meta.url).href
const fake = new URL('../../athlete/contactFakes.mjs', import.meta.url).href
const unrelated = 'data:text/javascript,' + encodeURIComponent(`
  export * from ${JSON.stringify(fake)};
  export default () => { throw Error('Unrelated UI forbidden') };
  export const createMarkerReplySender = () => { throw Error('Unrelated write forbidden') };
  export const openVideoFeedbackFollowUp = () => { throw Error('Unrelated navigation forbidden') };
`)
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'react') return { url: new URL('./reactElementFixture.mjs', import.meta.url).href, shortCircuit: true }
    if (context.parentURL === target) {
      if (specifier === '../athleteReadGuard') return { url: new URL('../../athleteReadGuard.js', import.meta.url).href, shortCircuit: true }
      if (specifier === './kostNumbers.mjs') return next(specifier, context)
      if (specifier === '../sendOnce.mjs') return next(specifier, context)
      return { url: unrelated, shortCircuit: true }
    }
    return next(specifier, context)
  },
  load(url, context, next) {
    if (url === target) return { format: 'module', shortCircuit: true,
      source: 'const __h = () => { throw Error("Unrelated UI forbidden") };\n' + jsx(readFileSync(new URL(url), 'utf8')) }
    return next(url, context)
  },
})
const { lavBeskederOgVaegt } = await import('../../athlete/beskederOgVaegt.jsx')
const { default: Analysis } = await import('./Analysis.mjs')
hooks.deregister()
const id = 'synthetic-analysis-read', now = new Date('2026-11-05T12:00:00Z')
const row = extra => ({ athlete_id: id, logged_at: '2026-11-04', weight: 82.75, ...extra })
const deferred = () => { let resolve; const promise = new Promise(ok => { resolve = ok }); return { promise, resolve } }

function fixture(t, replies) {
  const calls = [], reports = []
  let next = 0
  const props = { entropi2: true, now, athlete: { id }, fremgangLogs: [], historicalMealLogs: [],
    weightLogs: [row()], weightStatus: { athleteId: id, state: 'ready' } }
  setBackend({ from(table) {
    const reply = replies[next++], call = { table, ops: [] }; calls.push(call)
    const query = new Proxy({}, { get(_, key) {
      if (key === 'then') return (ok, fail) => Promise.resolve(reply).then(ok, fail)
      return (...args) => { call.ops.push([key, ...args]); return query }
    } })
    return query
  } })
  t.after(() => setBackend(null))
  const reader = lavBeskederOgVaegt({ athlete: props.athlete, weightLogs: props.weightLogs,
    weightReadRef: { current: 0 }, setWeightStatus: status => { props.weightStatus = status },
    setWeightLogs: rows => { props.weightLogs = rows },
    onReadError: () => error => reports.push(error) })
  props.retryWeight = () => reader.fetchWeightLogs(props.athlete.id)
  return { props, calls, reports, read: props.retryWeight,
    view: () => renderTree(Analysis(props)), text: () => renderTree(Analysis(props)).textContent }
}

test('actual copied reader -> analysis: failure retains host cache but hides metrics; Hent igen restores dated data', async t => {
  const retry = deferred()
  const f = fixture(t, [{ error: Error('synthetic unavailable') }, retry.promise])
  assert.match(f.text(), /82,8 kg/)
  await f.read()
  assert.equal(f.props.weightStatus.state, 'error')
  assert.equal(f.props.weightLogs.length, 1, 'the actual reader retains its last successful cache')
  assert.match(f.text(), /Din vægt kunne ikke hentes/)
  assert.doesNotMatch(f.text(), /82,8 kg|dage med registreret kropsvægt|seneste vejning/)
  const notice = f.view().querySelectorAll('[data-analysis-weight-status]')[0]
  const pending = notice.querySelectorAll('button')[0].dispatchEvent({ type: 'click' })
  assert.equal(f.props.weightStatus.state, 'loading')
  assert.match(f.text(), /Henter vægtdata/)
  retry.resolve({ data: [row({ weight: 83, logged_at: '2026-11-05' })], error: null })
  await pending
  assert.equal(f.props.weightStatus.state, 'ready')
  assert.match(f.text(), /83 kg|1 dag med registreret kropsvægt/)
  assert.match(f.text(), /seneste vejning 05.11.2026/)
  assert.doesNotMatch(f.text(), /kunne ikke hentes|Hent igen/)
  assert.equal(f.calls.length, 2)
  for (const call of f.calls) {
    assert.equal(call.table, 'weight_logs')
    assert.ok(call.ops.some(([op, key, value]) => op === 'eq' && key === 'athlete_id' && value === id))
    assert.ok(call.ops.every(([op]) => ['select', 'eq', 'order', 'limit'].includes(op)), 'read-only query')
  }
})

test('actual copied reader: a superseded completion cannot resurrect old weights after successful empty', async t => {
  const old = deferred(), current = deferred()
  const f = fixture(t, [old.promise, current.promise])
  const first = f.read(), second = f.read()
  current.resolve({ data: [], error: null }); await second
  assert.equal(f.props.weightStatus.state, 'ready'); assert.deepEqual(f.props.weightLogs, [])
  old.resolve({ data: [row({ weight: 999 })], error: null }); await first
  assert.deepEqual(f.props.weightLogs, [])
  assert.doesNotMatch(f.text(), /999|seneste vejning|kunne ikke hentes|Hent igen/)
})

test('startup and repeated Kost/analysis entries share the actual pending read and successful empty', async t => {
  const gate = deferred(), f = fixture(t, [gate.promise])
  f.props.weightStatus = null; f.props.weightLogs = []
  const requested = { current: null }
  const initial = () => readInitialAnalysisWeight(true, id, requested, () => f.read())
  const first = initial()
  assert.equal(f.props.weightStatus.state, 'loading')
  assert.match(f.text(), /Henter vægtdata/)
  assert.equal(initial(), first)
  assert.equal(initial(), first, 'StrictMode effect replay must not start a second read')
  assert.equal(f.calls.length, 1)
  gate.resolve({ data: [], error: null }); await first
  await initial()
  assert.equal(f.calls.length, 1)
  assert.equal(f.props.weightStatus.state, 'ready')
  assert.doesNotMatch(f.text(), /Hent igen|kunne ikke hentes|seneste vejning|0 kg/)
})

test('failed initial read waits for explicit retry; retry still reaches the actual reader', async t => {
  const f = fixture(t, [{ error: Error('synthetic unavailable') }, { data: [row()], error: null }])
  const requested = { current: null }
  const initial = () => readInitialAnalysisWeight(true, id, requested, () => f.read())
  await initial(); await initial()
  assert.equal(f.calls.length, 1)
  assert.match(f.text(), /Din vægt kunne ikke hentes/)
  await f.read()
  assert.equal(f.calls.length, 2)
  assert.match(f.text(), /seneste vejning 04.11.2026/)
})
