import test from 'node:test'
import assert from 'node:assert/strict'
import { createNutritionController, foodPortion } from './controller.mjs'
import { nutritionContracts } from './contracts.mjs'
import { mountNutritionScreen } from './index.mjs'
import { mountNutrition } from './view.mjs'
import { syntheticHost, find, flush } from './synthetic-dom.mjs'

const date = '2026-11-04', athleteId = 'synthetic-qol'
const meal = { meal: 'Synthetic bowl', kcal: 100, protein: 10, carb: 12, fat: 3 }
const foods = [
  { id: 'food-a', name: 'Synthetic oats', kcal100: 200, protein100: 10, carb100: 30, fat100: 4 },
  { id: 'food-b', name: 'Synthetic fruit', kcal100: 50, protein100: 1, carb100: 12, fat100: 0 },
  { id: 'food-a', name: 'Synthetic oats', isCustom: true, unit_label: 'skål', unit_grams: 80, kcal100: 200, protein100: 10, carb100: 30, fat100: 4 },
]
const portionKey = id => 'entropi2:nutrition:portions:v1:' + encodeURIComponent(id)
function fixture(t, options = {}) {
  const data = options.data || new Map(), writes = [], saves = [], removals = [], timers = new Map()
  let clock = 1000, serial = 0, timerId = 0
  const storage = {
    getItem(key) { if (options.readError && key === portionKey(athleteId)) throw Error('synthetic'); return data.get(key) ?? null },
    setItem(key, value) { if (options.writeError) throw Error('synthetic'); writes.push([key, value]); data.set(key, value) },
  }
  const contracts = {
    load: async () => options.rows || [],
    saveWithIdentity: async row => { saves.push(row); return options.save ? options.save(row) : { ok: true, id: 'insert-' + ++serial } },
    remove: async row => { removals.push(row); return options.remove ? options.remove(row) : true },
    update: async () => true,
  }
  const controller = createNutritionController({ enabled: true, athlete: { id: options.id || athleteId }, date,
    foods, storage, contracts, now: () => clock,
    schedule(fn, delay) { timers.set(++timerId, { fn, at: clock + delay }); return timerId },
    cancel(id) { timers.delete(id) }, ...options.controller })
  const host = syntheticHost(), cleanup = mountNutrition(host, controller, { clock: () => new Date('2026-11-05T12:00:00+01:00') })
  t.after(cleanup)
  return { controller, host, cleanup, data, writes, saves, removals, timers,
    advance(ms) { clock += ms; for (const [id, timer] of [...timers]) if (timer.at <= clock) { timers.delete(id); timer.fn() } } }
}
const amount = host => host.querySelectorAll('input').find(n => n.getAttribute('data-focus') === 'field-Mængde')
const foodChoice = host => host.querySelectorAll('select').find(n => n.getAttribute('data-focus') === 'food-choice')
const unitChoice = host => host.querySelectorAll('select').find(n => n.getAttribute('data-focus') === 'unit-choice')
const foodForm = host => find(host, 'button', 'Log portion').parentElement
async function input(node, value, event = 'input') { node.value = value; await node.fire(event) }

test('QOL: actual food form defaults to 100 g, six large gram actions clamp at 1 g and convert portions', async t => {
  const f = fixture(t); await flush()
  assert.equal(amount(f.host).value, '100')
  assert.equal(f.writes.length + f.saves.length, 0)
  for (const label of ['−10 g', '+10 g', '−50 g', '+50 g', '−100 g', '+100 g']) assert.ok(find(f.host, 'button', label))
  await find(f.host, 'button', '+50 g').fire('click')
  assert.equal(amount(f.host).value, '150')
  await find(f.host, 'button', '−100 g').fire('click')
  await find(f.host, 'button', '−100 g').fire('click')
  assert.equal(amount(f.host).value, '1')
  await input(foodChoice(f.host), '2', 'change')
  await input(unitChoice(f.host), '1', 'change')
  await input(amount(f.host), '1,5')
  await find(f.host, 'button', '+10 g').fire('click')
  assert.equal(amount(f.host).value, '130'); assert.equal(unitChoice(f.host).value, '0')
  await foodForm(f.host).fire('submit')
  assert.deepEqual(f.saves[0], { athlete_id: athleteId, date, ...foodPortion(foods[2], 130) })
  assert.equal(f.controller.foodAmount(2), 130)
  assert.equal(f.writes[0][0], portionKey(athleteId))
})

test('QOL: successful amounts survive remount per athlete and food; custom food cannot collide', async t => {
  const f = fixture(t); await flush()
  await input(amount(f.host), '137,5'); await foodForm(f.host).fire('submit')
  await input(foodChoice(f.host), '1', 'change'); assert.equal(amount(f.host).value, '100')
  await input(amount(f.host), '60'); await foodForm(f.host).fire('submit')
  await input(foodChoice(f.host), '0', 'change'); assert.equal(amount(f.host).value, '137.5')
  assert.equal(f.controller.foodAmount(2), 100)
  f.cleanup()
  const again = fixture(t, { data: f.data }); await flush()
  assert.equal(amount(again.host).value, '137.5'); assert.equal(again.controller.foodAmount(1), 60)
  const other = fixture(t, { data: f.data, id: 'synthetic-other' }); await flush()
  assert.equal(amount(other.host).value, '100')
  assert.equal(again.writes.length + other.writes.length, 0)
  assert.ok(f.writes.every(([key]) => key === portionKey(athleteId)))
})

test('QOL: pending food save blocks double submit; a failure retains draft and remembered successful amount', async t => {
  let finish, ok = true
  const f = fixture(t, { save: () => ok ? { ok: true, id: 'first' } : new Promise(r => { finish = r }) }); await flush()
  await input(amount(f.host), '80'); await foodForm(f.host).fire('submit')
  ok = false; await input(amount(f.host), '160')
  const oldForm = foodForm(f.host), pending = oldForm.fire('submit'); await oldForm.fire('submit')
  assert.equal(f.saves.length, 2)
  assert.ok(find(f.host, 'button', '+100 g').disabled)
  finish({ ok: false }); await pending
  assert.equal(f.controller.snapshot().logs.length, 1)
  assert.equal(f.controller.foodAmount(0), 80); assert.equal(amount(f.host).value, '160')
  assert.match(f.host.textContent, /Måltidet blev ikke gemt/)
})

test('QOL: invalid food amounts and missing nutrients never write or erase a default', async t => {
  const f = fixture(t); await flush()
  for (const value of ['', 'bad', '-1', '0', 'Infinity']) {
    await input(amount(f.host), value); await foodForm(f.host).fire('submit')
  }
  assert.equal(await f.controller.logFood(1000, 50, 0, 'invalid-food'), false)
  assert.equal(await f.controller.logFood(0, 50, 999, 'invalid-unit'), false)
  assert.equal(f.controller.foodAmount(0), 100)
  assert.equal(f.saves.length + f.writes.length, 0)
  const missing = fixture(t, { controller: { foods: [{ ...foods[0], protein100: null }] } }); await flush()
  await foodForm(missing.host).fire('submit')
  assert.equal(missing.saves.length + missing.writes.length, 0)
  assert.match(missing.host.textContent, /Udfyld måltid og gyldige næringsværdier/)
})

test('QOL: corrupt/denied portion storage is visible, uses 100 g and does not prevent a valid log', async t => {
  for (const options of [{ readError: true }, { data: new Map([[portionKey(athleteId), '{broken']]) },
    { data: new Map([[portionKey(athleteId), JSON.stringify([['bad', -20]])]]) }, { writeError: true }]) {
    const f = fixture(t, options); await flush()
    assert.equal(amount(f.host).value, '100')
    if (!options.writeError) assert.match(f.host.textContent, /Sidste mængder kunne ikke læses/)
    await input(amount(f.host), '150'); await foodForm(f.host).fire('submit')
    assert.equal(f.controller.snapshot().logs.length, 1)
    if (options.writeError) {
      assert.ok(f.host.querySelectorAll('p').some(n => n.getAttribute('role') === 'alert' && n.textContent.includes('mængden kunne ikke huskes')))
      assert.equal(f.controller.foodAmount(0), 150)
    }
  }
})

test('QOL: one-tap favorite and explicit recent repeat retain the meal values and one action per identity', async t => {
  const recent = { ...meal, meal: 'Synthetic recent', athlete_id: athleteId, date: '2026-11-01' }
  const data = new Map([['entropi2:nutrition:favorites:v1:' + athleteId, JSON.stringify([meal])]])
  const f = fixture(t, { data, rows: [recent] }); await flush()
  await find(f.host, 'button', 'Log ' + meal.meal).fire('click')
  await find(f.host, 'button', 'Gentag dette måltid: ' + recent.meal).fire('click')
  assert.deepEqual(f.saves.map(r => r.meal), [meal.meal, recent.meal])
  assert.equal(f.host.querySelectorAll('button').filter(n => n.textContent === 'Gentag dette måltid: ' + recent.meal).length, 1)
})

test('QOL: actual save -> undo removes only returned ID, updates totals/history, and stale double click is inert', async t => {
  const f = fixture(t); await flush()
  await f.controller.log(meal, 'save-one')
  assert.equal(f.controller.snapshot().logs[0].id, 'insert-1')
  assert.equal(f.controller.snapshot().undo.expiresAt, 6000)
  const undo = find(f.host, 'button', 'Fortryd')
  assert.ok(undo); assert.match(f.host.textContent, /Fortryd inden 5 sekunder/)
  await undo.fire('click'); await undo.fire('click')
  assert.deepEqual(f.removals, [{ id: 'insert-1', athlete_id: athleteId, date }])
  assert.deepEqual(f.controller.snapshot().logs, []); assert.deepEqual(f.controller.snapshot().historyRows, [])
  assert.equal(f.controller.snapshot().totals.kcal, 0)
  assert.equal(f.controller.snapshot().undo, null); assert.equal(f.timers.size, 0)
  assert.match(f.host.textContent, /Måltid fortrudt/)
})

test('QOL: undo accepts at 4999 ms but closes exactly at 5000 ms and hides without another action', async t => {
  const first = fixture(t); await flush(); await first.controller.log(meal, 'one')
  first.advance(4999); assert.equal(await first.controller.undoLog('one', 'undo'), true)
  const second = fixture(t); await flush(); await second.controller.log(meal, 'two')
  const stale = find(second.host, 'button', 'Fortryd')
  second.advance(5000)
  assert.equal(find(second.host, 'button', 'Fortryd'), undefined)
  await stale.fire('click'); assert.equal(second.removals.length, 0)
  assert.equal(second.controller.snapshot().logs.length, 1)
})

test('QOL: new saves replace the undo target; stale button cannot remove either meal', async t => {
  const f = fixture(t); await flush()
  await f.controller.log(meal, 'one'); const stale = find(f.host, 'button', 'Fortryd')
  await f.controller.log({ ...meal, meal: 'Synthetic second' }, 'two')
  await stale.fire('click'); assert.equal(f.removals.length, 0)
  await find(f.host, 'button', 'Fortryd').fire('click')
  assert.equal(f.removals[0].id, 'insert-2')
  assert.deepEqual(f.controller.snapshot().logs.map(r => r.id), ['insert-1'])
})

test('QOL: failed undo retains diary and can retry only within the original window', async t => {
  let ok = false
  const f = fixture(t, { remove: async () => ok }); await flush()
  await f.controller.log(meal, 'one'); await find(f.host, 'button', 'Fortryd').fire('click')
  assert.equal(f.controller.snapshot().logs.length, 1)
  assert.equal(f.controller.snapshot().totals.kcal, meal.kcal)
  assert.match(f.host.textContent, /Måltidet blev ikke fortrudt. Det er stadig gemt/)
  ok = true; await find(f.host, 'button', 'Fortryd').fire('click')
  assert.equal(f.controller.snapshot().logs.length, 0)
})

test('QOL: pending undo blocks all mutations and duplicate requests, with no optimistic totals', async t => {
  let finish
  const f = fixture(t, { remove: () => new Promise(r => { finish = r }) }); await flush()
  await f.controller.log(meal, 'one')
  const pending = f.controller.undoLog('one', 'undo')
  assert.equal(await f.controller.undoLog('one', 'again'), false)
  assert.equal(await f.controller.log(meal, 'two'), false)
  assert.equal(await f.controller.load(), false)
  assert.equal(f.controller.snapshot().logs.length, 1)
  f.advance(5000); finish(true); assert.equal(await pending, true)
  assert.equal(f.removals.length, 1); assert.equal(f.controller.snapshot().logs.length, 0)
})

test('QOL: editing/removing saved row invalidates undo; dispose clears timer and blocks stale handlers', async t => {
  for (const operation of ['update', 'remove']) {
    const f = fixture(t); await flush(); await f.controller.log(meal, 'one')
    if (operation === 'update') await f.controller.update('insert-1', { ...meal, kcal: 200 }, 'edit')
    else await f.controller.remove('insert-1', 'remove', true)
    assert.equal(await f.controller.undoLog('one', 'undo'), false)
    assert.equal(f.timers.size, 0)
  }
  const f = fixture(t); await flush(); await f.controller.log(meal, 'one')
  const stale = find(f.host, 'button', 'Fortryd'); f.cleanup()
  assert.equal(f.timers.size, 0); await stale.fire('click'); assert.equal(f.removals.length, 0)
})

test('QOL: missing, duplicate or local insert identities never offer unsafe undo or repeat an insert', async t => {
  for (const id of [null, '', 'local:unsafe']) {
    const f = fixture(t, { save: async () => ({ ok: true, id }) }); await flush()
    assert.equal(await f.controller.log(meal, 'one'), true)
    assert.equal(find(f.host, 'button', 'Fortryd'), undefined)
    assert.equal(f.saves.length, 1); assert.equal(f.controller.snapshot().logs.length, 1)
    assert.match(f.host.textContent, /Fortryd kunne ikke klargøres/)
    assert.equal(await f.controller.undoLog('one', 'undo'), false)
  }
  const f = fixture(t, { save: async () => ({ ok: true, id: 'duplicate' }),
    rows: [{ ...meal, athlete_id: athleteId, date, id: 'duplicate' }] }); await flush()
  await f.controller.log(meal, 'one'); assert.equal(f.controller.snapshot().undo, null)
})

test('QOL: disposal during save produces no late local persistence/timer; other-day log has no wrong-day undo', async t => {
  let finish
  const f = fixture(t, { save: () => new Promise(r => { finish = r }) }); await flush()
  const pending = f.controller.logFood(0, 180, 0, 'late'); f.cleanup()
  finish({ ok: true, id: 'late-id' }); assert.equal(await pending, false)
  assert.equal(f.writes.length + f.timers.size, 0)
  const next = fixture(t, { controller: { currentDay: () => '2026-11-05' } }); await flush()
  await next.controller.log(meal, 'midnight')
  assert.equal(next.saves[0].date, '2026-11-05'); assert.equal(next.controller.snapshot().undo, null)
})

test('QOL: insert-returning adapter validates input, selects only id, and does not insert twice on missing identity', async () => {
  for (const result of [{ data: [{ id: 'exact-id' }], error: null }, { data: [], error: null },
    { data: [{ id: 'one' }, { id: 'two' }], error: null }, { data: [{ id: 'local:bad' }], error: null },
    { data: [{ id: 'denied' }], error: { message: 'synthetic denial' } }]) {
    const trace = []
    const c = nutritionContracts({ client: { from(table) { trace.push(['from', table]); return {
      insert(value) { trace.push(['insert', value]); return { async select(fields) { trace.push(['select', fields]); return result } } },
    } } } })
    const row = { ...meal, athlete_id: athleteId, date }
    const answer = await c.saveWithIdentity({ ...row, id: 'ignored', unknown: 'ignored' })
    assert.equal(answer.ok, !result.error)
    assert.equal(answer.id, result.data.length === 1 && result.data[0].id === 'exact-id' ? 'exact-id' : null)
    assert.deepEqual(trace, [['from', 'meal_logs'], ['insert', row], ['select', 'id']])
    assert.deepEqual(await c.saveWithIdentity({ ...row, meal: ' [appData2-day-v1]receipt' }), { ok: false, id: null })
    assert.equal(trace.length, 3)
  }
})

test('QOL: actual assembly insertion and undo exercise guarded scoped client chain', async t => {
  const trace = [], rows = []
  const client = { from(table) {
    assert.equal(table, 'meal_logs')
    const query = { select() { return query }, eq() { return query }, gte() { return query }, lte() { return query },
      async order() { return { data: rows, error: null } },
      insert(value) { trace.push(['insert', value]); rows.push({ ...value, id: 'exact-insert' }); return {
        async select(fields) { trace.push(['return', fields]); return { data: [{ id: 'exact-insert' }], error: null } },
      } },
      delete() { const filters = []; return { eq(k, v) { filters.push([k, v]); return this }, async select(fields) {
        trace.push(['delete', filters, fields]); return { data: [{ id: 'exact-insert' }], error: null }
      } } },
    }; return query
  } }
  const host = syntheticHost()
  t.after(mountNutritionScreen(host, { entropi2: true, athlete: { id: athleteId }, date, client, foods, clock: () => new Date('2026-11-05T12:00:00+01:00') }))
  await flush(); await foodForm(host).fire('submit')
  assert.ok(find(host, 'button', 'Fortryd'))
  await find(host, 'button', 'Fortryd').fire('click')
  assert.deepEqual(trace[2], ['delete', [['id', 'exact-insert'], ['athlete_id', athleteId], ['date', date]], 'id'])
  assert.equal(trace.length, 3); assert.match(host.textContent, /Ingen måltider registreret den valgte dag/)
})

test('QOL: empty/load-error screens retain honest empty state/retry; strict OFF touches nothing', async t => {
  const empty = fixture(t); await flush()
  assert.match(empty.host.textContent, /Ingen måltider registreret den valgte dag/)
  assert.equal(find(empty.host, 'h2', 'Favoritter'), undefined)
  assert.equal(find(empty.host, 'button', 'Fortryd'), undefined)
  const broken = fixture(t, { controller: { contracts: { load: async () => { throw Error('synthetic') } } } }); await flush()
  assert.ok(find(broken.host, 'button', 'Hent kostloggen igen'))
  assert.equal(find(broken.host, 'button', 'Log portion'), undefined)
  const poison = new Proxy({}, { get() { throw Error('OFF access') } })
  for (const entropi2 of [undefined, false, 'true', 1]) {
    const host = syntheticHost(); host.textContent = 'Existing screen'
    mountNutritionScreen(host, { entropi2, athlete: poison, storage: poison, foods: poison, client: poison })()
    assert.equal(host.textContent, 'Existing screen')
  }
})
