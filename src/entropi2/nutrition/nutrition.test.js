import test from 'node:test'
import assert from 'node:assert/strict'
import { createNutritionController, foodPortion, mealKey } from './controller.mjs'
import { nutritionContracts } from './contracts.mjs'
import { mountNutrition } from './view.mjs'
import { mountNutritionScreen } from './index.mjs'
import { syntheticHost, find, flush } from './synthetic-dom.mjs'

const date = '2026-11-01'
const meal = { meal: 'Havregrød · 100 g', kcal: 120, protein: 5, carb: 19, fat: 3 }
const row = (overrides = {}) => ({ ...meal, athlete_id: 'synthetic-A', date, id: 'synthetic-row', ...overrides })
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }
function storageFake() {
  const data = new Map(), calls = []
  return { data, calls, getItem(k) { calls.push(['get', k]); return data.get(k) ?? null }, setItem(k, v) { calls.push(['set', k]); data.set(k, v) } }
}
function make(options = {}) {
  const saves = [], storage = storageFake()
  const contracts = { async load() { return [row()] }, async save(value) { saves.push(value); return true } }
  const c = createNutritionController({ enabled: true, athlete: { id: 'synthetic-A', kcal_target: '2200', protein_target: '140' }, date, contracts, storage, ...options })
  return { c, saves, storage }
}
// Implements only the meal_logs chain under test, with no connection or credentials.
function clientFake(rows = [row()]) {
  const calls = [], inserts = []
  const client = { calls, inserts, readError: null, writeError: null, writeGate: null,
    from(table) {
      calls.push(['from', table]); assert.equal(table, 'meal_logs')
      const q = {
        select(v) { calls.push(['select', v]); return q },
        eq(...args) { calls.push(['eq', ...args]); return q },
        gte(...args) { calls.push(['gte', ...args]); return q },
        lte(...args) { calls.push(['lte', ...args]); return q },
        async order(...args) { calls.push(['order', ...args]); return { data: rows, error: client.readError } },
        async insert(value) { inserts.push(value); if (client.writeGate) await client.writeGate.promise; return { error: client.writeError } },
      }
      return q
    },
  }
  return client
}

test('strict default OFF is inert, including truthy strings and missing options', () => {
  assert.equal(createNutritionController(), null)
  for (const entropi2 of [undefined, false, 'true', 1]) {
    const host = syntheticHost(); host.textContent = 'legacy'
    const poison = new Proxy({}, { get() { throw new Error('OFF accessed dependency') } })
    mountNutritionScreen(host, { entropi2, client: poison, storage: poison })()
    assert.equal(host.textContent, 'legacy')
    assert.equal(createNutritionController({ enabled: entropi2 }), null)
  }
})

test('actual adapter uses guarded reads/writes, actual fields, athlete and date filters', async () => {
  const client = clientFake(), errors = []
  const contracts = nutritionContracts({ client, onReadError: e => errors.push(e), onWriteError: e => errors.push(e) })
  assert.deepEqual(await contracts.load('synthetic-A', date), [row()])
  assert.ok(client.calls.some(v => JSON.stringify(v) === JSON.stringify(['eq', 'athlete_id', 'synthetic-A'])))
  assert.ok(client.calls.some(v => JSON.stringify(v) === JSON.stringify(['gte', 'date', '2026-10-02'])))
  assert.ok(client.calls.some(v => JSON.stringify(v) === JSON.stringify(['lte', 'date', date])))
  assert.equal(await contracts.save(row({ id: 'ignore-me' })), true)
  assert.deepEqual(client.inserts, [{ athlete_id: 'synthetic-A', date, ...meal }])
  client.writeError = { code: 'synthetic-failure' }
  assert.equal(await contracts.save(row()), false)
  client.readError = { code: 'synthetic-read' }
  await assert.rejects(contracts.load('synthetic-A', date))
  assert.equal(errors.length, 2)
  await assert.rejects(contracts.load('synthetic-A', '2026-02-30'))
})

test('cross-athlete reads fail closed and malformed/throwing reads are not empty success', async () => {
  await assert.rejects(nutritionContracts({ client: clientFake([row({ athlete_id: 'synthetic-B' })]) }).load('synthetic-A', date))
  for (const result of [null, {}, [row({ athlete_id: 'synthetic-B' })], [row({ date: '2026-02-30' })]]) {
    const { c } = make({ contracts: { async load() { return result } } })
    assert.equal(await c.load(), false); assert.equal(c.snapshot().phase, 'load-error')
  }
  const { c } = make({ contracts: { async load() { throw new Error('fake read failure') } } })
  await c.load(); assert.equal(c.snapshot().loaded, false)
})

test('today totals, actual goals, partial goals, no fake goal fallback, receipt excluded', async () => {
  const { c } = make({ contracts: { async load() { return [row(), row({ id: 'older', date: '2026-10-31' }), row({ meal: '[appData2-day-v1]receipt', kcal: 999 })] } } })
  await c.load()
  assert.deepEqual(c.snapshot().totals, { kcal: 120, protein: 5, carb: 19, fat: 3 })
  assert.deepEqual(c.snapshot().targets, { kcal: 2200, protein: 140 })
  assert.equal(c.snapshot().logs.length, 1)
  const unknown = make({ athlete: { id: 'synthetic-A', kcal_target: Infinity, protein_target: '0' } }).c
  assert.deepEqual(unknown.snapshot().targets, { kcal: null, protein: 0 })
})

test('actual portion unit and rounding functions: custom portions, built-in grams, comma, overflow', () => {
  const food = { name: 'Synthetic food', isCustom: true, unit_label: 'stk', unit_grams: '80', kcal100: '100', protein100: '10', carb100: '20', fat100: '5' }
  assert.deepEqual(foodPortion(food, '1,5', 1), { meal: 'Synthetic food · 1.5 stk (120 g)', kcal: 120, protein: 12, carb: 24, fat: 6 })
  assert.equal(foodPortion(food, '100', 0).meal, 'Synthetic food · 100 g')
  for (const n of ['bad', -1, Infinity, '', '1e309', 0]) assert.equal(foodPortion(food, n), null)
  assert.equal(foodPortion({ ...food, kcal100: '' }, 100), null)
  assert.equal(foodPortion(food, 1e308, 1), null)
  assert.equal(foodPortion(food, 10, 99), null)
})

test('pending deduplicates double actions; save errors roll back; successful intent replay is inert', async () => {
  const gate = deferred(), saved = []
  const { c } = make({ contracts: { async load() { return [] }, async save(v) { saved.push(v); return gate.promise } } })
  await c.load()
  const first = c.log(meal, 'one')
  assert.equal(c.snapshot().phase, 'saving'); assert.equal(c.snapshot().totals.kcal, 0)
  assert.equal(await c.log(meal, 'one'), false); assert.equal(await c.log(meal, 'different'), false)
  gate.resolve(false); assert.equal(await first, false)
  assert.equal(c.snapshot().phase, 'save-error'); assert.equal(c.snapshot().logs.length, 0)
  assert.equal(await c.log(meal, 'one'), false) // retry allowed; same fake still fails
  assert.equal(saved.length, 2)
  const good = make(); await good.c.load()
  assert.equal(await good.c.log(meal, 'saved-intent'), true)
  assert.equal(await good.c.log(meal, 'saved-intent'), false)
  assert.equal(good.saves.length, 1)
  assert.equal(await good.c.log(meal, 'intentional-second'), true)
  assert.equal(good.saves.length, 2)
})

test('save rejects invalid/nonfinite/missing values; rejects and void success stay failed', async () => {
  const { c, saves } = make(); await c.load()
  for (const bad of [null, { ...meal, meal: ' ' }, ...['kcal', 'protein', 'carb', 'fat'].flatMap(k => ['', Infinity, NaN, -1, undefined].map(v => ({ ...meal, [k]: v })))]) {
    assert.equal(await c.log(bad, 'invalid'), false)
  }
  assert.equal(saves.length, 0)
  for (const save of [async () => {}, async () => { throw new Error('fake rejection') }]) {
    const { c } = make({ contracts: { async load() { return [] }, save } }); await c.load()
    assert.equal(await c.log(meal, 'failed'), false); assert.equal(c.snapshot().logs.length, 0)
    assert.equal(c.snapshot().pending, false)
  }
})

test('invalid numeric rows and overflowing totals remain unknown; valid zero stays zero', async () => {
  for (const bad of [Infinity, NaN, undefined, '', -1]) {
    const { c } = make({ contracts: { async load() { return [row({ kcal: bad })] } } }); await c.load()
    assert.equal(c.snapshot().totals, null); assert.equal(c.snapshot().recent.length, 0)
  }
  const { c } = make({ contracts: { async load() { return [row({ kcal: 1e308 }), row({ kcal: 1e308 })] } } }); await c.load()
  assert.equal(c.snapshot().totals, null)
  const zero = make({ contracts: { async load() { return [row({ kcal: 0 })] } } }).c; await zero.load()
  assert.equal(zero.snapshot().totals.kcal, 0)
})

test('favorite storage is athlete scoped, persists, handles corrupt/denied storage and rollback', async () => {
  const storage = storageFake()
  const a = make({ storage }).c; await a.load()
  assert.equal(a.toggleFavorite(meal), true)
  assert.equal(a.snapshot().favorites.length, 1)
  const a2 = make({ storage }).c; await a2.load(); assert.equal(a2.snapshot().favorites.length, 1)
  const b = make({ storage, athlete: { id: 'synthetic-B' }, contracts: { async load() { return [row({ athlete_id: 'synthetic-B' })] } } }).c
  await b.load(); assert.equal(b.snapshot().favorites.length, 0)
  assert.ok(storage.calls.some(v => v[1].endsWith('synthetic-B')))
  assert.equal(a.toggleFavorite({ ...meal, meal: 'not in recent' }), false)
  storage.setItem = () => { throw new Error('synthetic quota') }
  assert.equal(a.toggleFavorite(meal), false); assert.equal(a.snapshot().favorites.length, 1)
  assert.match(a.snapshot().favoriteError, /ikke gemt/)
  const corrupt = make({ storage: { getItem() { return '{bad' } } }).c
  assert.match(corrupt.snapshot().favoriteError, /ikke læses/)
  const denied = make({ storage: { getItem() { throw new Error('synthetic blocked') } } }).c
  assert.match(denied.snapshot().favoriteError, /ikke læses/)
})

test('load race and disposed controller cannot update a replaced athlete view', async () => {
  const first = deferred(), second = deferred(); let count = 0, updates = 0
  const { c } = make({ contracts: { load() { return (++count === 1 ? first : second).promise } } })
  c.subscribe(() => updates++)
  const a = c.load(), b = c.load(); second.resolve([]); assert.equal(await b, true)
  first.resolve([row()]); assert.equal(await a, false); assert.equal(c.snapshot().logs.length, 0)
  c.dispose(); const prior = updates
  assert.equal(await c.load(), false); assert.equal(await c.log(meal, 'disposed'), false)
  assert.equal(updates, prior)
  const gate = deferred(), x = make({ contracts: { load: () => gate.promise } }).c
  const loading = x.load(); x.dispose(); gate.resolve([row()]); assert.equal(await loading, false)
})

test('real mount -> adapter -> guarded synthetic insert, one-tap favorite/log/history/navigation', async () => {
  const host = syntheticHost(), client = clientFake(), storage = storageFake(), routes = []
  let coach = 0
  const cleanup = mountNutritionScreen(host, { entropi2: true, athlete: { id: 'synthetic-A', kcal_target: 2200 }, date, client, storage, clock: () => new Date('2026-11-05T12:00:00+01:00'), onCoach: () => { coach++; routes.push('beskeder') }, onNavigate: r => routes.push(r) })
  await flush()
  assert.match(host.textContent, /Din kostdagbog/)
  assert.doesNotMatch(host.textContent, /Ingen mål endnu/)
  assert.match(host.textContent, /[Cc]oach/)
  assert.match(host.textContent, /Mål for den valgte dag/)
  await find(host, 'button', 'Gem favorit: ' + meal.meal).fire('click')
  assert.ok(find(host, 'button', 'Fjern favorit: ' + meal.meal))
  const gate = deferred(); client.writeGate = gate
  const log = find(host, 'button', 'Log ' + meal.meal)
  const click = log.fire('click'); await log.fire('click')
  assert.equal(client.inserts.length, 1)
  assert.match(host.textContent, /Gemmer måltid/)
  assert.ok(host.querySelectorAll('button').filter(n => n.textContent.startsWith('Log ')).every(n => n.disabled))
  gate.resolve(); await click; await flush()
  assert.match(host.textContent, /Måltid gemt/)
  assert.match(host.textContent, /240 kcal/)
  await find(host, 'button', 'Se historik').fire('click')
  assert.ok(find(host, 'h2', 'Historik · seneste 30 dage'))
  assert.equal(find(host, 'button', 'Se historik').getAttribute('aria-expanded'), 'true')
  // The remaining coach action is the assembly's navigation seam after removing duplicate nav.
  assert.equal(find(host, 'button', 'Beskeder'), undefined)
  assert.equal(host.querySelectorAll('nav').length, 0)
  assert.deepEqual(routes, [])
  await find(host, 'button', 'Tal med din coach').fire('click')
  assert.equal(coach, 1); assert.deepEqual(routes, ['beskeder'])
  cleanup(); assert.equal(host.textContent, '')
})

test('real manual form and food portion handlers persist values; failure preserves draft', async () => {
  const { c, saves } = make({ foods: [{ name: 'Synthetic food', kcal100: 100, protein100: 10, carb100: 20, fat100: 5 }] })
  const host = syntheticHost(); const cleanup = mountNutrition(host, c, { clock: () => new Date('2026-11-05T12:00:00+01:00') }); await flush()
  const details = host.querySelectorAll('details')[0]; details.open = true
  const fields = host.querySelectorAll('input')
  for (const [i, value] of ['Synthetic meal', '80,5', '4', '9', '2'].entries()) { fields[i].value = value; await fields[i].fire('input') }
  await host.querySelectorAll('form')[0].fire('submit')
  assert.deepEqual(saves[0], { athlete_id: 'synthetic-A', date, meal: 'Synthetic meal', kcal: 80.5, protein: 4, carb: 9, fat: 2 })
  await host.querySelectorAll('form')[1].fire('submit'); await flush()
  assert.equal(saves[1].meal, 'Synthetic food · 100 g')
  cleanup()
  const bad = make({ contracts: { async load() { return [] }, async save() { return false } } }).c
  const other = syntheticHost(); mountNutrition(other, bad, { clock: () => new Date('2026-11-05T12:00:00+01:00') }); await flush()
  for (const [i, value] of ['Keep draft', '10', '1', '2', '3'].entries()) { const input = other.querySelectorAll('input')[i]; input.value = value; await input.fire('input') }
  await other.querySelectorAll('form')[0].fire('submit')
  assert.equal(other.querySelectorAll('input')[0].value, 'Keep draft')
  assert.equal(other.querySelectorAll('p').find(n => n.getAttribute('role') === 'alert').textContent, 'Måltidet blev ikke gemt. Prøv igen.')
})

test('DOM empty/invalid/read-error states and user text injection do not claim completeness', async () => {
  for (const rows of [[], [row({ meal: 7, kcal: Infinity })], [row({ meal: '<img src=x onerror=evil()>' })]]) {
    const { c } = make({ athlete: { id: 'synthetic-A' }, contracts: { async load() { return rows } } })
    const host = syntheticHost(); mountNutrition(host, c, { clock: () => new Date('2026-11-05T12:00:00+01:00') }); await flush()
    assert.doesNotMatch(host.textContent, /Ingen mål endnu/)
  assert.match(host.textContent, /[Cc]oach/)
    assert.equal(host.querySelectorAll('img').length, 0)
    assert.equal(host.querySelectorAll('progress').length, 0)
    if (!rows.length) assert.match(host.textContent, /Ingen måltider registreret/)
    else if (rows[0].meal === 7) assert.match(host.textContent, /Kontrollér næringsværdierne for dette måltid/)
    else assert.match(host.textContent, /<img src=x/)
  }
  let attempts = 0
  const { c } = make({ contracts: { async load() { if (++attempts === 1) throw new Error(); return [] } } })
  const host = syntheticHost(); mountNutrition(host, c, { clock: () => new Date('2026-11-05T12:00:00+01:00') }); await flush()
  assert.ok(find(host, 'button', 'Hent igen'))
  await find(host, 'button', 'Hent igen').fire('click')
  assert.match(host.textContent, /Ingen måltider registreret/)
})
