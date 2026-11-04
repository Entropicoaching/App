import test from 'node:test'
import assert from 'node:assert/strict'
import { createQuickController, UNDO_MS } from './controller.mjs'
import { preferenceKey } from './model.mjs'
import { athleteId, date, data, meal, scores, manualClock } from './testFixtures.mjs'

function fixture(t, extra = {}) {
  const time = manualClock(), calls = [], writes = []
  const save = Object.fromEntries(['readiness', 'weight', 'meal'].map(kind => [kind, async value => { calls.push({ kind, value }); return true }]))
  const controller = createQuickController({ enabled: true, athleteId, date, data: data(), clock: time.clock,
    save, storage: { getItem() { return null }, setItem(...args) { writes.push(args) } }, ...extra })
  t.after(() => { controller.dispose(); assert.equal(time.handles(), 0) })
  return { controller, calls, writes, ...time }
}

test('strict OFF never reads any other option or creates side effects', () => {
  for (const enabled of [undefined, false, null, 0, 1, 'true']) {
    const options = new Proxy({ enabled }, { get(target, key) { if (key === 'enabled') return target.enabled; throw Error('OFF read') } })
    assert.equal(createQuickController(options), null)
  }
})

test('five-second grace, one immutable payload, one commit and no optimistic success', async t => {
  const f = fixture(t), c = f.controller
  assert.equal(c.save('readiness'), true)
  assert.equal(c.snapshot().phase, 'pending'); assert.equal(f.calls.length, 0)
  assert.equal(c.save('readiness'), false); assert.equal(c.save('meal'), false)
  assert.equal(c.setField('readiness', 'energy', '5'), false)
  assert.equal(c.sameAsYesterday(), false)
  await f.advance(UNDO_MS - 1); assert.equal(f.calls.length, 0)
  await f.advance(1)
  assert.deepEqual(f.calls, [{ kind: 'readiness', value: { athlete_id: athleteId, logged_date: date, ...scores } }])
  assert.equal(c.snapshot().phase, 'saved'); assert.equal(f.handles(), 0)
  assert.equal(c.save('readiness'), false); assert.match(c.snapshot().message, /allerede gemt/)
  assert.deepEqual(f.writes, [])
})

test('undo at 4999ms never calls a write; input survives; a deliberate retry works', async t => {
  const f = fixture(t), c = f.controller
  c.save('weight'); await f.advance(4999)
  assert.equal(c.undo(), true); assert.equal(c.undo(), false)
  await f.advance(10000); assert.deepEqual(f.calls, [])
  assert.equal(c.snapshot().draft.weight, '80.2'); assert.equal(f.handles(), 0)
  c.save('weight'); await f.advance(5000)
  assert.deepEqual(f.calls, [{ kind: 'weight', value: { athlete_id: athleteId, logged_at: date, weight: 80.2 } }])
})

test('undo at exact deadline starts only one commit even if timer event is delayed', async t => {
  const f = fixture(t), c = f.controller
  c.save('weight'); f.setNow(c.snapshot().deadline)
  assert.equal(c.undo(), false)
  await f.advance(0); await f.advance(10000)
  assert.equal(f.calls.length, 1); assert.equal(c.snapshot().phase, 'saved')
})

test('early scheduler callback reschedules remaining grace instead of committing early', async t => {
  const f = fixture(t)
  f.controller.save('weight'); f.fireEarly()
  assert.equal(f.calls.length, 0); assert.equal(f.handles(), 1)
  await f.advance(5000); assert.equal(f.calls.length, 1); assert.equal(f.handles(), 0)
})

test('slow saves block replay; false/object/throw/rejection retain input and allow retry', async t => {
  let resolve, attempt = 0
  const c = fixture(t, { save: { weight: value => {
    assert.equal(value.weight, 80.2)
    attempt++
    if (attempt === 1) return new Promise(r => { resolve = r })
    if (attempt === 2) return { error: null }
    if (attempt === 3) throw Error('synthetic failure')
    if (attempt === 4) return Promise.reject(Error('synthetic rejection'))
    return true
  } } })
  c.controller.save('weight'); await c.advance(5000)
  assert.equal(c.controller.snapshot().phase, 'saving')
  assert.equal(c.controller.save('weight'), false); assert.equal(c.controller.undo(), false)
  resolve(false); await c.advance(0)
  assert.equal(c.controller.snapshot().phase, 'save-error')
  for (let i = 0; i < 3; i++) {
    assert.equal(c.controller.save('weight'), true); await c.advance(5000)
    assert.equal(c.controller.snapshot().phase, 'save-error')
    assert.equal(c.controller.snapshot().draft.weight, '80.2')
  }
  c.controller.save('weight'); await c.advance(5000)
  assert.equal(c.controller.snapshot().phase, 'saved'); assert.equal(attempt, 5)
})

test('required fields and missing adapters never schedule; other forms remain optional', async t => {
  const f = fixture(t, { data: data({ readinessRows: [], weightRows: [], mealRows: [] }) }), c = f.controller
  for (const kind of ['readiness', 'weight', 'meal']) assert.equal(c.save(kind), false)
  assert.equal(f.handles(), 0); assert.deepEqual(f.calls, [])
  c.setField('weight', 'weight', '79,5'); assert.equal(c.save('weight'), true)
  await f.advance(5000); assert.equal(f.calls[0].value.weight, 79.5)
  const disconnected = fixture(t, { save: {} })
  assert.equal(disconnected.controller.save('weight'), false); assert.equal(disconnected.handles(), 0)
  assert.match(disconnected.controller.snapshot().message, /ikke tilsluttet/)
})

test('repeat is one local action, never writes, and absent domains do not erase today', t => {
  const f = fixture(t), c = f.controller
  c.setField('readiness', 'energy', '5'); c.setField('weight', 'weight', '82')
  assert.equal(c.sameAsYesterday(), true)
  assert.equal(c.snapshot().draft.readiness.energy, '3'); assert.equal(c.snapshot().draft.weight, '80.2')
  assert.equal(f.handles(), 0); assert.deepEqual(f.calls, []); assert.deepEqual(f.writes, [])
  const g = fixture(t, { data: data({ readinessRows: [{ athlete_id: athleteId, logged_date: date, ...scores }] }) })
  g.controller.setField('readiness', 'energy', '5'); g.controller.sameAsYesterday()
  assert.equal(g.controller.snapshot().draft.readiness.energy, '5')
  assert.equal(g.controller.snapshot().draft.weight, '80.2')
})

test('last meal selection persists in own athlete namespace and restores across dates', t => {
  const values = new Map(), writes = []
  const storage = { getItem: key => values.get(key) ?? null,
    setItem(key, value) { writes.push([key, value]); values.set(key, value) } }
  const a = fixture(t, { storage }), key = a.controller.snapshot().meals[0].key
  assert.equal(a.controller.selectMeal(key), true)
  assert.equal(writes.length, 1); assert.equal(writes[0][0], preferenceKey(athleteId))
  assert.deepEqual(JSON.parse(writes[0][1]), { version: 1, mealKey: key })
  assert.equal(a.controller.selectMeal('unknown'), false); assert.equal(writes.length, 1)
  const next = fixture(t, { date: '2026-11-05', storage })
  assert.equal(next.controller.snapshot().selectedMeal, key)
  const foreign = fixture(t, { athleteId: 'synthetic-other', storage })
  assert.equal(foreign.controller.snapshot().selectedMeal, '')
})

test('corrupt/blocked/stale preference gives honest feedback without disabling logging', t => {
  for (const storage of [{ getItem() { throw Error() }, setItem() { throw Error() } },
    { getItem() { return '{bad' }, setItem() { throw Error() } }]) {
    const { controller: c } = fixture(t, { storage })
    assert.match(c.snapshot().preferenceMessage, /kunne ikke læses/)
    const key = c.snapshot().meals[0].key
    assert.equal(c.selectMeal(key), true); assert.equal(c.snapshot().selectedMeal, key)
    assert.match(c.snapshot().preferenceMessage, /kun, mens/)
  }
  const { controller: c } = fixture(t, { storage: { getItem() { return JSON.stringify({ version: 1, mealKey: 'missing' }) } } })
  assert.equal(c.snapshot().selectedMeal, '')
})

test('meal save includes only exact existing nutrients, allows fresh deliberate repetitions', async t => {
  const f = fixture(t), c = f.controller
  c.selectMeal(c.snapshot().meals[0].key)
  for (let i = 0; i < 2; i++) { assert.equal(c.save('meal'), true); await f.advance(5000) }
  assert.equal(f.calls.length, 2)
  assert.deepEqual(f.calls[0], { kind: 'meal', value: { athlete_id: athleteId, date, meal: meal().meal, kcal: 320, protein: 22, carb: 44, fat: 8 } })
})

test('changing calendar day at click or during grace prevents a stale write', async t => {
  let today = date
  const f = fixture(t, { currentDay: () => today })
  f.controller.save('weight'); today = '2026-11-05'; await f.advance(5000)
  assert.deepEqual(f.calls, []); assert.match(f.controller.snapshot().message, /Dagen er skiftet/)
  assert.equal(f.controller.save('weight'), false); assert.equal(f.handles(), 0)
})

test('cancel on navigation and dispose clear every timer and stale closure', async t => {
  for (const method of ['cancelPending', 'dispose']) {
    const f = fixture(t), c = f.controller
    c.save('weight'); c[method](); await f.advance(10000)
    assert.deepEqual(f.calls, []); assert.equal(f.handles(), 0)
    if (method === 'dispose') {
      assert.equal(c.save('weight'), false); assert.equal(c.selectMeal(c.snapshot().meals[0].key), false)
    }
  }
})

test('snapshot identity is stable and deeply immutable; unsubscribe stops notifications', t => {
  const { controller: c } = fixture(t)
  const first = c.snapshot(); assert.equal(first, c.snapshot())
  assert.throws(() => { first.draft.readiness.energy = '5' }, TypeError)
  assert.throws(() => { first.meals[0].value.kcal = 999 }, TypeError)
  let calls = 0; const unsubscribe = c.subscribe(() => calls++)
  c.setField('weight', 'weight', '83'); assert.equal(calls, 1)
  assert.notEqual(first, c.snapshot()); assert.equal(c.snapshot().draft.weight, '83')
  unsubscribe(); c.sameAsYesterday(); assert.equal(calls, 1)
})

test('loading, incomplete and invalid snapshots never produce empty-ready or storage reads', t => {
  for (const source of [{ status: 'loading' }, { status: 'error' }, data({ complete: false }), data({ weightRows: null })]) {
    const f = fixture(t, { data: source, storage: { getItem() { throw Error('unexpected storage read') } } })
    assert.equal(f.controller.snapshot().phase, source.status === 'loading' ? 'loading' : 'error')
    assert.equal(f.controller.save('weight'), false); assert.equal(f.handles(), 0)
  }
})
