import test from 'node:test'
import assert from 'node:assert/strict'
import { createFood } from './foedevarer/catalog.mjs'
import { catalogFoods } from './coach/model.mjs'
import { createPlanAdapter } from './planAdapter.mjs'
import { withDatabase, scope, names, owner, stranger } from './coach/generatorSql.fixture.mjs'

const originalDate = Date, originalNow = Date.now
const input = () => ({ ...scope, goal: 'maintain', intensity: 10,
  meals: [{ id: 'clock-meal', name: 'Clock control', items: [{ grams: 100, food: catalogFoods([createFood({
    id: 'clock-zero', name: 'Synthetic clock food', preparation: 'synthetic',
    source: { citation: 'Clock regression synthetic data', verification: 'synthetic' },
    nutrientsPer100g: { energyKcal: 0, proteinG: 0, carbohydrateG: 0, fatG: 0, calciumMg: 0, ironMg: null },
  })])[0] }] }] })
const restored = () => { assert.equal(Date, originalDate); assert.equal(Date.now, originalNow) }

test('clock fixture: native per-test Date controls actual SQL approval; zero, unknown and foreign RLS survive', { timeout: 60000 }, async t => {
  const now = `${scope.date}T12:00:00.000Z`
  t.mock.timers.enable({ apis: ['Date'], now: new Date(now) })
  let db
  try {
    await withDatabase(async f => {
      db = f.db
      assert.equal((await db.query('select clock_timestamp() as actual')).rows[0].actual.toISOString(), now)
      const adapter = createPlanAdapter({ enabled: true, client: f.client, ...scope })
      await adapter.activate(input())
      assert.equal((await db.query(`select approved_at from public.${names[2]}`)).rows[0].approved_at.toISOString(), now)
      const stored = (await db.query(`select meals from public.${names[1]}`)).rows[0].meals[0].portions[0].food
      assert.equal(stored.nutrientsPer100g.calciumMg, 0)
      assert.equal(stored.nutrientsPer100g.ironMg, null)
      assert.equal(stored.source.citation, 'Clock regression synthetic data')
      assert.deepEqual((await adapter.loadActive()).targets, { kcal: 0, protein: 0, carb: 0, fat: 0 })
      await f.login(stranger)
      assert.deepEqual((await db.query(`select * from public.${names[2]}`)).rows, [])
      assert.equal(await adapter.loadActive(), null)
      await f.login(owner)
      assert.deepEqual((await adapter.loadActive()).targets, { kcal: 0, protein: 0, carb: 0, fat: 0 })
    })
  } finally { t.mock.timers.reset() }
  assert.equal(db.closed, true)
  restored()
})

test('clock negative control: genuine next-day SQL approval remains invisible on the requested historical day', { timeout: 60000 }, async t => {
  const now = '2026-11-08T12:00:00.000Z'
  t.mock.timers.enable({ apis: ['Date'], now: new Date(now) })
  let db
  try {
    await withDatabase(async f => {
      db = f.db
      const adapter = createPlanAdapter({ enabled: true, client: f.client, ...scope })
      await adapter.activate(input())
      assert.equal((await db.query('select clock_timestamp() as actual')).rows[0].actual.toISOString(), now)
      assert.equal((await db.query(`select approved_at from public.${names[2]}`)).rows[0].approved_at.toISOString(), now)
      assert.equal(await adapter.loadActive(), null)
      const nextDay = createPlanAdapter({ enabled: true, client: f.client, ...scope, date: '2026-11-08' })
      assert.deepEqual((await nextDay.loadActive()).targets, { kcal: 0, protein: 0, carb: 0, fat: 0 })
    })
  } finally { t.mock.timers.reset() }
  assert.equal(db.closed, true)
  restored()
})

test('clock cleanup: a rejected SQL fixture callback still closes PGlite and restores Date', { timeout: 60000 }, async t => {
  const failure = Error('Synthetic callback failure')
  let db
  await assert.rejects(async () => {
    t.mock.timers.enable({ apis: ['Date'], now: new Date(`${scope.date}T12:00:00.000Z`) })
    try {
      await withDatabase(async f => {
        db = f.db
        assert.equal((await db.query('select clock_timestamp() as actual')).rows[0].actual.toISOString(), `${scope.date}T12:00:00.000Z`)
        throw failure
      })
    } finally { t.mock.timers.reset() }
  }, error => error === failure)
  assert.equal(db.closed, true)
  restored()
})
