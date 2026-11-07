import test from 'node:test'
import assert from 'node:assert/strict'
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { createSessionController } from './sessionModel.mjs'
import { sessionReactDocument } from './sessionQuickSetReactDom.mjs'
import HomeSession from '../home/HomeSession.mjs'
import SessionScreen from './SessionScreen.mjs'

// Independent synthetic host data; every decision is made by the copied controller.
function fixture(t) {
  const ex = { id: 'life-ex', name: 'Lifecycle', sets: 4, reps: 5, recommended_weight: 40 }
  const week = { id: 'life-week', athlete_id: 'life-owner', start_date: '2026-11-02',
    sessions: [{ id: 'life-session', exercises: [ex] }] }
  const calls = []
  const p = { enabled: true, athleteId: week.athlete_id, athlete: { id: week.athlete_id },
    allWeeks: [week], currentWeek: week, exerciseLogs: [], logInputs: {}, pendingSyncKeys: [], parkedSets: [],
    now: new Date('2026-11-03T10:00:00Z'), storage: null, parsePlannedRpe: () => 7,
    setLogInputs(fn) { p.logInputs = fn(p.logInputs) },
    onSkipSet(id, n) { calls.push(['skip', id, n]) },
    onUnskipSet(id, n) { calls.push(['undo', id, n]) },
    onLogSet(exercise, n) { calls.push(['log', exercise.id, n]); p.exerciseLogs.push(row(n, false)) } }
  const row = (n, skipped = true, extra = {}) => ({ athlete_id: p.athleteId,
    exercise_id: ex.id, set_number: n, skipped, weight: skipped ? null : 40,
    reps_completed: skipped ? null : 5, ...extra })
  const c = createSessionController(() => p); c.start(); t.after(() => c.dispose())
  const skip = () => { const s = c.state(); return c.skipSet(s.key, s.selection.stamp) }
  const undo = n => c.unskipSet(`${ex.id}_${n}`, c.state().selection.stamp)
  const approve = () => { const s = c.state(); return c.approve(s.key, s.input, s.selection.stamp) }
  return { p, c, calls, row, skip, undo, approve, ex }
}

test('confirmed skip retires: later missing/completed old slot and a new log do not reopen it', async t => {
  const f = fixture(t)
  assert.equal(await f.skip(), false)
  f.p.exerciseLogs = [f.row(1)]; assert.equal(f.c.state().skip.busy, false)
  f.p.exerciseLogs = []; assert.equal(f.c.state().skip.busy, false)
  f.p.exerciseLogs = [f.row(1, false)]; assert.equal(f.c.state().skip.busy, false)
  assert.equal(await f.approve(), true)
  assert.equal(f.c.state().next.setNumber, 3)
  assert.equal(f.c.state().skip.canSet, true)
  assert.deepEqual(f.calls, [['skip', f.ex.id, 1], ['log', f.ex.id, 2]])
})

test('confirmed undo retires independently before re-skip and normal same-key completion', async t => {
  const f = fixture(t)
  f.p.exerciseLogs = [f.row(1)]
  assert.equal(await f.undo(1), false)
  f.p.exerciseLogs = []; assert.equal(f.c.state().skip.busy, false)
  assert.equal(await f.skip(), false)
  f.p.exerciseLogs = [f.row(1)]; assert.equal(f.c.state().skip.busy, false)
  assert.equal(await f.undo(1), false)
  f.p.exerciseLogs = []; assert.equal(f.c.state().skip.busy, false)
  assert.equal(await f.approve(), true)
  assert.equal(f.c.state().next.setNumber, 2)
  assert.equal(f.c.state().skip.canSet, true)
  assert.deepEqual(f.calls.map(c => c[0]), ['undo', 'skip', 'undo', 'log'])
})

for (const kind of ['skip', 'undo']) for (const mode of ['loading', 'error', 'queued', 'parked', 'optimistic'])
  test(`${kind}: ${mode} host evidence cannot retire an operation`, async t => {
    const f = fixture(t), key = `${f.ex.id}_1`
    if (kind === 'undo') f.p.exerciseLogs = [f.row(1)]
    assert.equal(await (kind === 'undo' ? f.undo(1) : f.skip()), false)
    f.p.exerciseLogs = kind === 'undo' ? [] : [f.row(1)]
    if (mode === 'loading') f.p.exerciseLogsLoading = true
    if (mode === 'error') f.p.exerciseLogsError = true
    if (mode === 'queued') f.p.pendingSyncKeys = [key]
    if (mode === 'parked') f.p.parkedSets = [{ exerciseId: f.ex.id, setNumber: 1 }]
    if (mode === 'optimistic') f.p.exerciseLogs = [f.row(1, true, { _optimistic: true })]
    assert.equal(f.c.state().skip.busy, true)
    assert.equal(await f.skip(), false); assert.equal(f.calls.length, 1)
    // Remove the ambiguous snapshot first: it must not have permanently settled.
    f.p.exerciseLogs = kind === 'undo' ? [f.row(1)] : []
    f.p.exerciseLogsLoading = false; f.p.exerciseLogsError = false
    f.p.pendingSyncKeys = []; f.p.parkedSets = []
    assert.equal(f.c.state().skip.busy, true)
    f.p.exerciseLogs = kind === 'undo' ? [] : [f.row(1)]
    assert.equal(f.c.state().skip.busy, false)
    f.p.exerciseLogs = [f.row(1, false)]
    assert.equal(f.c.state().skip.busy, false)
    assert.equal(f.c.state().skip.canSet, true)
    assert.equal(f.calls.length, 1)
  })

for (const result of [undefined, true]) test(`resolved ${String(result)} is not matching host evidence`, async t => {
  const f = fixture(t); f.p.onSkipSet = () => { f.calls.push(['skip']); return result }
  assert.equal(await f.skip(), false)
  f.p.exerciseLogs = [f.row(1, false)]
  assert.equal(f.c.state().skip.busy, true, 'a completed row is not confirmation of skip')
  f.p.exerciseLogs = [f.row(1, true, { athlete_id: 'foreign' })]
  assert.equal(f.c.state().skip.busy, true)
  f.p.exerciseLogs = []; assert.equal(await f.skip(), false)
  assert.equal(f.calls.length, 1)
})

test('transient missing skip stays pending; explicit failure permits only a deliberate new operation', async t => {
  const f = fixture(t)
  assert.equal(await f.skip(), false)
  f.c.refresh(); assert.equal(f.c.state().skip.busy, true)
  assert.equal(await f.approve(), false); assert.equal(f.calls.length, 1)
  f.p.exerciseLogs = [f.row(1)]; assert.equal(f.c.state().skip.busy, false)
  f.p.onUnskipSet = () => { f.calls.push(['failed undo']); return false }
  assert.equal(await f.undo(1), false)
  assert.equal(f.c.state().skip.busy, false)
  assert.match(f.c.state().error, /kunne ikke bekræftes/)
  f.p.exerciseLogs = []; f.c.refresh(); assert.equal(f.calls.length, 2)
  assert.equal(await f.approve(), true)
  assert.equal(f.c.state().skip.canSet, true)
})

for (const result of ['resolve', 'reject']) test(`in-flight ${result} cannot settle early from a host row`, async t => {
  const f = fixture(t); let release, reject
  f.p.onSkipSet = () => { f.calls.push(['skip']); return new Promise((yes, no) => { release = yes; reject = no }) }
  const pending = f.skip()
  f.p.exerciseLogs = [f.row(1)]; assert.equal(f.c.state().skip.busy, true)
  if (result === 'resolve') release(); else reject(Error('synthetic'))
  assert.equal(await pending, result === 'resolve')
  assert.equal(f.c.state().skip.busy, false)
  f.p.exerciseLogs = [f.row(1, false)]; assert.equal(f.c.state().skip.busy, false)
  assert.equal(f.calls.length, 1)
})

// Actual consumers own calendar/owner revocation. The DOM and data are synthetic.
async function mounted(Component, p, run) {
  const doc = sessionReactDocument(), host = doc.createElement('div'), create = doc.createElement
  doc.createElement = tag => {
    const node = create(tag)
    if (tag === 'select') Object.defineProperty(node, 'options', { get: () => node.children.filter(n => n.tagName === 'OPTION') })
    return node
  }
  doc.body.append(host)
  const replacements = { window: doc.defaultView, IS_REACT_ACT_ENVIRONMENT: true,
    setInterval() { return 1 }, clearInterval() {} }
  const old = new Map(Object.keys(replacements).map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]))
  for (const [k, value] of Object.entries(replacements)) Object.defineProperty(globalThis, k, { configurable: true, value })
  const root = createRoot(host), tick = () => new Promise(resolve => setImmediate(resolve))
  const update = () => act(async () => { root.render(createElement(Component, { ...p })); await tick() })
  const button = text => host.querySelectorAll('button').find(n => n.textContent === text)
  const press = text => act(async () => {
    const node = button(text); assert.ok(node); assert.equal(node.disabled, false)
    if (node.events.get('click')?.size) node.click()
    else host.dispatch('click', { type: 'click', target: node, button: 0, bubbles: true, stopPropagation() {} })
    await tick()
  })
  let closed = false
  const close = async () => { if (!closed) { closed = true; await act(async () => root.unmount()) } }
  try { await update(); await run({ host, update, button, press, close, tick }) }
  finally {
    await close()
    for (const [k, descriptor] of old) {
      if (descriptor) Object.defineProperty(globalThis, k, descriptor); else delete globalThis[k]
    }
  }
}

for (const Component of [HomeSession, SessionScreen]) for (const transition of ['owner', 'dispose', ...(Component === HomeSession ? ['day'] : [])])
  test(`mounted ${Component.name}: unchanged pending callback after ${transition} cannot affect fresh session`, async t => {
    const f = fixture(t); let release
    const callback = () => { f.calls.push(['pending']); return new Promise(resolve => { release = resolve }) }
    f.p.onSkipSet = callback
    await mounted(Component, f.p, async ({ host, update, button, press, close, tick }) => {
      await press('Start dagens pas'); await press('Spring sættet over')
      const retained = button('Spring sættet over')
      assert.equal(retained.disabled, true); assert.equal(f.calls.length, 1)
      if (transition === 'dispose') await close()
      else {
        if (transition === 'day') f.p.now = new Date('2026-11-04T10:00:00Z')
        else {
          f.p.athleteId = 'replacement'; f.p.athlete = { id: 'replacement' }
          f.p.currentWeek.athlete_id = 'replacement'
        }
        await update(); assert.equal(host.querySelector('dialog'), null)
        await press('Start dagens pas')
        assert.equal(button('Spring sættet over').disabled, false)
      }
      await act(async () => { release(); await tick(); retained.click(); await tick() })
      assert.equal(f.p.onSkipSet, callback)
      assert.equal(f.calls.length, 1); assert.deepEqual(f.p.exerciseLogs, [])
      if (transition !== 'dispose') {
        assert.equal(button('Spring sættet over').disabled, false)
        assert.equal(host.querySelector('.approve').disabled, false)
      }
    })
  })
