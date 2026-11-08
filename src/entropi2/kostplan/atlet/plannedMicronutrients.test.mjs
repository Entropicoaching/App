import test from 'node:test'
import assert from 'node:assert/strict'
import { seeded, micros, athleteId, date, freeze, tick } from './plannedMicronutrients.fixture.mjs'
import { createPlanAdapter } from '../planAdapter.mjs'
import { createAthleteDay, readAthletePlan } from './dayModel.mjs'
import { createKostDaySession } from './daySession.mjs'
import { tableNames } from '../coach/activation.fixture.mjs'
import { MICRONUTRIENTS, sumDay } from '../foedevarer/index.mjs'

const load = (f, day = date) => createPlanAdapter({ enabled: true, athleteId, date: day, client: f.client }).loadActive()
const amounts = s => Object.fromEntries((s.plannedMicronutrients ?? []).map(v => [v.nutrient, v.value]))

test('approved original food -> adapter -> reader -> day: exact unrounded units, retained source, immutable detached evidence and no extra queries', async t => {
  const f = seeded(), before = JSON.stringify(f.plan.data)
  const plan = await load(f), stored = f.plan.data[tableNames[1]][0]
  assert.equal(f.plan.calls.length, 7)
  assert.deepEqual(plan.meals[0].foods[0].nutrition, stored.meals[0].portions[0].food)
  assert.notStrictEqual(plan.meals[0].foods[0].nutrition, stored.meals[0].portions[0].food)
  const read = readAthletePlan(plan, athleteId, date)
  const expected = sumDay(stored.meals.map(m => m.portions))
  assert.deepEqual(amounts(read), Object.fromEntries(Object.values(MICRONUTRIENTS).map(({ nutrient }) => [nutrient, expected.nutrients[nutrient].value])))
  assert.equal(read.plannedMicronutrients.find(v => v.nutrient === 'vitaminDUg').unit, 'µg')
  assert.equal(amounts(read).vitaminDUg, 0)
  const session = createKostDaySession({ enabled: true, athleteId, date, client: f.client, storage: f.storage })
  t.after(session.dispose); await session.controller.load()
  const s = session.controller.snapshot()
  assert.deepEqual(amounts(s), amounts(read)); assert.equal(s.planRevision, stored.id)
  assert.ok(Object.isFrozen(s.plannedMicronutrients[0])); assert.ok(Object.isFrozen(s.meals[0].foods[0].nutrition.source))
  assert.throws(() => { s.plannedMicronutrients[0].value = 999 })
  assert.deepEqual(s.totals, { kcal: 0, protein: 0, carb: 0, fat: 0 })
  assert.equal(JSON.stringify(f.plan.data), before)
  assert.equal(f.plan.writes().length + f.writes.length + f.rows.length, 0)
})

test('each absent or null nutrient blocks that entire-day total only; explicit zero survives and no partial subtotal escapes', async () => {
  for (const key of Object.keys(micros)) for (const missing of ['absent', null]) {
    const f = seeded(), v = structuredClone(f.plan.data[tableNames[1]][0])
    if (missing === 'absent') delete v.meals[1].portions[0].food.nutrientsPer100g[key]
    else v.meals[1].portions[0].food.nutrientsPer100g[key] = null
    f.plan.data[tableNames[1]][0] = freeze(v)
    const result = readAthletePlan(await load(f), athleteId, date)
    assert.equal(Object.keys(amounts(result)).length, 8)
    assert.equal(amounts(result)[key], undefined, key)
    for (const other of Object.keys(micros).filter(k => k !== key)) assert.equal(typeof amounts(result)[other], 'number')
  }
  const f = seeded('zero'), zero = readAthletePlan(await load(f), athleteId, date)
  assert.deepEqual(amounts(zero), Object.fromEntries(Object.keys(micros).map(k => [k, 0])))
})

test('legacy missing and unsupported original metadata retain exact historical projected shape; normalization must not launder extra fields', async () => {
  const f = seeded('missing'), p = await load(f), food = p.meals[0].foods[0]
  assert.deepEqual(Object.keys(food).sort(), ['carb100', 'fat100', 'grams', 'id', 'kcal100', 'name', 'protein100'])
  const read = readAthletePlan(p, athleteId, date)
  assert.deepEqual(Object.keys(read).sort(), ['athlete_id', 'date', 'id', 'meals', 'portionGuidance', 'revision', 'targets'])
  assert.deepEqual(read.meals[0].foods[0], food)
  for (const edit of [
    food => { food.unrecognized = 0 },
    food => { food.source.unrecognized = 'Unsupported' },
    food => { delete food.preparation },
  ]) {
    const u = seeded(), v = structuredClone(u.plan.data[tableNames[1]][0]); edit(v.meals[0].portions[0].food)
    u.plan.data[tableNames[1]][0] = freeze(v)
    const projected = await load(u)
    assert.deepEqual(projected.meals[0].foods[0], food)
    assert.equal(readAthletePlan(projected, athleteId, date).plannedMicronutrients, undefined)
  }
  const wrong = seeded(), plan = await load(wrong)
  plan.meals[0].foods[0].name = 'Another food'
  assert.equal(readAthletePlan(plan, athleteId, date).plannedMicronutrients, undefined)
  assert.throws(() => readAthletePlan(plan, 'wrong-athlete', date))
  assert.throws(() => readAthletePlan(plan, athleteId, '2026-11-06'))
})

test('original planned nutrients remain fixed through edited grams, explicit eaten receipt, reload and same-day approved correction', async t => {
  const f = seeded(), before = JSON.stringify(f.plan.data)
  const session = createKostDaySession({ enabled: true, athleteId, date, client: f.client, storage: f.storage, currentDay: () => date })
  const c = session.controller; t.after(session.dispose); await c.load()
  const initial = amounts(c.snapshot()), first = c.snapshot().meals[0]
  c.toggleEdit(first.id); c.setGrams(first.id, first.foods[0].id, '12,5')
  assert.deepEqual(amounts(c.snapshot()), initial)
  assert.equal(c.snapshot().meals[0].values.kcal, 13)
  assert.equal(await c.markEaten(first.id), true); await tick()
  assert.deepEqual(amounts(c.snapshot()), initial); assert.equal(f.rows[0].kcal, 13)
  assert.equal(c.snapshot().totals.kcal, 13)
  await c.load(); assert.deepEqual(amounts(c.snapshot()), initial)
  assert.equal(c.snapshot().meals[0].foods[0].grams, 12.5)
  assert.equal(JSON.stringify(f.plan.data), before)
  const corrected = structuredClone(f.plan.data[tableNames[1]][0])
  corrected.id = '30000000-0000-4000-8000-000000000004'; corrected.version_no = 3
  corrected.meals[0].portions[0].grams = 100
  f.plan.data[tableNames[1]].push(freeze(corrected))
  f.plan.data[tableNames[2]].push({ ...f.plan.data[tableNames[2]][0], version_id: corrected.id, approved_at: date + 'T12:00:01Z' })
  await c.load()
  assert.equal(c.snapshot().planRevision, corrected.id)
  assert.notDeepEqual(amounts(c.snapshot()), initial)
  assert.equal(c.snapshot().eatenCount, 0, 'Receipt belongs to its exact prior version')
  assert.equal(c.snapshot().totals.kcal, 13, 'Old actual meal remains in diary')
  assert.equal(f.rows.length, 1); assert.equal(f.plan.writes().length, 0)
})

test('cancelled/overlapping day reads clear old evidence and cannot leak delayed sums across load/disposal', async t => {
  const f = seeded(), first = await load(f), newer = structuredClone(first)
  newer.revision = 'synthetic-newer-version'; newer.meals[0].foods[0].grams = 100
  let release, attempt = 0
  const held = new Promise(resolve => { release = resolve })
  const c = createAthleteDay({ enabled: true, athleteId, date, loadDay: async () => {
    if (++attempt === 1) { await held; return { plan: first, logs: [], eaten: [] } }
    return { plan: newer, logs: [], eaten: [] }
  } })
  t.after(c.dispose)
  const delayed = c.load(); assert.equal(c.snapshot().plannedMicronutrients, undefined)
  await c.load(); const confirmed = c.snapshot(); assert.equal(confirmed.planRevision, newer.revision)
  release(); assert.equal(await delayed, false); assert.strictEqual(c.snapshot(), confirmed)
  c.dispose(); assert.equal(c.snapshot().plannedMicronutrients, undefined)
  assert.equal(await c.load(), false)
})
