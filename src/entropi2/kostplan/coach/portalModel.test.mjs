import test from 'node:test'
import assert from 'node:assert/strict'
import { openPortalPlan, draftKey, DRAFT_MESSAGE } from './portalModel.mjs'
import { FOODS } from '../foedevarer/index.mjs'
import { memoryStorage } from './portal.fixture.mjs'

const scope = { enabled: true, coachId: 'synthetic-coach', athlete: { id: 'synthetic-a', protein_target: 150, kcal_target: 2400 }, date: '2026-11-04' }
const template = [{ id: 'synthetic-meal', name: 'Syntetisk måltid', items: [{ foodId: FOODS[0].id, grams: 200 }] }]
function setup(storage = memoryStorage(), extra = {}) {
  const opened = openPortalPlan({ ...scope, template, storage: () => storage, ...extra })
  return { ...opened, storage }
}
function generate(controller) {
  controller.set('maintenanceKcal', '2400'); controller.set('fat', '70')
  assert.equal(controller.generate(), true)
}

test('portal OFF never reads poisoned data or storage', () => {
  for (const enabled of [undefined, false, 1, 'true']) assert.equal(openPortalPlan({ enabled,
    get athlete() { throw Error('OFF data') }, get storage() { throw Error('OFF storage') } }), null)
})

test('actual portal adapter writes one scoped device draft only on save or activation; never active', async () => {
  const { controller: c, storage } = setup()
  assert.equal(c.snapshot().form.maintenanceKcal, '') // targets are not maintenance
  assert.equal(c.snapshot().form.fat, '')
  generate(c); assert.equal(storage.calls.filter(c => c[0] === 'set').length, 0)
  assert.equal(await c.activate(), true) // explicit activation degrades to saving current draft
  assert.equal(c.snapshot().saved.status, 'draft'); assert.equal(c.snapshot().message, DRAFT_MESSAGE)
  const key = draftKey(scope.coachId, scope.athlete.id, scope.date)
  assert.deepEqual([...storage.data.keys()], [key])
  const first = JSON.parse(storage.data.get(key))
  assert.equal(first.plan.status, 'draft'); assert.equal(first.coachId, scope.coachId)
  c.editGrams(0, 0, '123,5'); assert.equal(await c.save(), true)
  assert.equal(JSON.parse(storage.data.get(key)).plan.meals[0].items[0].grams, 123.5)
  const reloaded = setup(storage).controller
  assert.deepEqual(reloaded.snapshot().meals, c.snapshot().meals.map(m => ({ ...m, items: m.items.map(i => ({ ...i, grams: Number(String(i.grams).replace(',', '.')) })) })))
  assert.deepEqual(reloaded.snapshot().form, c.snapshot().form)
  assert.equal(reloaded.snapshot().dirty, false)
  const fromStorage = openPortalPlan({ ...scope, storage: () => storage }).controller
  assert.equal(fromStorage.generate(), true) // retained meals also restore the generation template
  assert.equal(await reloaded.activate(), true); assert.equal(reloaded.snapshot().saved.status, 'draft')
})

test('device drafts isolate coach, athlete and date; corrupted or foreign data never loads or overwrites', async () => {
  const first = setup(); generate(first.controller); await first.controller.save()
  for (const extra of [{ coachId: 'synthetic-other-coach' }, { athlete: { id: 'synthetic-b' } }, { date: '2026-11-05' }]) {
    const other = setup(first.storage, extra)
    assert.equal(other.controller.snapshot().meals.length, 0); assert.equal(other.restored, false)
  }
  const key = [...first.storage.data.keys()][0], valid = first.storage.data.get(key)
  for (const bad of ['{broken', JSON.stringify({ ...JSON.parse(valid), coachId: 'synthetic-foreign' }),
    JSON.stringify({ ...JSON.parse(valid), plan: { ...JSON.parse(valid).plan, status: 'active' } }),
    JSON.stringify({ ...JSON.parse(valid), form: { ...JSON.parse(valid).form, fat: 99 } }), 'x'.repeat(250001)]) {
    first.storage.data.set(key, bad)
    const next = setup(first.storage); assert.ok(next.loadError); assert.equal(next.restored, false)
    generate(next.controller); assert.equal(await next.controller.save(), false)
    assert.equal(first.storage.data.get(key), bad)
  }
})

test('quota errors, silent drops and stale tabs retain corrections without success receipts', async () => {
  for (const write of [() => { throw Error('synthetic quota') }, () => {}]) {
    const storage = memoryStorage(); storage.setItem = write
    const { controller: c } = setup(storage); generate(c); c.editGrams(0, 0, '99')
    assert.equal(await c.save(), false); assert.equal(c.snapshot().saved, null)
    assert.equal(c.snapshot().meals[0].items[0].grams, '99'); assert.match(c.snapshot().error, /ikke bekræftet/)
  }
  const storage = memoryStorage(), a = setup(storage), b = setup(storage)
  generate(a.controller); generate(b.controller); await a.controller.save()
  const before = [...storage.data.values()][0]
  assert.equal(await b.controller.save(), false); assert.equal([...storage.data.values()][0], before)
  assert.equal(b.controller.snapshot().saved, null)
})
