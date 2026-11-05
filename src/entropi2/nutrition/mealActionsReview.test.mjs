// Separate review checks against the final modules; no production changes here.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mountNutritionScreen } from './index.mjs'
import { createNutritionController } from './controller.mjs'
import { nutritionContracts } from './contracts.mjs'
import { mountNutrition } from './view.mjs'
import { syntheticHost, find, flush } from './synthetic-dom.mjs'

const meal = { meal: 'Synthetic review', kcal: 100, protein: 10, carb: 15, fat: 2 }
const row = { ...meal, id: 'review-row', athlete_id: 'review-atlet', date: '2026-11-03' }

test('independent review: full actual assembly log/edit/remove with synthetic database and strict OFF', async t => {
  let rows = [], writes = 0, loads = 0
  const client = { from(table) {
    assert.equal(table, 'meal_logs')
    let kind, value, filters = []
    const q = {
      select() { return q }, eq(...pair) { filters.push(pair); return q }, gte() { return q }, lte() { return q },
      async order() { loads++; return { data: rows.map(r => ({ ...r })), error: null } },
      async insert(v) { rows.push({ ...v, id: row.id }); writes++; return { error: null } },
      update(v) { kind = 'update'; value = v; return q }, delete() { kind = 'remove'; return q },
      then(resolve) {
        assert.deepEqual(filters, [['id', row.id], ['athlete_id', row.athlete_id], ['date', row.date]])
        const matches = rows.filter(r => filters.every(([k,v]) => r[k] === v)); writes++
        rows = kind === 'remove' ? rows.filter(r => !matches.includes(r)) : rows.map(r => matches.includes(r) ? { ...r, ...value } : r)
        resolve({ data: matches.map(r => ({ id: r.id })), error: null })
      },
    }; return q
  } }
  for (const enabled of [undefined, false, 'true', 1]) {
    const host = syntheticHost(); host.textContent = 'Legacy preserved'
    const poison = new Proxy({}, { get() { throw Error('OFF dependency touched') } })
    mountNutritionScreen(host, { entropi2: enabled, client: poison, storage: poison })()
    assert.equal(host.textContent, 'Legacy preserved')
  }
  const host = syntheticHost()
  t.after(mountNutritionScreen(host, { entropi2: true, client, athlete: { id: row.athlete_id }, date: row.date, clock: () => new Date('2026-11-05T12:00:00+01:00') }))
  await flush()
  const form = host.querySelectorAll('form')[0]
  for (const [i, value] of Object.values(meal).entries()) {
    const input = form.querySelectorAll('input')[i]; input.value = String(value); await input.fire('input')
  }
  await form.fire('submit')
  assert.equal(loads, 2); assert.equal(writes, 1)
  await find(host, 'button', 'Ret måltid: ' + meal.meal).fire('click')
  const editor = host.querySelectorAll('form').find(f => f.getAttribute('aria-label'))
  const input = editor.querySelectorAll('input')[1]; input.value = '200'; await input.fire('input')
  await editor.fire('submit'); assert.equal(rows[0].kcal, 200)
  await find(host, 'button', 'Fjern måltid: ' + meal.meal).fire('click')
  await find(host, 'button', 'Ja, fjern måltid').fire('click')
  assert.equal(writes, 3); assert.deepEqual(rows, [])
  assert.ok(host.textContent.includes('Ingen måltider registreret den valgte dag.'))
})

test('independent review: stale submit/confirmation double clicks cannot write twice', async t => {
  for (const kind of ['update', 'remove']) {
    let finish, writes = 0
    const c = createNutritionController({ enabled: true, athlete: { id: row.athlete_id }, date: row.date,
      contracts: { load: async () => [row], [kind]: () => { writes++; return new Promise(r => { finish = r }) } } })
    const host = syntheticHost(); t.after(mountNutrition(host, c, { clock: () => new Date('2026-11-05T12:00:00+01:00') })); await flush()
    await find(host, 'button', (kind === 'update' ? 'Ret' : 'Fjern') + ' måltid: ' + meal.meal).fire('click')
    const node = kind === 'update' ? host.querySelectorAll('form').find(f => f.getAttribute('aria-label')) : find(host, 'button', 'Ja, fjern måltid')
    const event = kind === 'update' ? 'submit' : 'click'
    const pending = node.fire(event); await node.fire(event)
    assert.equal(writes, 1); assert.equal(c.snapshot().totals.kcal, 100)
    finish(true); await pending; await node.fire(event); assert.equal(writes, 1)
  }
})

test('independent review: successful mutations preserve unrelated history and stored favorites', async () => {
  const earlier = { ...row, id: 'earlier', date: '2026-11-02' }
  let storageWrites = 0
  const c = createNutritionController({ enabled: true, athlete: { id: row.athlete_id }, date: row.date,
    storage: { getItem: () => JSON.stringify([meal]), setItem() { storageWrites++ } },
    contracts: { load: async () => [row, earlier], update: async () => true, remove: async () => true } })
  await c.load(); const before = c.snapshot()
  assert.equal(await c.update(earlier.id, meal, 'wrong-day'), false)
  assert.equal(await c.remove(earlier.id, 'wrong-day', true), false)
  assert.equal(await c.update(row.id, { ...meal, kcal: 200 }, 'revision'), true)
  assert.equal(await c.remove(row.id, 'removal', true), true)
  assert.deepEqual(c.snapshot().historyRows, [earlier]); assert.deepEqual(c.snapshot().yesterday, before.yesterday)
  assert.deepEqual(c.snapshot().favorites, before.favorites); assert.equal(storageWrites, 0); c.dispose()
})

test('independent review: read failure after insert offers retry without exposing local identities', async t => {
  let loads = 0
  const c = createNutritionController({ enabled: true, athlete: { id: row.athlete_id }, date: row.date,
    contracts: { load: async () => { if (++loads === 2) throw Error('synthetic read failure'); return loads === 1 ? [] : [row] },
      save: async () => true, update: async () => true, remove: async () => true } })
  const host = syntheticHost(); t.after(mountNutrition(host, c, { clock: () => new Date('2026-11-05T12:00:00+01:00') })); await flush()
  assert.equal(await c.log(meal, 'new-log'), true)
  assert.deepEqual(c.snapshot().editableIds, []); assert.equal(c.snapshot().needsRefresh, true)
  await find(host, 'button', 'Hent igen').fire('click')
  assert.deepEqual(c.snapshot().editableIds, [row.id]); assert.equal(c.snapshot().needsRefresh, false)
})

test('independent review: contracts reject malformed inputs and transport/malformed/zero-row results', async () => {
  let calls = 0
  const inert = nutritionContracts({ client: { from() { calls++; throw Error('unexpected') } } })
  for (const kind of ['update', 'remove']) {
    for (const invalid of [null, {}, { ...row, athlete_id: '' }, { ...row, date: '2026-02-30' }, { ...row, id: '' }]) {
      assert.equal(await inert[kind](invalid), false)
    }
  }
  assert.equal(calls, 0)
  for (const result of [undefined, { error: null }, { data: [{ id: row.id }, { id: row.id }], error: null }]) {
    const q = { delete() { return q }, update() { return q }, eq() { return q }, select: async () => result }
    const contracts = nutritionContracts({ client: { from: () => q } })
    for (const kind of ['update', 'remove']) {
      try { assert.equal(await contracts[kind](row), false) } catch (e) { assert.ok(e instanceof TypeError) }
    }
  }
})


test('independent review: stale or ambiguous identity reads preserve confirmed logs and never guess an ID', async () => {
  for (const response of [[row], [row, { ...row, id: 'new-1' }, { ...row, id: 'new-2' }], [{ ...row, id: 'unrelated', meal: 'Unrelated' }]]) {
    let reads = 0
    const c = createNutritionController({ enabled: true, athlete: { id: row.athlete_id }, date: row.date,
      contracts: { load: async () => ++reads === 1 ? [row] : response, save: async () => true,
        update: async () => true, remove: async () => true } })
    await c.load(); await c.log(meal, 'confirmed')
    assert.equal(c.snapshot().logs.length, 2); assert.equal(c.snapshot().totals.kcal, 200)
    assert.equal(c.snapshot().needsRefresh, true); assert.deepEqual(c.snapshot().editableIds, [row.id])
    c.dispose()
  }
})
