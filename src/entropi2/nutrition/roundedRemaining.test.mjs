import test from 'node:test'
import assert from 'node:assert/strict'
import { createNutritionController } from './controller.mjs'
import { mountNutrition } from './view.mjs'
import { mountNutritionScreen } from './index.mjs'
import { displayNumber, remainingToday } from './startModel.mjs'
import { syntheticHost, flush } from './synthetic-dom.mjs'

const id = 'synthetic-rounded', date = '2026-11-03'
const row = (kcal, protein) => ({ athlete_id: id, date, meal: 'Synthetic decimal meal', kcal, protein, carb: 0, fat: 0 })
async function check(rows, expected, goals = { kcal_target: 2400, protein_target: 160 }) {
  const host = syntheticHost()
  const controller = createNutritionController({ enabled: true, athlete: { id, ...goals }, date,
    contracts: { async load() { return rows } } })
  const cleanup = mountNutrition(host, controller)
  try {
    await flush()
    const lines = host.querySelectorAll('p').filter(p => p.textContent.startsWith('Tilbage i dag:'))
    assert.deepEqual(lines.map(p => p.textContent), expected === null ? [] : ['Tilbage i dag: ' + expected])
    return controller.snapshot()
  } finally { cleanup(); assert.equal(host.textContent, '') }
}

test('rounded remaining: 2399.96/2400 and 159.96/160 reach each goal independently', async () => {
  await check([row(2399.96, 159.96)], 'Energi nået · Protein nået')
  await check([row(2399.96, 118)], 'Energi nået · 42 g protein')
  await check([row(1550, 159.96)], '850 kcal · Protein nået')
  await check([row(2399.96, 118)], 'Energi nået', { kcal_target: 2400 })
  await check([row(1550, 159.96)], 'Protein nået', { protein_target: 160 })
})

test('rounded remaining: exactly 0.05 and 0.06 under still display 0.1', async () => {
  assert.equal(displayNumber(0.05), '0,1')
  assert.equal(displayNumber(0.06), '0,1')
  await check([row(2399.95, 159.95)], '0,1 kcal · 0,1 g protein')
  await check([row(2399.94, 159.94)], '0,1 kcal · 0,1 g protein')
  await check([row(2399.96, 159.94)], 'Energi nået · 0,1 g protein')
  await check([row(2399.94, 159.96)], '0,1 kcal · Protein nået')
})

test('rounded remaining: multiple decimal meals sum to their targets', async () => {
  await check([row(800.1, 50.1), row(800.2, 50.2), row(799.7, 59.7)], 'Energi nået · Protein nået')
  const snapshot = await check([row(0.1, 0.1), row(0.7, 0.7), row(0.1, 0.1)],
    'Energi nået · Protein nået', { kcal_target: 0.9, protein_target: 0.9 })
  assert.ok(snapshot.totals.kcal < 0.9) // Exercise positive binary floating-point residue.
  assert.ok(remainingToday(snapshot.totals, snapshot.targets).kcal > 0)
})

test('rounded remaining: ordinary, exceeded, empty, missing and invalid states survive', async () => {
  await check([row(1550, 118)], '850 kcal · 42 g protein')
  await check([row(2500, 180)], 'Energi nået · Protein nået')
  await check([], '2.400 kcal · 160 g protein')
  await check([row(1550, 118)], null, {})
  await check([row(1550, 118)], null, { kcal_target: 0, protein_target: -1 })
  for (const bad of [NaN, Infinity, -1, 'bad', null, '']) await check([row(bad, 118)], null)
  for (const bad of [NaN, Infinity, -1, 'bad', null, '']) await check([row(1550, bad)], null)
  assert.deepEqual(remainingToday({ kcal: 2399.96, protein: 159.96 }, { kcal: 2400, protein: 160 }),
    { kcal: 2400 - 2399.96, protein: 160 - 159.96 }) // Model precision is preserved.
})

test('rounded remaining: OFF touches neither host nor dependencies', () => {
  const poison = new Proxy({}, { get() { throw Error('OFF access') } })
  for (const enabled of [undefined, false, 0, 'true', 1]) {
    assert.equal(createNutritionController({ enabled, athlete: poison, contracts: poison }), null)
    mountNutrition(poison, null)()
    mountNutritionScreen(poison, { entropi2: enabled, client: poison, storage: poison })()
  }
})
