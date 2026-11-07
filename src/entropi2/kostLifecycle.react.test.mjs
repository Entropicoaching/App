// Genuine React/ReactDOM against copied product modules. Reuses the existing
// synthetic document/transport; no fake hooks, patched globals, timers or source rewrites.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { webcrypto } from 'node:crypto'
import * as vm from 'node:vm'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
const { compileFunction, createContext, SourceTextModule, SyntheticModule } = vm
import * as React from 'react'
import { sessionReactDocument } from './session/sessionQuickSetReactDom.mjs'
import { fixture, athleteId, date, flush } from './kostplan/atlet/daySession.fixture.mjs'

const require = createRequire(import.meta.url)
const settle = async () => { for (let i = 0; i < 8; i++) await flush() }
const latch = () => { let release; const promise = new Promise(resolve => { release = resolve }); return { promise, release } }
const props = client => ({ enabled: true, athlete: { id: athleteId, kcal_target: 2000, protein_target: 150 },
  date, currentDay: () => date, client, foods: [] })
const probes = f => f.plan.calls.filter(c => c.limit === 0).length
const noWrites = f => {
  assert.equal(f.plan.writes().length, 0)
  assert.equal(f.calls.filter(c => c.action !== 'select').length, 0)
  assert.equal(f.rows.length, 0); assert.equal(f.writes.length, 0)
}
async function mounted(storage, body) {
  const document = sessionReactDocument(), container = document.createElement('div')
  document.body.append(container)
  const file = require.resolve('react-dom/client').replace(/client\.js$/, 'cjs/react-dom-client.development.js')
  const cjs = { exports: {} }
  compileFunction(readFileSync(file, 'utf8'), ['module', 'exports', 'require', 'window', 'document', 'IS_REACT_ACT_ENVIRONMENT'],
    { filename: file })(cjs, cjs.exports, createRequire(file), document.defaultView, document, true)
  const sourceRoot = new URL('../', import.meta.url)
  const context = createContext({ crypto: webcrypto, localStorage: storage, structuredClone, console,
    setTimeout, clearTimeout, queueMicrotask, URL, TextEncoder, TextDecoder })
  const react = new SyntheticModule(Object.keys(React), function () {
    for (const [key, value] of Object.entries(React)) this.setExport(key, value)
  }, { context })
  const modules = new Map()
  const get = url => {
    if (url === 'react') return react
    assert.ok(url.startsWith(sourceRoot.href) && !url.endsWith('/supabase.js'))
    if (!modules.has(url)) modules.set(url, new SourceTextModule(readFileSync(new URL(url), 'utf8'),
      { context, identifier: url, initializeImportMeta: meta => { meta.url = url } }))
    return modules.get(url)
  }
  const entry = get(new URL('./Entropi2Kost.mjs', import.meta.url).href)
  await entry.link((specifier, ref) => get(specifier === 'react' ? specifier : new URL(specifier, ref.identifier).href))
  await entry.evaluate()
  const adapter = get(new URL('./kostplan/planAdapter.mjs', import.meta.url).href).namespace
  const root = cjs.exports.createRoot(container)
  const act = fn => React.act(async () => { await fn(); await settle() })
  // Observe the genuine mounted consumer's committed props, without replacing
  // any component or controller. This also catches session/client mismatches.
  const find = (fiber, predicate) => {
    if (!fiber) return null
    if (predicate(fiber)) return fiber
    return find(fiber.child, predicate) || find(fiber.sibling, predicate)
  }
  const consumer = name => find(root._internalRoot.current, f => typeof f.type === 'function' && f.type.name === name)?.memoizedProps
  const owner = () => consumer('KostTrackerHost')?.session
  const tracker = () => container.querySelector('[data-entropi2-kost]')
  const consistent = client => {
    const shared = adapter.sharePlanCapabilityProbes(client)
    assert.equal(adapter.sharePlanCapabilityProbes(client), shared)
    assert.equal(adapter.sharePlanCapabilityProbes(shared), shared)
    assert.equal(owner().client, shared)
    assert.equal(consumer('ApprovedPlanShopping').client, shared)
    assert.equal(consumer('KostDayFrame').client, shared)
    assert.equal(consumer('KostDayFrame').controller, owner().controller)
    return owner()
  }
  const ui = { container, act, owner, tracker, consistent,
    show: p => act(() => root.render(React.createElement(React.StrictMode, null, React.createElement(entry.namespace.default, p)))) }
  try { await body(ui) }
  finally { await act(() => root.unmount()) }
}

if (!vm.SourceTextModule) {
  test('cost lifecycle: bounded serial actual React VM child', () => {
    const child = spawnSync(process.execPath, ['--max-old-space-size=256', '--experimental-vm-modules',
      '--test', '--test-concurrency=1', '--test-reporter=tap', fileURLToPath(import.meta.url)], { encoding: 'utf8', env: {} })
    assert.equal(child.status, 0, child.stdout + child.stderr)
    assert.match(child.stdout, /# tests 3\b/)
    assert.match(child.stdout, /# pass 3\b/)
  })
} else {

test('cost lifecycle: real StrictMode shares the same memoized boundary; weight updates retain the owner and draft', async () => {
  const gate = latch(), f = fixture({ before: call => call.limit === 0 ? gate.promise : undefined }); f.approve()
  try {
    await mounted(f.storage, async ui => {
      const called = [], p = { ...props(f.client), weightStatus: { athleteId, state: 'error' }, retryWeight: () => called.push('old') }
      await ui.show(p)
      const owner = ui.consistent(f.client), content = ui.tracker().firstChild
      await ui.act(() => gate.release())
      assert.equal(probes(f), 3)
      assert.equal(ui.owner(), owner)
      assert.match(ui.container.textContent, /Dagens kostplan/)
      assert.equal(ui.container.querySelector('[data-shopping-complete]').getAttribute('data-shopping-complete'), 'true')
      const input = ui.tracker().querySelector('[data-focus="field-Måltid"]')
      input.value = 'Lifecycle kladde'; input.dispatch('input', { target: input })
      const retry = () => Array.from(ui.tracker().querySelectorAll('[data-kost-del="vaegt"] button')).find(b => b.textContent === 'Hent igen')
      const staleRetry = retry(); assert.ok(staleRetry)
      const before = f.plan.calls.length
      await ui.show({ ...p, weightInput: '81,2', retryWeight: () => called.push('latest') })
      assert.equal(ui.consistent(f.client), owner); assert.equal(ui.tracker().firstChild, content)
      assert.equal(ui.tracker().querySelector('[data-focus="field-Måltid"]').value, 'Lifecycle kladde')
      assert.equal(f.plan.calls.length, before)
      await ui.act(() => staleRetry.click()); assert.deepEqual(called, [])
      const retained = retry(); await ui.act(() => retained.click()); assert.deepEqual(called, ['latest'])
      await ui.show({ ...p, enabled: false })
      assert.equal(owner.contracts.dayTargets.snapshot().state, 'disposed')
      assert.equal(content.textContent, '')
      await ui.act(() => retained.click()); assert.deepEqual(called, ['latest'])
      assert.equal(await owner.controller.load(), false)
    })
  } finally { gate.release() }
  noWrites(f)
})

test('cost lifecycle: every original owner dependency replaces and disposes the actual session; unchanged values retain it', async () => {
  const first = fixture(), second = fixture()
  await mounted(first.storage, async ui => {
    let p = props(first.client); await ui.show(p)
    let owner = ui.consistent(p.client)
    await ui.show({ ...p, athlete: { ...p.athlete } }); assert.equal(ui.owner(), owner)
    for (const update of [
      v => ({ ...v, athlete: { ...v.athlete, kcal_target: 2345 } }),
      v => ({ ...v, athlete: { ...v.athlete, protein_target: 165 } }),
      v => ({ ...v, foods: [{ id: 'new-food', name: 'Lifecycle æble', kcal100: 50, protein100: 1, carb100: 10, fat100: 0 }] }),
      v => ({ ...v, date: '2026-11-06' }),
      v => ({ ...v, client: second.client }),
      v => ({ ...v, athlete: { ...v.athlete, id: 'lifecycle-foreign' } }),
    ]) {
      const old = owner, content = ui.tracker().firstChild
      p = update(p); await ui.show(p); owner = ui.consistent(p.client)
      assert.notEqual(owner, old); assert.equal(old.contracts.dayTargets.snapshot().state, 'disposed')
      assert.equal(await old.controller.load(), false); assert.equal(content.textContent, '')
      assert.equal(owner.athleteId, p.athlete.id); assert.equal(owner.date, p.date)
      const calls = first.calls.length + second.calls.length
      assert.equal((await old.contracts.saveWithIdentity({})).ok, false)
      assert.equal(first.calls.length + second.calls.length, calls)
    }
    await ui.show({ ...p, enabled: false }); assert.equal(ui.container.textContent, '')
    assert.equal(owner.contracts.dayTargets.snapshot().state, 'disposed')
    await ui.show(p); assert.notEqual(ui.consistent(p.client), owner)
  })
  noWrites(first); noWrites(second)
})

test('cost lifecycle: late old client cannot resurrect its owner; OFF and absent athlete never inspect the transport', async () => {
  const gate = latch(), old = fixture({ before: () => gate.promise }), fresh = fixture()
  old.approve(); fresh.approve()
  old.plan.data.kostplan_v1_versions[0].meals = structuredClone(old.plan.data.kostplan_v1_versions[0].meals)
  fresh.plan.data.kostplan_v1_versions[0].meals = structuredClone(fresh.plan.data.kostplan_v1_versions[0].meals)
  old.plan.data.kostplan_v1_versions[0].meals[0].name = 'FORBIDDEN stale lifecycle'
  fresh.plan.data.kostplan_v1_versions[0].meals[0].name = 'CURRENT lifecycle'
  try {
    await mounted(old.storage, async ui => {
      const p = props(old.client); await ui.show(p)
      const disposed = ui.consistent(old.client)
      await ui.show({ ...p, client: fresh.client })
      const current = ui.consistent(fresh.client)
      assert.notEqual(current.client, disposed.client)
      assert.equal(disposed.contracts.dayTargets.snapshot().state, 'disposed')
      await ui.act(() => gate.release())
      assert.equal(ui.owner(), current); assert.match(ui.container.textContent, /CURRENT lifecycle/)
      assert.doesNotMatch(ui.container.textContent, /FORBIDDEN stale lifecycle/)
      const poison = Object.defineProperty({}, 'from', { get() { throw Error('disabled transport inspected') } })
      await ui.show({ ...p, enabled: false, client: poison }); assert.equal(ui.container.textContent, '')
      await ui.show({ ...p, athlete: null, client: poison }); assert.equal(ui.container.textContent, '')
      assert.equal(current.contracts.dayTargets.snapshot().state, 'disposed')
    })
  } finally { gate.release() }
  noWrites(old); noWrites(fresh)
})

}
