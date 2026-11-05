import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { mountHomeSession } from './homeSessionBridge.mjs'
import { syntheticDom } from '../session/sessionSyntheticDom.mjs'

// Actual bridge and dynamically imported production renderer; only DOM, clock
// and import timing/failure are synthetic. No React substitution or services.
const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const flush = () => new Promise(resolve => setImmediate(resolve))
const button = (root, text) => root.querySelectorAll('button').find(n => n.textContent === text)
function fixture(t, load = () => import('../session/sessionView.mjs')) {
  const dom = syntheticDom(), changes = []
  let imports = 0, mounts = 0, writes = 0, edits = 0
  const week = { id: 'synthetic-week', athlete_id: 'synthetic-a', start_date: '2026-11-02', week_number: 1,
    sessions: [{ id: 'synthetic-session', title: 'Syntetisk pas', exercises: [
      { id: 'synthetic-exercise', name: 'Syntetisk løft', sets: 2, reps: 5, recommended_weight: 40 },
    ] }] }
  const p = { enabled: true, athlete: { id: 'synthetic-a' }, allWeeks: [week], currentWeek: week,
    exerciseLogs: [], logInputs: {}, now: new Date('2026-11-03T12:00:00Z'),
    parsePlannedRpe: () => null, setLogInputs(fn) { edits++; p.logInputs = fn(p.logInputs) },
    onLogSet() { writes++; return false } }
  const bridge = mountHomeSession(dom.root, () => p, {
    onLoadingChange: value => changes.push(value),
    loadSession() {
      imports++
      return Promise.resolve(load()).then(module => ({ mountSession(root, latest) {
        mounts++; return module.mountSession(root, latest, { clock: dom.clock })
      } }))
    },
  })
  t.after(() => { bridge.dispose(); assert.equal(dom.timers.size, 0) })
  return { ...dom, p, week, bridge, changes, start: () => bridge.start('synthetic-session', 'synthetic-week'),
    get imports() { return imports }, get mounts() { return mounts }, get writes() { return writes }, get edits() { return edits } }
}

test('default production import is deferred until explicit start; OFF and invalid starts load nothing', async t => {
  let resolutions = 0
  const hooks = registerHooks({ resolve(specifier, context, next) {
    if (specifier.endsWith('/sessionView.mjs') && context.parentURL.endsWith('/homeSessionBridge.mjs')) resolutions++
    return next(specifier, context)
  } })
  t.after(() => hooks.deregister())
  const dom = syntheticDom()
  const sample = fixture(t)
  const bridge = mountHomeSession(dom.root, () => sample.p)
  t.after(() => bridge.dispose())
  assert.equal(dom.root.children.length, 0)
  bridge.update(); assert.equal(resolutions, 0)
  sample.p.enabled = false
  assert.equal(bridge.start('synthetic-session', 'synthetic-week'), false)
  sample.p.enabled = true
  assert.equal(bridge.start('other', 'synthetic-week'), false)
  assert.equal(resolutions, 0)
  assert.equal(await bridge.start('synthetic-session', 'synthetic-week'), true)
  assert.equal(resolutions, 1)
  assert.ok(dom.root.querySelector('dialog').open)
  assert.equal(sample.writes, 0); assert.equal(sample.edits, 0)
})

test('local loading locks repeated clicks; successful import opens actual session and keeps logging', async t => {
  const waiting = deferred(), f = fixture(t, () => waiting.promise)
  const before = JSON.stringify(f.p.allWeeks), pending = f.start()
  assert.equal(f.root.getAttribute('aria-busy'), 'true')
  assert.match(f.root.querySelector('[role="status"]').textContent, /Indlæser passet/)
  assert.equal(f.start(), false)
  await flush(); assert.equal(f.imports, 1); assert.equal(f.mounts, 0)
  waiting.resolve(await import('../session/sessionView.mjs'))
  assert.equal(await pending, true)
  assert.equal(f.mounts, 1); assert.deepEqual(f.changes, [true, false])
  assert.equal(f.root.getAttribute('aria-busy'), 'false')
  assert.match(f.root.querySelector('dialog').textContent, /Syntetisk løft/)
  assert.equal(f.writes, 0); assert.equal(f.edits, 0)
  const weight = f.root.querySelector('[data-field="weight"]')
  weight.value = '42,5'; weight.fire('input'); assert.equal(f.edits, 1)
  f.root.querySelector('form').fire('submit', { preventDefault() {} })
  await flush(); assert.equal(f.writes, 1)
  assert.equal(JSON.stringify(f.p.allWeeks), before)
  button(f.root, 'Luk pas').fire('click')
  assert.equal(f.root.querySelector('dialog'), null)
  assert.equal(f.start(), true); assert.equal(f.imports, 1)
})

test('import rejection and synchronous failure show honest error; retry loads once and opens', async t => {
  for (const synchronous of [false, true]) {
    let fail = true
    const f = fixture(t, () => {
      if (fail) { if (synchronous) throw Error('synthetic'); return Promise.reject(Error('synthetic')) }
      return import('../session/sessionView.mjs')
    })
    assert.equal(await f.start(), false)
    assert.match(f.root.querySelector('[role="alert"]').textContent, /kunne ikke indlæses.*Prøv igen/)
    assert.equal(f.root.querySelector('dialog'), null)
    fail = false
    const retry = button(f.root, 'Prøv igen')
    retry.fire('click'); retry.fire('click')
    await flush()
    assert.equal(f.imports, 2); assert.equal(f.mounts, 1)
    assert.ok(f.root.querySelector('dialog').open)
    assert.equal(f.root.querySelector('[role="alert"]').textContent, '')
    assert.equal(f.writes, 0)
  }
})

const replacements = {
  day: p => { p.now = new Date('2026-11-04T12:00:00Z') },
  athlete: p => { p.athlete = { id: 'synthetic-b' } },
  OFF: p => { p.enabled = false },
  holiday: p => { p.onHoliday = true },
  error: p => { p.programError = true },
  offline: p => { p.offlineSnapshotAt = 'synthetic' },
  writer: p => { p.onLogSet = undefined },
  week: p => { p.currentWeek = { ...p.currentWeek, id: 'synthetic-other-week' } },
  plan: p => { p.currentWeek.sessions[0].exercises[0].reps = 6 },
  completed: p => { p.exerciseLogs = [1, 2].map(n => ({ exercise_id: 'synthetic-exercise', set_number: n })) },
}
for (const [name, replace] of Object.entries(replacements)) {
  test(`late import is discarded after ${name}, with and without a host update`, async t => {
    for (const update of [false, true]) {
      const waiting = deferred(), f = fixture(t, () => waiting.promise), pending = f.start()
      await flush(); replace(f.p)
      if (update) f.bridge.update()
      waiting.resolve(await import('../session/sessionView.mjs'))
      assert.equal(await pending, false)
      assert.equal(f.mounts, 0); assert.equal(f.root.children.length, 0)
      assert.equal(f.root.getAttribute('aria-busy'), 'false')
      assert.equal(f.writes, 0); assert.equal(f.edits, 0)
    }
  })
}

test('live getNow is rechecked across Copenhagen midnight even without a rerender', async t => {
  const waiting = deferred(), f = fixture(t, () => waiting.promise)
  let now = new Date('2026-11-03T22:59:59Z')
  f.p.getNow = () => now
  const pending = f.start(); await flush()
  now = new Date('2026-11-03T23:00:01Z')
  waiting.resolve(await import('../session/sessionView.mjs'))
  assert.equal(await pending, false); assert.equal(f.mounts, 0)
})

test('cancelled/disposed import cannot reopen or replace a newer attempt, including late rejection', async t => {
  for (const reject of [false, true]) {
    const old = deferred(), next = deferred(), loads = [old, next]
    const f = fixture(t, () => loads.shift().promise), first = f.start()
    await flush(); const cancel = button(f.root, 'Annuller'); cancel.fire('click')
    assert.equal(f.root.children.length, 0)
    const second = f.start(); await flush(); cancel.fire('click')
    if (reject) old.reject(Error('synthetic old failure'))
    else old.resolve(await import('../session/sessionView.mjs'))
    assert.equal(await first, false)
    assert.equal(f.root.getAttribute('aria-busy'), 'true'); assert.equal(f.mounts, 0)
    next.resolve(await import('../session/sessionView.mjs'))
    assert.equal(await second, true); assert.equal(f.mounts, 1)
  }
  const late = deferred(), f = fixture(t, () => late.promise), pending = f.start()
  await flush(); f.bridge.dispose()
  late.reject(Error('synthetic disposed failure'))
  assert.equal(await pending, false)
  assert.equal(f.start(), false); assert.equal(f.root.children.length, 0)
})

test('stale error retry is inert after update, disposal or replacement; other roots remain untouched', async t => {
  for (const action of ['day', 'dispose', 'replacement']) {
    const f = fixture(t, () => Promise.reject(Error('synthetic')))
    const sibling = f.doc.createElement('aside'); sibling.textContent = 'keep'
    assert.equal(await f.start(), false)
    const retry = button(f.root, 'Prøv igen')
    if (action === 'day') { replacements.day(f.p); f.bridge.update() }
    if (action === 'dispose') f.bridge.dispose()
    if (action === 'replacement') { await f.start() }
    retry.fire('click'); await flush()
    assert.equal(f.imports, action === 'replacement' ? 2 : 1)
    assert.equal(f.mounts, 0); assert.equal(sibling.textContent, 'keep')
  }
})
