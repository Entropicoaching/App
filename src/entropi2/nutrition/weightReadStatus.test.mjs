import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { readFileSync } from 'node:fs'
import { jsx } from '../../athlete/contactJsx.mjs'
import { setBackend } from '../../athlete/contactFakes.mjs'
import { createNutritionController } from './controller.mjs'
import { mountNutrition } from './view.mjs'
import { syntheticHost, find, flush } from './synthetic-dom.mjs'

// Import the copied factory itself, using the real read guard and number parser.
// Only its unrelated UI/backend capabilities are replaced; no React emulation.
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
    if (context.parentURL === target) {
      if (specifier === '../athleteReadGuard') return { url: new URL('../../athleteReadGuard.js', import.meta.url).href, shortCircuit: true }
      if (specifier === './kostNumbers.mjs') return next(specifier, context)
      return { url: unrelated, shortCircuit: true }
    }
    return next(specifier, context)
  },
  load(url, context, next) {
    if (url === target) return { format: 'module', shortCircuit: true,
      source: 'const __h = () => { throw Error("Unrelated UI render forbidden") };\n' + jsx(readFileSync(new URL(url), 'utf8')) }
    return next(url, context)
  },
})
const { lavBeskederOgVaegt } = await import('../../athlete/beskederOgVaegt.jsx')
hooks.deregister()

const id = 'synthetic-weight-a', other = 'synthetic-weight-b', date = '2026-11-05'
const row = (athlete_id = id) => ({ athlete_id, logged_at: date, weight: 80 })
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }
function fixture(t, answers) {
  const calls = [], reports = [], statuses = [], rows = []
  let next = 0, state = null, logs = [row()], cleanup
  const client = { from(table) {
    const call = { table, ops: [] }; calls.push(call)
    const answer = answers[next++]
    const query = new Proxy({}, { get(_, key) {
      if (key === 'then') return (ok, fail) => Promise.resolve(typeof answer === 'function' ? answer() : answer).then(ok, fail)
      return (...args) => { call.ops.push([key, ...args]); return query }
    } })
    return query
  } }
  setBackend(client)
  t.after(() => { cleanup?.(); setBackend(null) })
  const readRef = { current: 0 }
  const options = {
    athlete: { id }, weightLogs: logs, weightInput: '81',
    onReadError: (label, athleteId) => error => reports.push({ label, athleteId, error }),
    setWeightLogs: value => { logs = value; rows.push(value); cleanup?.updateWeight({ weightLogs: logs }) },
    setWeightStatus: value => { state = value; statuses.push(value); cleanup?.updateWeight({ weightStatus: state }) },
    weightReadRef: readRef,
  }
  const factory = extra => lavBeskederOgVaegt({ ...options, ...extra })
  const initial = factory()
  const mount = () => {
    const controller = createNutritionController({ enabled: true, athlete: { id }, date,
      contracts: { load: async () => [] } })
    const host = syntheticHost()
    cleanup = mountNutrition(host, controller, { clock: () => new Date(date + 'T12:00:00+01:00'),
      weightLogs: logs, weightStatus: state, retryWeight: () => initial.fetchWeightLogs(id) })
    return { host, cleanup }
  }
  return { ...initial, factory, options, calls, reports, statuses, rows, mount,
    get state() { return state }, get logs() { return logs } }
}

test('weight read: loading precedes confirmed empty ready; query remains athlete-scoped and read-only', async t => {
  const gate = deferred(), f = fixture(t, [gate.promise])
  const pending = f.fetchWeightLogs(id)
  assert.deepEqual(f.state, { athleteId: id, state: 'loading' })
  assert.equal(f.rows.length, 0)
  gate.resolve({ data: [], error: null }); await pending
  assert.deepEqual(f.statuses, [{ athleteId: id, state: 'loading' }, { athleteId: id, state: 'ready' }])
  assert.deepEqual(f.logs, [])
  assert.deepEqual(f.calls, [{ table: 'weight_logs', ops: [['select', '*'], ['eq', 'athlete_id', id], ['order', 'logged_at', { ascending: false }], ['limit', 30]] }])
})

test('weight read: response error and rejected transport retain rows and report error, never ready', async t => {
  for (const reject of [false, true]) {
    const error = Error('synthetic read failure')
    const f = fixture(t, [reject ? () => Promise.reject(error) : { data: null, error }])
    await f.fetchWeightLogs(id)
    assert.deepEqual(f.state, { athleteId: id, state: 'error' })
    assert.deepEqual(f.logs, [row()]); assert.equal(f.rows.length, 0)
    assert.deepEqual(f.reports, [{ label: 'Vægtloggen', athleteId: id, error }])
    assert.equal(f.statuses.some(s => s.state === 'ready'), false)
  }
})

test('weight read: newest request wins across factory recreations, same-athlete retries and athlete switches', async t => {
  for (const nextId of [id, other]) {
    const old = deferred(), fresh = deferred(), f = fixture(t, [old.promise, fresh.promise])
    const pendingOld = f.fetchWeightLogs(id)
    const pendingNew = f.factory({ athlete: { id: nextId } }).fetchWeightLogs(nextId)
    fresh.resolve({ data: [row(nextId)], error: null }); await pendingNew
    old.resolve({ data: [], error: null }); await pendingOld
    assert.deepEqual(f.state, { athleteId: nextId, state: 'ready' })
    assert.deepEqual(f.logs, [row(nextId)])
    assert.equal(f.rows.length, 1)
  }
})

test('weight read: superseded failures neither replace ready status nor flash an old error', async t => {
  for (const reject of [false, true]) {
    const old = deferred(), f = fixture(t, [old.promise, { data: [row()], error: null }])
    const pendingOld = f.fetchWeightLogs(id)
    await f.factory().fetchWeightLogs(id)
    const error = Error('synthetic stale error')
    if (reject) old.reject(error); else old.resolve({ data: null, error })
    await pendingOld
    assert.deepEqual(f.state, { athleteId: id, state: 'ready' })
    assert.deepEqual(f.reports, [])
  }
})

test('weight OFF: no status capability preserves success, reported-error and rejected-read contracts', async t => {
  const error = Error('synthetic legacy failure')
  const f = fixture(t, [{ data: [], error: null }, { data: null, error }, () => Promise.reject(error)])
  const legacy = f.factory({ setWeightStatus: undefined, weightReadRef: undefined })
  await legacy.fetchWeightLogs(id); assert.deepEqual(f.logs, [])
  await legacy.fetchWeightLogs(id); assert.equal(f.reports.length, 1)
  await assert.rejects(legacy.fetchWeightLogs(id), error)
  assert.deepEqual(f.statuses, [])
})

test('weight flow: real factory error -> retry once -> loading -> confirmed empty without meal remount or draft loss', async t => {
  const gate = deferred(), f = fixture(t, [{ data: null, error: Error('synthetic') }, gate.promise])
  const { host } = f.mount()
  await flush()
  const details = find(host, 'summary', 'Notér et måltid').parentElement
  details.open = true
  const input = details.querySelectorAll('input')[0]
  input.value = 'Syntetisk kladde'; await input.fire('input')
  await f.fetchWeightLogs(id)
  assert.ok(host.querySelectorAll('p').some(p => p.getAttribute('role') === 'alert' && p.textContent.includes('Vejningerne kunne ikke hentes')))
  assert.doesNotMatch(host.textContent, /Ingen vejninger endnu|Seneste vægt/)
  const retry = find(host, 'button', 'Hent igen')
  const pending = retry.fire('click'); await retry.fire('click')
  assert.equal(f.calls.length, 2)
  assert.match(host.textContent, /Indlæser vejninger/)
  assert.doesNotMatch(host.textContent, /Ingen vejninger endnu|Vejningerne kunne ikke hentes/)
  gate.resolve({ data: [], error: null }); await pending
  assert.equal(host.querySelectorAll('p').filter(p => p.textContent === 'Ingen vejninger endnu').length, 1)
  assert.equal(find(host, 'button', 'Hent igen'), undefined)
  assert.ok(host.querySelectorAll('input').some(n => n.value === 'Syntetisk kladde'))
})

test('weight view: missing/wrong/loading status hides stale rows; only confirmed empty shows empty text', async t => {
  const f = fixture(t, []), { host, cleanup } = f.mount()
  for (const weightStatus of [undefined, { athleteId: other, state: 'ready' }, { athleteId: id, state: 'loading' }]) {
    cleanup.updateWeight({ weightStatus, weightLogs: [row()] })
    assert.doesNotMatch(host.textContent, /Ingen vejninger endnu|Seneste vægt|80 kg/)
  }
  cleanup.updateWeight({ weightStatus: { athleteId: id, state: 'ready' }, weightLogs: [row()] })
  assert.match(host.textContent, /Seneste vægt: 80 kg/)
  cleanup.updateWeight({ weightLogs: [{ ...row(), weight: 'invalid' }] })
  assert.doesNotMatch(host.textContent, /Ingen vejninger endnu|Seneste vægt/)
  cleanup.updateWeight({ weightLogs: [] })
  assert.match(host.textContent, /Ingen vejninger endnu/)
})

test('weight retry: old and disposed events cannot fetch; rejected retry unlocks another attempt', async t => {
  const f = fixture(t, []), { host, cleanup } = f.mount()
  let calls = 0
  const status = { athleteId: id, state: 'error' }
  cleanup.updateWeight({ weightStatus: status, retryWeight: async () => { calls++; throw Error('synthetic retry') } })
  const old = find(host, 'button', 'Hent igen')
  await old.fire('click'); assert.equal(calls, 1)
  await find(host, 'button', 'Hent igen').fire('click'); assert.equal(calls, 2)
  cleanup.updateWeight({ weightStatus: { athleteId: other, state: 'error' } })
  await old.fire('click'); assert.equal(calls, 2)
  cleanup.updateWeight({ weightStatus: status })
  const retained = find(host, 'button', 'Hent igen')
  cleanup(); await retained.fire('click'); assert.equal(calls, 2)
})
