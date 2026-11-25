// 2366 (kost stop 1): Marc og atleten ser de samme gram. Skalerede gram er hele tal i trin af 5 g.
import test from 'node:test'
import assert from 'node:assert/strict'
import { skalerMaaltider, FRI_NIVEAUER } from './friPulje.mjs'
import { readAthletePlan } from './atlet/dayModel.mjs'

// Syntetiske fødevarer pr. 100 g (ingen rigtige data).
const food = (id, grams, kcal100, protein100, carb100, fat100) => ({ id, name: id, grams, kcal100, protein100, carb100, fat100 })
const uge = () => [
  { id: 'm1', name: 'Morgenmad', foods: [food('havre', 40, 370, 13, 60, 7), food('skyr', 205, 62, 11, 4, 0.2), food('banan', 240, 89, 1.1, 23, 0.3)] },
  { id: 'm2', name: 'Frokost', foods: [food('kylling', 150, 165, 31, 0, 4), food('ris', 200, 130, 3, 28, 0.3), food('olie', 15, 884, 0, 0, 100)] },
  { id: 'm3', name: 'Aftensmad', foods: [food('laks', 160, 208, 20, 0, 13), food('kartoffel', 300, 77, 2, 17, 0.1), food('broccoli', 120, 34, 2.8, 7, 0.4)] },
]
const sum = (list, key) => list.flatMap(m => m.foods).reduce((n, f) => n + f[key + '100'] * f.grams / 100, 0)
const plan = (friPct, meals = uge()) => ({ id: 'p1', revision: 'r1', athlete_id: 'a', date: '2026-11-25', active: true, friPct,
  targets: { kcal: sum(meals, 'kcal'), protein: sum(meals, 'protein'), carb: 0, fat: 0 }, meals })
const femGram = g => Number.isInteger(g) && g % 5 === 0 && g >= 5

test('hvert skaleret gram er et helt tal i trin af 5 g ved alle niveauer', () => {
  for (const pct of FRI_NIVEAUER.filter(n => n > 0)) {
    const dag = readAthletePlan(plan(pct), 'a', '2026-11-25')
    for (const meal of dag.meals) {
      for (const f of meal.foods) assert.ok(femGram(f.grams), `${f.id} ${f.grams} g ved ${pct} %`)
      const gramTotal = meal.foods.reduce((n, f) => n + f.grams, 0) // spist-rækken: "Spist: Morgenmad · N g"
      assert.ok(femGram(gramTotal), `${meal.name} samlet ${gramTotal} g ved ${pct} %`)
    }
  }
})

test('kcal og protein ligger inden for 5 % af basens mål (alle planmåltider samlet)', () => {
  for (const pct of FRI_NIVEAUER.filter(n => n > 0)) {
    const foer = uge()
    const kcal = sum(foer, 'kcal'), protein = sum(foer, 'protein')
    const dag = readAthletePlan(plan(pct), 'a', '2026-11-25')
    const base = kcal * (1 - pct / 100)
    assert.ok(Math.abs(sum(dag.meals, 'kcal') - base) / base <= 0.05, `kcal ${sum(dag.meals, 'kcal')} mod base ${base} ved ${pct} %`)
    assert.ok(Math.abs(sum(dag.meals, 'protein') - protein) / protein <= 0.05, `protein ved ${pct} %`)
  }
})

test('skalerMaaltider selv: samme krav, og 0 % lader gram uændrede', () => {
  const { meals: efter } = skalerMaaltider(uge(), 15)
  for (const f of efter.flatMap(m => m.foods)) assert.ok(femGram(f.grams), `${f.id} ${f.grams}`)
  assert.deepEqual(skalerMaaltider(uge(), 0).meals.flatMap(m => m.foods.map(f => f.grams)), uge().flatMap(m => m.foods.map(f => f.grams)))
})
