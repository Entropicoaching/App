// Actual outer route, mounted nutrition consumer, lazy island and React roots.
// Synthetic data/strict DOM only; no browser acceptance or substitute React.
import test from 'node:test'
import assert from 'node:assert/strict'
import { act, createElement as h, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import Entropi2Kost from '../../Entropi2Kost.mjs'
import { fixture, athleteId, date } from '../../kostplan/atlet/daySession.fixture.mjs'
import { createNutritionController } from '../controller.mjs'
import { mountNutrition } from '../view.mjs'
import { createWeekPlan } from './model.mjs'
import { Ugeplan } from './Ugeplan.mjs'
import { mountUgeplan } from './mount.mjs'
import * as renderer from './reactMount.mjs'
import { lifecycleFixture, list, focus, propsOf, deferred } from './lifecycle.fixture.mjs'

const meal = { meal: 'Lifecycle seed', kcal: 100, protein: 10, carb: 10, fat: 2 }
const template = { id: JSON.stringify(['Lifecycle seed', 100, 10, 10, 2]), name: meal.meal, meal,
  ingredients: [{ name: 'Linser', quantity: 100, unit: 'g', preparation: 'rå' }] }
const button = (host, text) => list(host, 'button').find(node => node.textContent === text)
const props = (storage, extra = {}) => ({ enabled: true, athleteId, date, templates: [template], storage, ...extra })
function dataFixture(t) {
  const data = fixture(), f = lifecycleFixture(t, data.storage)
  data.values.set('entropi2:nutrition:skabeloner:v1:' + encodeURIComponent(athleteId),
    JSON.stringify({ version: 1, templates: [template] }))
  createWeekPlan(props(data.storage)).add(0, template.id)
  data.writes.length = 0
  return { ...f, ...data }
}
function rootOf(f) {
  const root = createRoot(f.host)
  let alive = true
  const unmount = () => { if (alive) { alive = false; root.unmount() } }
  f.cleanup(unmount)
  return { root, unmount }
}
async function outer(t, strict = false) {
  const f = dataFixture(t), { root, unmount } = rootOf(f), foods = []
  let inputs = { enabled: true, athlete: { id: athleteId }, date, client: f.client, foods,
    weightLogs: [], weightStatus: { athleteId, state: 'ready' } }
  const render = async (change = {}) => {
    inputs = { ...inputs, ...change }
    await act(async () => root.render(strict ? h(StrictMode, null, h(Entropi2Kost, inputs)) : h(Entropi2Kost, inputs)))
  }
  await render()
  const open = async () => {
    const fold = focus(f.host, 'week-plan'); assert.ok(fold, 'actual mounted nutrition fold')
    await act(async () => { fold.open = true; fold.dispatch('toggle'); await import('./reactMount.mjs') })
    assert.ok(list(f.host, 'section').some(n => n.getAttribute('aria-label') === 'Ugeplan fra egne måltidsskabeloner'), 'actual nested consumer rendered')
  }
  return { ...f, root, unmount, render, open }
}
function retained(host) {
  const select = focus(host, 'week-plan-add-0'), remove = focus(host, 'week-plan-remove-0-0')
  const forms = list(host, 'form')
  const submit = name => {
    const form = forms.find(node => list(node, 'input').some(input => input.name === name))
    return form && propsOf(form).onSubmit
  }
  const copy = button(host, 'Kopiér indkøbsliste')
  assert.ok(select && remove && copy, 'retaining real mounted handlers')
  const add = propsOf(select).onChange, del = propsOf(remove).onClick
  const portions = submit('portions'), stock = submit('stock'), copyAction = propsOf(copy).onClick
  assert.ok(portions && stock)
  return { copy: copyAction, async all() {
    add({ currentTarget: { value: template.id } }); del()
    portions({ preventDefault() {}, currentTarget: { elements: { portions: { value: '3' } } } })
    stock({ preventDefault() {}, currentTarget: { elements: { stock: { value: '20' } } } })
    await copyAction()
  } }
}

for (const strict of [false, true]) for (const kind of ['rerender', 'unmount']) {
  test(`actual outer ${kind}, StrictMode=${strict}: owned DOM preserved until bounded cleanup`, async t => {
    const f = await outer(t, strict); await f.open()
    const stale = retained(f.host), oldIsland = focus(f.host, 'week-plan-add-0')
    const before = [...f.values], writes = f.writes.length, calls = f.calls.length
    await act(async () => {
      f.hold(() => {
        if (kind === 'unmount') f.unmount()
        else flushSync(() => f.root.render(h('p', null, 'Route closed')))
      })
      await stale.all() // Before the intentionally withheld cleanup microtask.
    })
    assert.equal(oldIsland.isConnected, false)
    assert.equal(f.queued.length, 1, 'one cleanup task for one root')
    assert.deepEqual([...f.values], before); assert.equal(f.writes.length, writes)
    assert.equal(f.calls.length, calls, 'navigation and stale actions cannot log')
    await f.drain(); await stale.all()
    assert.deepEqual([...f.values], before); assert.equal(f.writes.length, writes)
    assert.equal(f.host.textContent, kind === 'rerender' ? 'Route closed' : '')
    assert.equal(f.queued.length, 0)
  })
}

for (const kind of ['rerender', 'unmount']) {
  test(`actual outer ${kind} just after lazy resolution, before nested React commit`, async t => {
    const f = await outer(t, true), fold = focus(f.host, 'week-plan'), before = [...f.values]
    await act(async () => {
      fold.open = true; fold.dispatch('toggle')
      await import('./reactMount.mjs')
      const island = fold.lastChild.firstChild
      assert.ok(island && Object.keys(island).some(key => key.startsWith('__reactContainer$')), 'actual nested root was created')
      assert.equal(island.childNodes.length, 0, 'nested React render has not committed')
      f.hold(() => {
        if (kind === 'unmount') f.unmount()
        else flushSync(() => f.root.render(h('p', null, 'Route closed')))
      })
    })
    await f.drain()
    assert.deepEqual([...f.values], before); assert.deepEqual(f.writes, [])
    assert.equal(f.host.textContent, kind === 'rerender' ? 'Route closed' : '')
  })
}

for (const strict of [false, true]) for (const kind of ['rerender', 'unmount']) {
  test(`actual outer ${kind} before lazy resolution, StrictMode=${strict}: no late island`, async t => {
    const f = await outer(t, strict), before = [...f.values], fold = focus(f.host, 'week-plan')
    await act(async () => {
      fold.open = true; fold.dispatch('toggle')
      if (kind === 'unmount') f.unmount()
      else flushSync(() => f.root.render(h('p', null, 'Route closed')))
      await import('./reactMount.mjs')
    })
    await f.drain()
    assert.equal(focus(f.host, 'week-plan-add-0'), undefined)
    assert.deepEqual([...f.values], before); assert.deepEqual(f.writes, [])
    assert.equal(f.host.textContent, kind === 'rerender' ? 'Route closed' : '')
  })
}

test('actual outer close/reopen and owner/day change retire old models and preserve fresh island', async t => {
  const f = await outer(t, true); await f.open()
  const old = retained(f.host), before = [...f.values]
  await act(async () => f.hold(() => flushSync(() => f.root.render(h('p', null, 'closed')))))
  await f.render(); await f.open()
  const fresh = focus(f.host, 'week-plan-add-0')
  await old.all(); await f.drain()
  assert.equal(focus(f.host, 'week-plan-add-0'), fresh)
  assert.equal(fresh.isConnected, true)
  assert.deepEqual([...f.values], before); assert.deepEqual(f.writes, [])
  const stale = retained(f.host)
  await f.render({ date: '2026-11-06' }); await f.open()
  await stale.all(); await f.drain()
  assert.deepEqual([...f.values], before); assert.deepEqual(f.writes, [])
  const oldDay = retained(f.host)
  await f.render({ athlete: { id: 'synthetic-other-owner' } }); await f.open()
  assert.equal(focus(f.host, 'week-plan-remove-0-0'), undefined, 'other owner cannot see old week')
  await oldDay.all(); await f.drain()
  assert.deepEqual([...f.values], before); assert.deepEqual(f.writes, [])
})

test('actual mount immediately after lazy load, before first React commit: repeated cleanup and fresh owner safe', async t => {
  const f = dataFixture(t), loaded = deferred()
  const clean = mountUgeplan(f.host, props(f.storage), { load: () => loaded.promise })
  f.cleanup(clean)
  await act(async () => {
    loaded.resolve(renderer)
    await loaded.promise; await Promise.resolve()
    f.hold(() => { clean(); clean() })
    assert.equal(f.host.textContent, '')
    assert.equal(f.queued.length, 1)
  })
  let fresh
  await act(async () => { fresh = renderer.mountUgeplanReact(f.host, props(f.storage)) })
  f.cleanup(fresh)
  await act(async () => {})
  const island = f.host.firstChild
  await f.drain(); clean()
  assert.equal(f.host.firstChild, island)
  assert.ok(focus(f.host, 'week-plan-add-0'))
  assert.deepEqual(f.writes, [])
})

test('actual mounted nutrition clearPlan invalidates pending copy and retained week/template/log actions immediately', async t => {
  const f = dataFixture(t), reply = deferred(), copies = []
  const controller = createNutritionController({ enabled: true, athlete: { id: athleteId }, date, storage: f.storage,
    contracts: { load: async () => [], save: async () => { throw Error('stale log reached backend') } } })
  const cleanup = mountNutrition(f.host, controller, { clipboard: { writeText(text) { copies.push(text); return reply.promise } } })
  f.cleanup(cleanup)
  await act(async () => { await controller.load() })
  const fold = focus(f.host, 'week-plan')
  await act(async () => { fold.open = true; fold.dispatch('toggle'); await import('./reactMount.mjs') })
  const stale = retained(f.host), log = focus(f.host, 'template-log-0')
  let pending
  await act(async () => { pending = stale.copy() })
  assert.equal(copies.length, 1)
  const before = [...f.values]
  await act(async () => { f.hold(() => { cleanup(); cleanup() }); await stale.all(); log?.dispatch('click') })
  assert.deepEqual([...f.values], before); assert.equal(copies.length, 1)
  await f.drain()
  await act(async () => { reply.resolve(); await pending; await stale.all() })
  assert.deepEqual([...f.values], before); assert.equal(copies.length, 1)
  assert.equal(f.host.textContent, '')
})

test('disposal immediately revokes idle copy and template retry before React effect cleanup', async t => {
  const f = dataFixture(t), copies = [], retries = []
  let cleanup
  await act(async () => { cleanup = renderer.mountUgeplanReact(f.host, props(f.storage, {
    clipboard: { writeText(text) { copies.push(text); return Promise.resolve() } } })) })
  f.cleanup(cleanup)
  const stale = retained(f.host), island = f.host.firstChild, before = [...f.values]
  await act(async () => { f.hold(cleanup); await stale.all() })
  assert.equal(f.queued.length, 1)
  assert.ok(island.childNodes.length > 0)
  assert.deepEqual(copies, []); assert.deepEqual([...f.values], before); assert.deepEqual(f.writes, [])
  await f.drain(); await stale.all()
  assert.equal(island.childNodes.length, 0); assert.deepEqual(copies, [])
  let retryCleanup
  await act(async () => { retryCleanup = renderer.mountUgeplanReact(f.host, props(f.storage, {
    templateError: true, onRetry: () => retries.push('read') })) })
  f.cleanup(retryCleanup)
  const retry = propsOf(button(f.host, 'Hent skabeloner igen')).onClick
  await act(async () => { f.hold(retryCleanup); retry() })
  assert.deepEqual(retries, [])
  await f.drain(); retry(); assert.deepEqual(retries, [])
})

test('already-started mounted tracker log settles once without altering the reopened nutrition view', async t => {
  const f = dataFixture(t), reply = deferred(), logs = []
  const controller = createNutritionController({ enabled: true, athlete: { id: athleteId }, date, storage: f.storage,
    contracts: { load: async () => [], save: async payload => { logs.push(payload); return reply.promise } } })
  const clean = mountNutrition(f.host, controller)
  f.cleanup(clean)
  await act(async () => { await controller.load() })
  const log = focus(f.host, 'template-log-0'); assert.ok(log)
  await act(async () => { log.dispatch('click') })
  assert.equal(logs.length, 1)
  clean()
  const next = createNutritionController({ enabled: true, athlete: { id: 'fresh-owner' }, date,
    storage: f.storage, contracts: { load: async () => [], save: async () => { throw Error('unexpected fresh save') } } })
  const nextCleanup = mountNutrition(f.host, next); f.cleanup(nextCleanup)
  await act(async () => { await next.load() })
  const view = f.host.firstChild, before = [...f.values], text = f.host.textContent
  await act(async () => { log.dispatch('click'); reply.resolve(true); await Promise.resolve(); await Promise.resolve() })
  assert.equal(logs.length, 1); assert.equal(f.host.firstChild, view); assert.equal(f.host.textContent, text)
  assert.deepEqual([...f.values], before); assert.deepEqual(f.writes, [])
})

for (const result of ['resolve', 'reject']) {
  test(`pending clipboard ${result} after disposal cannot acknowledge or change fresh view`, async t => {
    const f = dataFixture(t), reply = deferred(), calls = []
    let clean, pending
    await act(async () => { clean = renderer.mountUgeplanReact(f.host, props(f.storage, {
      clipboard: { writeText(text) { calls.push(text); return reply.promise } } })) })
    f.cleanup(clean)
    const island = f.host.firstChild, stale = retained(f.host), before = [...f.values]
    await act(async () => { pending = stale.copy() })
    await act(async () => { f.hold(() => { clean(); clean() }); await stale.all() })
    assert.ok(island.childNodes.length > 0, 'React DOM is intact until its owner cleans up')
    let fresh
    await act(async () => { fresh = renderer.mountUgeplanReact(f.host, props(f.storage, { clipboard: null })) })
    f.cleanup(fresh)
    const newIsland = f.host.firstChild
    await f.drain()
    assert.equal(island.childNodes.length, 0, 'old root completed teardown')
    assert.equal(f.host.firstChild, newIsland)
    await act(async () => {
      if (result === 'resolve') reply.resolve(); else reply.reject(Error('synthetic denial'))
      await pending; await stale.all()
    })
    assert.equal(calls.length, 1)
    assert.doesNotMatch(newIsland.textContent, /Kopieret\.|Kopiering kunne ikke bekræftes|Kopierer…/)
    assert.deepEqual([...f.values], before); assert.deepEqual(f.writes, [])
    await act(async () => propsOf(button(f.host, 'Kopiér indkøbsliste')).onClick())
    assert.match(newIsland.textContent, /Kopiering kunne ikke bekræftes/)
    assert.equal(propsOf(list(newIsland, 'textarea')[0]).readOnly, true, 'fresh manual fallback remains usable')
  })
}

test('retained direct React model handlers retire on owner/day/template changes and unmount', async t => {
  const f = dataFixture(t), { root, unmount } = rootOf(f), copies = []
  let inputs = props(f.storage, { clipboard: { writeText: text => { copies.push(text); return Promise.resolve() } } })
  await act(async () => root.render(h(StrictMode, null, h(Ugeplan, inputs))))
  for (const change of [{ date: '2026-11-06' }, { templates: [{ ...template }] }, { athleteId: 'other-owner' }]) {
    const stale = retained(f.host), before = [...f.values]
    inputs = { ...inputs, ...change }
    await act(async () => root.render(h(StrictMode, null, h(Ugeplan, inputs))))
    await stale.all()
    assert.deepEqual([...f.values], before); assert.deepEqual(copies, [])
  }
  await act(async () => unmount())
  assert.deepEqual(f.writes, [])
})

test('lazy disposal before success/failure and retry callback retirement preserve another owner', async t => {
  const f = dataFixture(t)
  for (const fail of [false, true]) {
    const load = deferred(), sentinel = f.doc.createElement('p'); sentinel.textContent = 'Other owner'
    f.host.append(sentinel)
    const cleanup = mountUgeplan(f.host, props(f.storage), { load: () => load.promise })
    cleanup(); cleanup()
    await act(async () => {
      if (fail) load.reject(Error('late chunk error')); else load.resolve(renderer)
      await load.promise.catch(() => {})
    })
    assert.equal(f.host.textContent, 'Other owner')
    assert.equal(f.queued.length, 0)
    sentinel.remove()
  }
  const load = deferred()
  const cleanup = mountUgeplan(f.host, props(f.storage), { load: () => load.promise })
  await act(async () => { load.reject(Error('chunk error')); await load.promise.catch(() => {}) })
  const retry = button(f.host, 'Åbn ugeplan igen'), handler = [...retry.events.get('click')][0]
  cleanup(); await handler()
  assert.equal(f.host.textContent, '')
  assert.deepEqual(f.writes, [])
})
