import test from 'node:test'
import assert from 'node:assert/strict'
import { FRI_MAKS, FRI_NIVEAUER, FRI_STOERRELSER, friProcent, friFraBasis, medFriPct, fordelDag, skalerMaaltider, friStatus, friPost, friUge, erFriRaekke, uplanlagteRaekker } from './friPulje.mjs'
import { readAthletePlan } from './atlet/dayModel.mjs'

// Syntetiske fødevarer pr. 100 g (ingen rigtige data).
const food = (id, grams, kcal100, protein100, carb100, fat100) => ({ id, name: id, grams, kcal100, protein100, carb100, fat100 })
const meals = () => [
  { id: 'm1', name: 'Morgen', foods: [food('f1', 100, 380, 13, 66, 7), food('f2', 250, 60, 10, 4, 1)] },
  { id: 'm2', name: 'Middag', foods: [food('f3', 150, 165, 31, 0, 4), food('f4', 200, 130, 3, 28, 0.3), food('f5', 15, 884, 0, 0, 100)] },
]
const sum = (list, key) => list.flatMap(m => m.foods).reduce((n, f) => n + f[key + '100'] * f.grams / 100, 0)

test('friProcent: mangler = 0, 30 er loft, ugyldigt = 0', () => {
  assert.equal(friProcent(undefined), 0)
  assert.equal(friProcent(null), 0)
  assert.equal(friProcent('abc'), 0)
  assert.equal(friProcent(-5), 0)
  assert.equal(friProcent(15), 15)
  assert.equal(friProcent('15'), 15)
  assert.equal(friProcent(45), FRI_MAKS)
  assert.equal(FRI_MAKS, 30)
  assert.deepEqual([...FRI_NIVEAUER], [0, 10, 15, 20, 30])
})

test('friFraBasis og medFriPct: niveauet ligger i calculation_basis uden at miste andre felter', () => {
  assert.equal(friFraBasis({ weight_trend: null }), 0)
  assert.equal(friFraBasis(null), 0)
  assert.equal(friFraBasis({ fri_pct: 20 }), 20)
  assert.deepEqual(medFriPct({ weight_trend: null }, 15), { weight_trend: null, fri_pct: 15 })
  assert.equal(medFriPct(null, 99).fri_pct, 30)
})

test('fordelDag: base + pulje = dagens kcal og protein uændret', () => {
  for (const pct of FRI_NIVEAUER) {
    const d = fordelDag({ kcal: 2800, protein: 190 }, pct)
    assert.equal(d.baseKcal + d.friKcal, 2800)
    assert.equal(d.protein, 190)
    assert.ok(Math.abs(d.friKcal - 2800 * pct / 100) <= 0.5)
  }
  assert.equal(fordelDag({ kcal: 2800, protein: 190 }, undefined).friKcal, 0)
  assert.equal(fordelDag({ kcal: 2800, protein: 190 }, 60).friKcal, 840)
})

test('skalerMaaltider: protein uændret og base inden for 1 % for alle niveauer', () => {
  const foer = meals()
  const kcal = sum(foer, 'kcal'), protein = sum(foer, 'protein')
  for (const pct of FRI_NIVEAUER.filter(n => n > 0)) {
    const { meals: efter } = skalerMaaltider(foer, pct)
    const base = kcal * (1 - pct / 100)
    assert.ok(Math.abs(sum(efter, 'kcal') - base) / base < 0.01, `kcal ved ${pct} %`)
    assert.ok(Math.abs(sum(efter, 'protein') - protein) / protein < 0.01, `protein ved ${pct} %`)
    assert.equal(efter.length, foer.length)
    assert.deepEqual(efter.flatMap(m => m.foods.map(f => f.id)), foer.flatMap(m => m.foods.map(f => f.id)))
  }
})

test('skalerMaaltider: 0 og manglende niveau lader måltiderne uændrede', () => {
  const foer = meals()
  assert.equal(skalerMaaltider(foer, 0).meals, foer)
  assert.equal(skalerMaaltider(foer, undefined).meals, foer)
})

test('skalerMaaltider: kun lette fødevarer skaleres ens', () => {
  const kun = [{ id: 'm', name: 'Kun kulhydrat', foods: [food('r', 200, 130, 3, 28, 0.3)] }]
  const { meals: efter } = skalerMaaltider(kun, 20)
  assert.ok(Math.abs(efter[0].foods[0].grams - 160) < 0.2)
})

const plan = (friPct, over = {}) => ({ id: 'p1', revision: 'r1', athlete_id: 'a', date: '2026-11-25', active: true,
  ...(friPct === undefined ? {} : { friPct }), targets: { kcal: sum(meals(), 'kcal'), protein: sum(meals(), 'protein'), carb: 0, fat: 0 }, meals: meals(), ...over })

test('readAthletePlan: friPct mangler = som før; med niveau skaleres basen og puljen beregnes', () => {
  const foer = readAthletePlan(plan(undefined), 'a', '2026-11-25')
  assert.equal(foer.friPct, undefined)
  assert.equal(foer.meals[0].foods[0].grams, 100)
  const efter = readAthletePlan(plan(20), 'a', '2026-11-25')
  assert.equal(efter.friPct, 20)
  assert.equal(efter.dagKcal, foer.targets.kcal)
  assert.equal(efter.friKcal, Math.round(foer.targets.kcal * 0.2))
  assert.equal(efter.targets.kcal + efter.friKcal, foer.targets.kcal)
  assert.ok(Math.abs(efter.targets.protein - foer.targets.protein) < 1e-9)
  const proteinEfter = sum(efter.meals, 'protein')
  assert.ok(Math.abs(proteinEfter - foer.targets.protein) / foer.targets.protein < 0.01)
  assert.equal(readAthletePlan(plan(0), 'a', '2026-11-25').friPct, undefined)
  assert.equal(readAthletePlan(plan(99), 'a', '2026-11-25').friPct, 30)
})

test('friStatus og friPost: brugt og tilbage tæller kun fri-rækker, lille/mellem/stor er 100/250/450 kcal', () => {
  assert.deepEqual(FRI_STOERRELSER.map(s => [s.id, s.kcal]), [['lille', 100], ['mellem', 250], ['stor', 450]])
  const logs = [{ meal: 'Morgen', kcal: 600 }, { meal: 'Fri: lille', kcal: 100 }, { meal: 'Fri: 300 kcal', kcal: '300' }]
  assert.deepEqual(friStatus({ friKcal: 420, logs }), { pulje: 420, brugt: 400, tilbage: 20, over: false })
  assert.equal(friStatus({ friKcal: 300, logs }).over, true)
  assert.equal(friStatus({ friKcal: 0, logs }).pulje, 0)
  assert.deepEqual(friPost('mellem'), { meal: 'Fri: mellem', kcal: 250, protein: 0, carb: 0, fat: 0 })
  assert.deepEqual(friPost(null, '320'), { meal: 'Fri: 320 kcal', kcal: 320, protein: 0, carb: 0, fat: 0 })
  assert.equal(friPost(null, 'abc'), null)
  assert.equal(friPost(null, '0'), null)
  assert.equal(friPost(null, '99999'), null)
  assert.equal(erFriRaekke({ meal: ' Fri: stor' }), true)
  assert.equal(erFriRaekke({ meal: 'Frikadeller' }), false)
})

test('friUge: basemåltider fulgt og dage med puljen holdt; dage uden niveau tæller ikke', () => {
  const dage = [
    { date: '2026-11-23', state: 'approved', friPct: 20, targets: { kcal: 2000 }, maaltider: ['Morgen', 'Middag'] },
    { date: '2026-11-24', state: 'approved', friPct: 20, targets: { kcal: 2000 }, maaltider: ['Morgen', 'Middag'] },
    { date: '2026-11-22', state: 'approved', targets: { kcal: 2000 } },
  ]
  const raekker = [
    { date: '2026-11-23', meal: 'Morgen', kcal: 500 }, { date: '2026-11-23', meal: 'Middag', kcal: 800 }, { date: '2026-11-23', meal: 'Fri: mellem', kcal: 250 },
    { date: '2026-11-24', meal: 'Morgen', kcal: 500 }, { date: '2026-11-24', meal: 'Fri: mellem', kcal: 250 }, { date: '2026-11-24', meal: 'Fri: stor', kcal: 450 },
  ]
  assert.deepEqual(friUge({ dage, raekker }), { basis: 3, basisAf: 4, holdt: 1, vurderede: 2, dage: 2 })
  assert.equal(friUge({ dage: [dage[2]], raekker }), null)
})

test('friUge: to planmåltider med samme navn tæller kun lige så mange gange, som de er logget (2146)', () => {
  const dage = [{ date: '2026-11-24', state: 'approved', friPct: 15, targets: { kcal: 2000 }, maaltider: ['Morgen', 'Snack', 'Snack'] }]
  const en = [{ date: '2026-11-24', meal: 'Snack', kcal: 100 }]
  const to = [{ date: '2026-11-24', meal: 'Snack', kcal: 100 }, { date: '2026-11-24', meal: ' Snack', kcal: 100 }, { date: '2026-11-24', meal: 'Morgen', kcal: 400 }]
  assert.equal(friUge({ dage, raekker: en }).basis, 1)
  assert.deepEqual(friUge({ dage, raekker: to }), { basis: 3, basisAf: 3, holdt: 1, vurderede: 1, dage: 1 })
})

test('2193: uplanlagt mad uden "Fri: " tæller som brugt pulje i friStatus og friUge, planmåltider og dagskvittering gør ikke', () => {
  const plan = ['Morgen', 'Middag', 'Aften']
  const base = plan.map(meal => ({ meal, kcal: 600 }))
  const ekstra = { meal: 'Ekstra pizza', kcal: 900 }
  const kvittering = { meal: '[appData2-day-v1]["x"]', kcal: 0 }
  assert.deepEqual(uplanlagteRaekker([...base, ekstra, kvittering, { meal: 'Fri: lille', kcal: 100 }], plan), [ekstra])
  // Uden kendt base regnes der som før kun på "Fri: "-rækkerne.
  assert.deepEqual(uplanlagteRaekker([...base, ekstra], undefined), [])
  assert.deepEqual(friStatus({ friKcal: 300, logs: [...base, ekstra] }), { pulje: 300, brugt: 0, tilbage: 300, over: false })
  assert.deepEqual(friStatus({ friKcal: 300, logs: [...base, ekstra], planNavne: plan }), { pulje: 300, brugt: 900, tilbage: -600, over: true })
  // Fri-række og uplanlagt række lægges sammen; en lille uplanlagt post inden for puljen holder den.
  assert.deepEqual(friStatus({ friKcal: 400, logs: [...base, { meal: 'Fri: lille', kcal: 100 }, { meal: 'Frugt', kcal: 150 }], planNavne: plan }),
    { pulje: 400, brugt: 250, tilbage: 150, over: false })
  // Et planmåltid logget to gange: anden række er uplanlagt.
  assert.equal(friStatus({ friKcal: 1000, logs: [...base, { meal: 'Morgen', kcal: 600 }], planNavne: plan }).brugt, 600)
  const dag = { date: '2026-11-24', state: 'approved', friPct: 15, targets: { kcal: 2400 }, maaltider: plan }
  const r = date => base.map(row => ({ ...row, date }))
  const medEkstra = [...r(dag.date), { ...ekstra, date: dag.date }]
  assert.deepEqual(friUge({ dage: [dag], raekker: r(dag.date) }), { basis: 3, basisAf: 3, holdt: 1, vurderede: 1, dage: 1 })
  assert.deepEqual(friUge({ dage: [dag], raekker: medEkstra }), { basis: 3, basisAf: 3, holdt: 0, vurderede: 1, dage: 1 })
  // Uplanlagt mad inden for puljen (360 kcal) er stadig holdt.
  assert.equal(friUge({ dage: [dag], raekker: [...r(dag.date), { date: dag.date, meal: 'Kage', kcal: 360 }] }).holdt, 1)
})
