import test from 'node:test'
import assert from 'node:assert/strict'
import { createKostDaySession } from './daySession.mjs'
import { fixture, athleteId, date, flush } from './daySession.fixture.mjs'
import { tableNames } from '../coach/activation.fixture.mjs'

const open = (f, extra = {}) => createKostDaySession({ enabled: true, athleteId, date, client: f.client, storage: f.storage, ...extra })
const extraMeal = () => ({ athlete_id: athleteId, date, meal: 'Ekstra mad', kcal: 50, protein: 5, carb: 6, fat: 1 })

test('day assembly: strict OFF does not inspect dependencies', () => {
  for (const enabled of [false, undefined, 1, 'true']) assert.equal(createKostDaySession({ enabled,
    get client() { throw Error('OFF') }, get storage() { throw Error('OFF') } }), null)
})

test('day assembly: every missing table/code keeps tracker mode, one session probe, no writes', async () => {
  for (const missing of tableNames) for (const missingCode of ['42P01', 'PGRST205']) {
    const f = fixture({ missing, missingCode })
    for (const scope of [{}, {}, { date: '2026-11-06' }, { athleteId: 'synthetic-other' }]) {
      const s = open(f, scope)
      try { assert.equal(await s.controller.load(), true); assert.equal(s.controller.snapshot().mode, 'tracker') }
      finally { s.dispose() }
    }
    assert.equal(f.plan.calls.length, tableNames.indexOf(missing) + 1)
    assert.ok(f.plan.calls.every(c => c.limit === 0))
    assert.deepEqual(f.calls, []); assert.deepEqual(f.writes, []); assert.equal(f.plan.writes().length, 0)
  }
})

test('day assembly: no approved plan is tracker; a later activation is read without another schema probe', async t => {
  const f = fixture(), s = open(f); t.after(s.dispose)
  await s.controller.load(); assert.equal(s.controller.snapshot().mode, 'tracker')
  f.approve(); await s.controller.load()
  assert.equal(s.controller.snapshot().mode, 'plan')
  assert.deepEqual(s.controller.snapshot().remaining, { kcal: 500, protein: 50, carb: 60, fat: 10 })
  assert.equal(f.plan.calls.filter(c => c.limit === 0).length, 3)
  assert.equal(f.plan.writes().length, 0); assert.deepEqual(f.writes, []); assert.equal(f.rows.length, 0)
})

test('day assembly: one tap writes existing diary only, restores receipt, and tracker edits refresh remaining', async t => {
  const f = fixture(); f.approve()
  const s = open(f); t.after(s.dispose); await s.controller.load()
  const meal = s.controller.snapshot().meals[0]
  assert.equal(await s.controller.markEaten(meal.id), true); await flush()
  assert.equal(f.rows.length, 1)
  assert.deepEqual(s.controller.snapshot().remaining, { kcal: 300, protein: 30, carb: 36, fat: 6 })
  assert.ok(f.writes.every(key => key.startsWith('entropi2:kostplan:atlet:v1:')))
  assert.equal(f.plan.writes().length, 0)
  assert.equal(await s.controller.markEaten(meal.id), false)
  const again = open(f); t.after(again.dispose); await again.controller.load()
  assert.equal(again.controller.snapshot().eatenCount, 1)
  assert.equal(await again.controller.markEaten(meal.id), false)
  const result = await s.contracts.saveWithIdentity(extraMeal()); assert.equal(result.ok, true); await flush()
  assert.equal(s.controller.snapshot().remaining.kcal, 250)
  await s.contracts.update({ ...f.rows[1], kcal: 100 }); await flush()
  assert.equal(s.controller.snapshot().remaining.kcal, 200)
  await s.contracts.remove(f.rows[1]); await flush()
  assert.equal(s.controller.snapshot().remaining.kcal, 300)
  await s.contracts.remove(f.rows[0]); await flush()
  assert.equal(s.controller.snapshot().eatenCount, 0)
  assert.equal(s.controller.snapshot().remaining.kcal, 500)
})

test('day assembly: load failures are honest; lost insert remains blocked without a duplicate', async t => {
  const f = fixture({ lostInsert: true }); f.approve()
  const s = open(f); t.after(s.dispose); await s.controller.load()
  const meal = s.controller.snapshot().meals[0]
  assert.equal(await s.controller.markEaten(meal.id), false)
  assert.equal(s.controller.snapshot().phase, 'uncertain'); assert.equal(f.rows.length, 1)
  await s.controller.load(); assert.equal(s.controller.snapshot().meals[0].blocked, true)
  assert.equal(await s.controller.markEaten(meal.id), false); assert.equal(f.rows.length, 1)
  const bad = fixture({ logError: true }); bad.approve()
  const broken = open(bad); t.after(broken.dispose)
  assert.equal(await broken.controller.load(), false); assert.equal(broken.controller.snapshot().phase, 'load-error')
  const forbidden = open(fixture({ error: '42501' })); t.after(forbidden.dispose)
  assert.equal(await forbidden.controller.load(), false); assert.equal(forbidden.controller.snapshot().phase, 'load-error')
  const unavailable = open(fixture(), { client: undefined }); t.after(unavailable.dispose)
  assert.equal(await unavailable.controller.load(), false); assert.equal(unavailable.controller.snapshot().phase, 'load-error')
})

test('day assembly: midnight blocks plan save; disposal suppresses late load and retained diary writes', async () => {
  const f = fixture(); f.approve()
  const s = open(f, { currentDay: () => '2026-11-06' }); await s.controller.load()
  assert.equal(await s.controller.markEaten(s.controller.snapshot().meals[0].id), false)
  assert.equal(f.rows.length, 0); s.dispose()
  assert.deepEqual(await s.contracts.saveWithIdentity(extraMeal()), { ok: false, id: null })
  let release
  const held = new Promise(resolve => { release = resolve })
  const late = fixture({ before: () => held }), cancelled = open(late)
  const loading = cancelled.controller.load(); cancelled.dispose(); release()
  assert.equal(await loading, false); assert.equal(cancelled.controller.snapshot().mode, null)
  assert.equal(late.plan.writes().length, 0)
})
