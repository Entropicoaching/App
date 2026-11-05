// Independent assembly oracle: no producer fixture, catalog, snapshot builder,
// nutrition arithmetic helper or replacement React dependency.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createKostDaySession } from './daySession.mjs'

function review(extra = {}) {
  const athleteId = 'review-day', date = '2028-02-29'
  const planId = '41000000-0000-4000-8000-000000000001'
  const versionId = '41000000-0000-4000-8000-000000000002'
  const rows = [{ id: 'review-existing', athlete_id: athleteId, date, meal: 'Ekstra', kcal: 100, protein: 10, carb: 5, fat: 1, ...extra.log }]
  const calls = [], local = new Map(), storageWrites = []
  const answers = {
    kostplan_v1_plans: [{ id: planId, athlete_id: athleteId, status: 'godkendt', valid_from: date, ...extra.plan }],
    kostplan_v1_versions: [{ id: versionId, plan_id: planId, version_no: 1, effective_from: date,
      goal: 'vedligehold', intensity: 0, meals: [{ name: 'Review måltid', portions: [{ grams: 100,
        food: { id: 'review-food', name: 'Review fødevare', source: { citation: 'review', verification: 'synthetic' },
          nutrientsPer100g: { energyKcal: 400, proteinG: 20, carbohydrateG: 40, fatG: 10 } } }] }] }],
    kostplan_v1_approvals: [{ id: '41000000-0000-4000-8000-000000000003', plan_id: planId, version_id: versionId,
      athlete_id: athleteId, approved_at: date + 'T12:00:00Z' }],
  }
  const client = { from(table) {
    assert.ok(table === 'meal_logs' || Object.hasOwn(answers, table))
    const call = { table, filters: [], limit: null, insert: null }; calls.push(call)
    const q = {
      select() { return q }, order() { return q },
      eq(key, value) { call.filters.push([key, value]); return q },
      lte() { return q }, gte() { return q }, in() { return q }, limit(n) { call.limit = n; return q },
      insert(row) { assert.equal(table, 'meal_logs'); call.insert = structuredClone(row); return q },
      then(resolve, reject) {
        return Promise.resolve().then(() => {
          if (call.insert) { rows.push({ ...call.insert, id: 'review-new' }); return { data: [{ id: 'review-new' }], error: null } }
          return { data: structuredClone(call.limit === 0 ? [] : table === 'meal_logs' ? rows : answers[table]), error: null }
        }).then(resolve, reject)
      },
    }
    return q
  } }
  const session = createKostDaySession({ enabled: true, athleteId, date, client,
    storage: { getItem: key => local.get(key) ?? null, setItem(key, value) { storageWrites.push(key); local.set(key, value) } } })
  return { session, calls, rows, storageWrites }
}

test('independent review: snapshot-derived targets minus actual diary; one exact existing diary insert', async t => {
  const f = review(); t.after(f.session.dispose)
  assert.equal(await f.session.controller.load(), true)
  const before = f.session.controller.snapshot()
  assert.deepEqual(before.remaining, { kcal: 300, protein: 10, carb: 35, fat: 9 })
  assert.equal(f.storageWrites.length, 0)
  assert.equal(f.calls.filter(c => c.limit === 0).length, 3)
  assert.equal(await f.session.controller.markEaten(before.meals[0].id), true)
  await new Promise(resolve => setImmediate(resolve))
  const inserts = f.calls.filter(c => c.insert)
  assert.deepEqual(inserts.map(c => c.table), ['meal_logs'])
  assert.deepEqual(inserts[0].insert, { athlete_id: 'review-day', date: '2028-02-29', meal: 'Review måltid', kcal: 400, protein: 20, carb: 40, fat: 10 })
  assert.equal(f.session.controller.snapshot().remaining.kcal, 0)
  assert.equal(f.session.controller.snapshot().remaining.protein, 0)
  assert.ok(f.storageWrites.every(key => key.startsWith('entropi2:kostplan:atlet:v1:')))
})

test('independent review: wrong athlete or future diary rows fail closed without any write', async t => {
  for (const extra of [{ plan: { athlete_id: 'other' } }, { log: { athlete_id: 'other' } }, { log: { date: '2028-03-01' } }]) {
    const f = review(extra); t.after(f.session.dispose)
    assert.equal(await f.session.controller.load(), false)
    assert.equal(f.session.controller.snapshot().phase, 'load-error')
    assert.equal(f.calls.filter(c => c.insert).length, 0)
    assert.deepEqual(f.storageWrites, [])
  }
})
