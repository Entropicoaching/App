// Ordre 2373: indkøbslisten tager hele ugen (7 dage fra i dag) og bruger de samme skalerede gram som dagen. Kun syntetiske data.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createApprovedShopping } from './approvedShoppingController.mjs'
import { shoppingDates } from './approvedShoppingModel.mjs'
import { createPlanAdapter } from '../planAdapter.mjs'
import { createPlanSnapshot } from '../planSnapshot.mjs'
import { readAthletePlan } from './dayModel.mjs'
import { shoppingFixture, today, athleteId, tableNames } from './approvedShopping.fixture.mjs'

const uge = Array.from({ length: 7 }, (_, i) => new Date(Date.parse(today + 'T00:00:00Z') + i * 86400000).toISOString().slice(0, 10))
// Den sendte uge er 7 dagsplaner i træk: forælderen på dagens dato plus seks til.
const nu = (f, ugen = true) => {
  f.data[tableNames[1]][0].effective_from = today
  if (ugen) uge.slice(1).forEach((d, i) => f.plan(70200 + i, d, 'godkendt', athleteId))
  return f
}
const controller = (f, extra = {}) => createApprovedShopping({ enabled: true, client: f.client, athleteId, today, ...extra })

test('2373 (a): alle 7 dage i ugen kan vælges, også i dag, og standardvalget er resten af ugen fra i dag', async t => {
  assert.deepEqual(shoppingDates(today, uge), uge)
  assert.throws(() => shoppingDates(today, [...uge, '2026-11-14']))
  const f = nu(shoppingFixture()), c = controller(f); t.after(c.dispose)
  assert.deepEqual(c.snapshot().dates, uge)
  assert.equal(await c.load(), true)
  assert.deepEqual(c.snapshot().result.dates, uge)
  assert.equal(await c.choose(uge.slice(0, 2)), true)
  assert.deepEqual(c.snapshot().result.dates, uge.slice(0, 2))
  assert.equal(await c.choose(uge), true)
  assert.equal(c.snapshot().result.days.length, 7)
})

test('2373: uden en sendt uge er standardvalget uændret de tre næste dage, og Hele ugen er ét valg', async t => {
  const f = nu(shoppingFixture(), false), c = controller(f); t.after(c.dispose)
  assert.equal(await c.load(), true)
  assert.deepEqual(c.snapshot().result.dates, uge.slice(1, 4))
  assert.equal(await c.choose(uge), true)
  assert.deepEqual(c.snapshot().result.dates, uge)
})

test('2373 (b): mængderne er summen af de gram, dagen viser efter skalering og 5 g-afrunding', async t => {
  const f = nu(shoppingFixture())
  const mad = (name, kcal, protein) => ({ id: 'synthetic:' + name, name, preparation: 'rå', basisGrams: 100,
    nutrientsPer100g: { energyKcal: kcal, proteinG: protein, carbohydrateG: 10, fatG: 5 },
    source: { citation: 'Syntetisk katalog A', verification: 'Syntetisk test, ikke verificeret' } })
  const snap = createPlanSnapshot({ goal: 'vedligehold', intensity: 0, meals: [
    { name: 'Morgenmad', portions: [{ grams: 40, food: mad('Havre', 370, 13) }, { grams: 205, food: mad('Skyr', 60, 11) }, { grams: 240, food: mad('Banan', 90, 1) }] },
    { name: 'Aftensmad', portions: [{ grams: 150, food: mad('Kylling', 110, 23) }, { grams: 300, food: mad('Ris', 130, 3) }] }] })
  for (const row of f.data[tableNames[1]]) Object.assign(row, structuredClone(snap), { calculation_basis: { fri_pct: 15 } })
  const c = controller(f); t.after(c.dispose)
  assert.equal(await c.load(), true)
  const expected = new Map()
  for (const date of uge) {
    const active = await createPlanAdapter({ enabled: true, client: f.client, athleteId, date }).loadActive()
    const dag = readAthletePlan(active, athleteId, date)
    for (const meal of dag.meals) for (const food of meal.foods) expected.set(food.name, (expected.get(food.name) ?? 0) + food.grams)
  }
  const raa = { Havre: 40, Skyr: 205, Banan: 240, Kylling: 150, Ris: 300 }
  const faktisk = new Map(c.snapshot().result.items.map(i => [i.names[0], Number(i.grams)]))
  assert.ok(expected.size === 5 && [...expected.values()].every(g => g % 5 === 0))
  assert.deepEqual(Object.fromEntries(faktisk), Object.fromEntries(expected))
  assert.notEqual(faktisk.get('Havre'), raa.Havre * 7)
})
