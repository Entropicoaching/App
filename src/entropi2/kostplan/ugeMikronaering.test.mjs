// U10d (ordre 117): mikronæring fra planen som 7-dages snit. Rene prøver uden net og ur.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MIN_DAEKNING, NNR2023, anbefaling, medMikronaering, ugeMikronaering } from './ugeMikronaering.mjs'
import { ugeMikronaeringView } from './coach/UgeMikronaering.mjs'

// Syntetiske fødevarer med runde tal, så de forventede værdier kan regnes i hovedet.
const kilde = { citation: 'Syntetisk prøvevare', verification: 'Kun til prøver' }
const vare = (id, n) => ({ id, name: id, preparation: 'rå', basisGrams: 100, source: kilde,
  nutrientsPer100g: { energyKcal: 100, proteinG: 10, ironMg: null, calciumMg: null, vitaminDUg: null,
    magnesiumMg: null, potassiumMg: null, ...n } })
const fuld = vare('fuld', { ironMg: 1, calciumMg: 100, vitaminDUg: 1, magnesiumMg: 30, potassiumMg: 300 })
const uden = vare('uden', {})
const version = (portions, id = 'v') => ({ id, goal: 'vedligehold', intensity: 0.5,
  meals: [{ name: 'Måltid', portions: portions.map(([food, grams]) => ({ food, grams })) }] })
const uge = dag => Array.from({ length: 7 }, (_, i) => dag(i))
const kvinde = { sex: 'f', age: 28 }, mand = { sex: 'm', age: 30 }
const stof = (resultat, nutrient) => resultat.stoffer.find(s => s.nutrient === nutrient)

test('kendt testuge giver forventede 7-dages snit og procent af NNR 2023', () => {
  // 1.000 g "fuld" pr. dag: 10 mg jern, 1.000 mg calcium og 10 µg D-vitamin.
  const r = ugeMikronaering(uge(() => version([[fuld, 1000]])), kvinde)
  assert.equal(r.status, 'klar')
  assert.deepEqual(r.stoffer.map(s => s.nutrient), ['ironMg', 'vitaminDUg', 'calciumMg', 'magnesiumMg', 'potassiumMg'])
  assert.deepEqual([stof(r, 'ironMg').snit, stof(r, 'ironMg').anbefalet, stof(r, 'ironMg').procent], [10, 15, 67])
  assert.deepEqual([stof(r, 'vitaminDUg').snit, stof(r, 'vitaminDUg').procent], [10, 100])
  assert.deepEqual([stof(r, 'calciumMg').snit, stof(r, 'calciumMg').anbefalet, stof(r, 'calciumMg').procent], [1000, 950, 105])
  assert.deepEqual([stof(r, 'magnesiumMg').snit, stof(r, 'magnesiumMg').anbefalet], [300, 300])
  assert.equal(stof(r, 'ironMg').lav, true)
  assert.equal(stof(r, 'vitaminDUg').lav, false)
  const m = ugeMikronaering(uge(() => version([[fuld, 1000]])), mand)
  assert.deepEqual([stof(m, 'ironMg').anbefalet, stof(m, 'ironMg').procent, stof(m, 'magnesiumMg').anbefalet], [9, 111, 350])
})

test('tallet er et 7-dages snit og ikke dagens eller en enkelt dags tal', () => {
  // Kun mandag har 7.000 g; resten 100 g. Snit = (70 + 6 × 1) / 7 = 10,857 mg jern.
  const r = ugeMikronaering(uge(i => version([[fuld, i === 0 ? 7000 : 100]])), mand)
  assert.equal(stof(r, 'ironMg').snit.toFixed(3), (76 / 7).toFixed(3))
  assert.notEqual(stof(r, 'ironMg').snit, 70)
  assert.notEqual(stof(r, 'ironMg').snit, 1)
  const html = renderToStaticMarkup(ugeMikronaeringView(h, r))
  assert.match(html, /snit/)
  assert.doesNotMatch(html, /pr\. dag|i dag/)
})

test('under 90 % datadækning af energien giver "ukendt", 90 % og derover giver et tal', () => {
  assert.equal(MIN_DAEKNING, 0.9)
  // 89 % af energien har data: ukendt. 90 %: tallet vises og tæller kun det kendte.
  const lav = ugeMikronaering(uge(() => version([[fuld, 890], [uden, 110]])), mand)
  assert.equal(lav.status, 'klar')
  for (const s of lav.stoffer) {
    assert.equal(s.snit, null)
    assert.equal(s.procent, null)
    assert.equal(s.daekning.toFixed(2), '0.89')
  }
  const ok = ugeMikronaering(uge(() => version([[fuld, 900], [uden, 100]])), mand)
  assert.equal(stof(ok, 'ironMg').snit, 9)
  const html = renderToStaticMarkup(ugeMikronaeringView(h, lav))
  assert.match(html, /Jern ukendt/)
  assert.match(html, /D-vitamin ukendt/)
  assert.match(html, /Calcium ukendt/)
  assert.doesNotMatch(html, /\d+ %(?! af energien)/)
})

test('en manglende, tom eller ulæselig dag gør hele ugen ukendt', () => {
  const fuldUge = uge(() => version([[fuld, 1000]]))
  for (const dage of [fuldUge.slice(0, 6), [...fuldUge.slice(0, 6), null],
    [...fuldUge.slice(0, 6), { ...fuldUge[0], meals: [] }], [...fuldUge.slice(0, 6), { meals: 'x' }]]) {
    const r = ugeMikronaering(dage, mand)
    assert.equal(r.status, 'ukendt')
    assert.ok(r.stoffer.every(s => s.snit === null))
  }
})

test('referencer har kilde og findes kun for de aldre, kilden dækker; ukendt køn giver intet jerntal', () => {
  assert.match(NNR2023.kilde, /Nordic Nutrition Recommendations 2023/)
  assert.match(NNR2023.kilde, /doi:10\.6027\/nord2023-003/)
  assert.equal(anbefaling('calciumMg', { sex: 'f', age: 20 }).vaerdi, 1000)
  assert.equal(anbefaling('calciumMg', { sex: 'f', age: 25 }).vaerdi, 950)
  assert.equal(anbefaling('ironMg', { sex: null, age: 30 }), null)
  assert.equal(anbefaling('vitaminDUg', { sex: null, age: 30 }).vaerdi, 10)
  assert.equal(anbefaling('ironMg', { sex: 'f', age: 51 }), null)
  assert.equal(anbefaling('vitaminDUg', { sex: 'm', age: 17 }), null)
  assert.equal(anbefaling('calciumMg', { sex: 'm' }), null)
  assert.equal(anbefaling('magnesiumMg', mand).type, 'AI')
  const r = ugeMikronaering(uge(() => version([[fuld, 1000]])), { sex: null, age: 30 })
  assert.equal(stof(r, 'ironMg').snit, 10)
  assert.equal(stof(r, 'ironMg').procent, null)
  assert.match(renderToStaticMarkup(ugeMikronaeringView(h, r)), /Jern 10 mg/)
})

test('coachens linje: tre stoffer i den foldede linje, én kort linje pr. stof, kilde og stille mærke under 70 %', () => {
  const r = ugeMikronaering(uge(() => version([[fuld, 400]])), kvinde)
  const html = renderToStaticMarkup(ugeMikronaeringView(h, r))
  assert.match(html, /<details[^>]*data-uge-mikro="klar"/)
  assert.match(html, /<summary[^>]*>Mikronæring, 7-dages snit: Jern 27 % · D-vitamin 40 % · Calcium 42 %<\/summary>/)
  assert.equal((html.match(/<li/g) || []).length, 5)
  assert.match(html, /Magnesium/)
  assert.match(html, /Kalium/)
  assert.match(html, /NNR 2023/)
  assert.match(html, /fra planen, uden tilskud, ikke en blodprøve/)
  assert.match(html, /byt en ret, fx fed fisk/)
  // Stille mærke: ingen farver, ingen alarmrolle.
  assert.doesNotMatch(html, /color|background|red|#[0-9a-f]{3,6}|role="alert"/i)
})

test('medMikronaering lægger tallene på en klar uge fra netop de viste versioner og rører ikke en tom uge', () => {
  const versions = uge(i => ({ ...version([[fuld, 1000]], `v${i}`), id: `v${i}` }))
  const week = { state: 'ready', days: versions.map(v => ({ versionId: v.id })) }
  const ny = medMikronaering(week, [...versions, { ...version([[fuld, 99999]]), id: 'gammel' }], mand)
  assert.equal(stof(ny.mikro, 'ironMg').snit, 10)
  assert.equal(ny.days, week.days)
  const tom = { state: 'empty' }
  assert.equal(medMikronaering(tom, versions, mand), tom)
})
