import test from 'node:test'
import assert from 'node:assert/strict'
import { createApprovedShopping } from './approvedShoppingController.mjs'
import { shoppingDates, formatApprovedShopping, shoppingVersion } from './approvedShoppingModel.mjs'
import { createPlanAdapter } from '../planAdapter.mjs'
import { shoppingFixture, food, today, dates, athleteId, mealNames, tableNames, gate, uuid } from './approvedShopping.fixture.mjs'

const controller = (f, extra = {}) => createApprovedShopping({ enabled: true, client: f.client, athleteId, today, ...extra })

test('pinned shopping gap: actual accepted adapter projects food identity away; exact approved revision restores source without guessing', async () => {
  const f = shoppingFixture(), active = await createPlanAdapter({ enabled: true, client: f.client, athleteId, date: dates[0] }).loadActive()
  assert.equal(active.meals[0].foods[0].name, 'Linser')
  assert.equal(active.meals[0].foods[0].preparation, undefined)
  assert.notEqual(active.meals[0].foods[0].id, 'synthetic:lentils')
  const version = shoppingVersion(f.data[tableNames[1]][0], active, athleteId, dates[0])
  assert.equal(version.meals[0].portions[0].food.id, 'synthetic:lentils')
  assert.equal(version.meals[0].portions[0].food.preparation, 'kogte')
  assert.equal(f.writes().length, 0)
})

test('three dates / eighteen named meals: independent gram arithmetic, states, IDs and sources; zero and unknown unchanged', async t => {
  const f = shoppingFixture(), bytes = JSON.stringify(f.data), c = controller(f); t.after(c.dispose)
  assert.equal(await c.load(), true)
  const s = c.snapshot(), result = s.result
  assert.equal(s.complete, true); assert.deepEqual(result.dates, dates)
  assert.deepEqual(result.days.map(d => d.mealNames), [mealNames, mealNames, mealNames])
  // Per day: 10+11+12+13+14+15 = 75; rice = 20+22+24+26+28+30 = 150.
  // Three multipliers are 1+2+3 = 6. Extra distinct lines are 7, 11, 13.
  assert.deepEqual(result.items.map(i => i.grams), ['450', '900', '42', '66', '78'])
  assert.equal(result.items.length, 5)
  assert.match(formatApprovedShopping(result), /Linser: 450 g\. Tilberedning: kogte/)
  assert.match(formatApprovedShopping(result), /Bruttobehov – lager ikke fratrukket/)
  assert.doesNotMatch(formatApprovedShopping(result), /Nettokøb|100%|kcal|protein|udløb/)
  assert.equal(JSON.stringify(f.data), bytes)
  const n = f.data[tableNames[1]][0].meals[0].portions[0].food.nutrientsPer100g
  assert.equal(n.energyKcal, 0); assert.equal(n.proteinG, null)
  assert.equal(f.writes().length, 0)
  assert.ok(Object.isFrozen(result.items[0].source))
  const hydration = f.calls.filter(call => call.limit === 2)
  assert.equal(hydration.length, 3)
  assert.ok(hydration.every(call => call.filters.some(([k]) => k === 'id') && call.filters.some(([k]) => k === 'plan_id')))
})

test('same approved version on two dates contributes twice; no expiry is invented', async t => {
  const f = shoppingFixture(); f.data[tableNames[1]].splice(1, 1); f.data[tableNames[2]].splice(1, 1)
  const c = controller(f); t.after(c.dispose); assert.equal(await c.load(), true)
  assert.equal(c.snapshot().result.days[0].versionId, c.snapshot().result.days[1].versionId)
  assert.deepEqual(c.snapshot().result.items.map(i => i.grams), ['375', '750', '35', '55', '65'])
  assert.equal(c.snapshot().result.days[1].effectiveFrom, dates[0])
})

test('canonical decimal grams sum without binary drift, title inference or units/state conversion', async t => {
  const f = shoppingFixture(), v = f.data[tableNames[1]][0], ingredient = food('synthetic:fraction', 'Ris <b>rå</b>', 'uoplyst')
  v.meals = [{ name: 'Hvilken som helst titel', portions: [{ grams: .1, food: ingredient }, { grams: .2, food: ingredient }] }]
  const c = controller(f, { dates: [dates[0]] }); t.after(c.dispose); await c.load()
  assert.equal(c.snapshot().result.items[0].grams, '0.3')
  assert.match(formatApprovedShopping(c.snapshot().result), /Ris <b>rå<\/b>: 0,3 g\. Tilberedning: uoplyst/)
})

test('bounded explicit dates and empty selection never issue unsupported reads; OFF and readOnly are inert', async t => {
  for (const bad of [undefined, [], ['2026-11-11'], ['2026-11-06'], [dates[0], dates[0]]]) {
    if (Array.isArray(bad) && !bad.length) assert.deepEqual(shoppingDates(today, bad), [])
    else assert.throws(() => shoppingDates(today, bad))
  }
  assert.deepEqual(shoppingDates('2026-12-31', ['2027-01-02', '2026-12-31']), ['2026-12-31', '2027-01-02'])
  const c = controller(shoppingFixture()); t.after(c.dispose)
  assert.equal(await c.choose(['2026-11-11']), false)
  assert.equal(await c.choose([]), false); assert.equal(c.snapshot().phase, 'empty-selection')
  const trap = new Proxy({}, { get() { throw Error('OFF read') } })
  for (const enabled of [false, undefined, 1, 'true']) assert.equal(createApprovedShopping({ enabled, client: trap }), null)
  assert.equal(createApprovedShopping({ enabled: true, readOnly: true, client: trap }), null)
})

for (const kind of ['missing', 'unavailable', 'error', 'foreign', 'wrong-version', 'malformed', 'zero', 'unit', 'source', 'truncated'])
  test('incomplete ' + kind + ' names affected dates, clears full list/copy, retry rebuilds current evidence', async t => {
    const f = shoppingFixture(), c = controller(f); t.after(c.dispose); assert.equal(await c.load(), true)
    const saved = structuredClone(f.data), options = f.options
    if (kind === 'missing') { f.data[tableNames[1]].splice(0, 1); f.data[tableNames[2]].splice(0, 1) }
    if (kind === 'unavailable') options.missing = tableNames[0]
    if (kind === 'error') options.error = '42501'
    if (kind === 'foreign') f.data[tableNames[2]][0].athlete_id = 'another-athlete'
    if (kind === 'malformed') f.data[tableNames[1]][0].meals[0].portions[0].grams = null
    if (kind === 'zero') f.data[tableNames[1]][0].meals[0].portions[0].grams = 0
    if (kind === 'unit') f.data[tableNames[1]][0].meals[0].portions[0].unit = 'ml'
    if (kind === 'source') delete f.data[tableNames[1]][0].meals[0].portions[0].food.source
    if (kind === 'wrong-version' || kind === 'truncated') options.response = (call, rows) => {
      if (call.limit !== 2) return undefined
      return { data: kind === 'truncated' ? [] : rows.map(v => ({ ...v, id: uuid(99999) })), error: null }
    }
    assert.equal(await c.load(), false); assert.equal(c.snapshot().complete, false); assert.equal(c.snapshot().result, null)
    // No plan readable on any day (before the migration) is an honest empty state.
    if (kind === 'unavailable') { assert.equal(c.snapshot().phase, 'no-plan'); assert.deepEqual(c.snapshot().affected, []) }
    else assert.ok(c.snapshot().affected.some(d => d.date === dates[0]))
    assert.throws(() => formatApprovedShopping(c.snapshot().result))
    let writes = 0; assert.equal(await c.copy({ writeText() { writes++ } }), false); assert.equal(writes, 0)
    for (const name of tableNames) f.data[name] = saved[name] // transport closes over this same data object
    options.missing = false; options.error = null; options.response = undefined
    assert.equal(await c.load(), true); assert.equal(c.snapshot().result.items[0].grams, '450')
  })

test('overlapping reads, changed date selection and disposal suppress late work and retained actions', async t => {
  const f = shoppingFixture(), c = controller(f), g = gate(); t.after(c.dispose)
  let blocked = false
  f.options.before = async call => { if (call.limit === 2 && !blocked) { blocked = true; await g.promise } }
  const old = c.load(); while (!blocked) await new Promise(r => setImmediate(r))
  await c.choose([dates[2]]); const latest = c.snapshot()
  g.resolve(); assert.equal(await old, false); assert.strictEqual(c.snapshot(), latest)
  assert.deepEqual(c.snapshot().dates, [dates[2]])
  c.dispose(); const count = f.calls.length
  assert.equal(await c.load(), false); assert.equal(await c.choose(dates), false); assert.equal(await c.copy({ writeText() { assert.fail() } }), false)
  assert.equal(f.calls.length, count)
})

test('clipboard failure/unavailable fallback is bounded and honest; duplicate/pending/stale/scope actions cannot copy or acknowledge', async t => {
  const f = shoppingFixture(), c = controller(f), g = gate(), copied = []; t.after(c.dispose)
  await c.load(); const expected = c.snapshot().result
  const pending = c.copy({ writeText: async text => { copied.push(text); await g.promise } }, expected)
  assert.equal(c.snapshot().copyPending, true)
  assert.equal(await c.copy({ writeText() { assert.fail() } }), false)
  await c.choose([dates[0]]); assert.equal(c.snapshot().copyStatus, '')
  assert.equal(await c.copy(null, expected), false)
  assert.equal(await c.copy({ writeText() { assert.fail() } }), false, 'old clipboard still pending')
  g.resolve(); assert.equal(await pending, false); assert.equal(c.snapshot().copyStatus, '')
  assert.equal(c.snapshot().copyPending, false); assert.equal(copied.length, 1)
  assert.equal(await c.copy({ writeText() { return Promise.reject(Error('denied')) } }), false)
  assert.equal(c.snapshot().copyStatus, 'failed'); assert.equal(c.snapshot().copyText, formatApprovedShopping(c.snapshot().result))
  assert.equal(await c.copy(null), false); assert.equal(c.snapshot().copyStatus, 'failed')
  assert.equal(await c.copy({ writeText: text => { copied.push(text) } }), true); assert.equal(c.snapshot().copyStatus, 'copied')
  f.options.error = '42501'; await c.load(); assert.equal(c.snapshot().copyStatus, ''); assert.equal(c.snapshot().copyText, '')
  assert.equal(c.snapshot().complete, false)
})

test('current day revoked during read/copy never publishes success or initiates new work', async t => {
  const f = shoppingFixture(); let current = true
  const c = controller(f, { isCurrent: () => current }); t.after(c.dispose); await c.load()
  const g = gate(), pending = c.copy({ writeText: () => g.promise })
  current = false; g.resolve(); assert.equal(await pending, false); assert.notEqual(c.snapshot().copyStatus, 'copied')
  const count = f.calls.length; assert.equal(await c.load(), false); assert.equal(await c.copy(null), false); assert.equal(f.calls.length, count)
})
