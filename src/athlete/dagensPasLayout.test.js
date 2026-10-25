// APP-OV4: rene layout-hjælpere til Dagens pas. "Næste øvelse" skal skrive
// præcis det samme som main (ORDRE 330 · blok 2), og B må kun være layout.
import test from 'node:test'
import assert from 'node:assert/strict'
import { exerciseViewGroups } from '../exerciseSetView.js'
import { naesteOevelse, naesteOevelseDetalje, naesteOevelseTekst, naesteKnapNavn, saetStreger, logStil, naesteKort, bundProcent, bundStil, ordinationTekst, naesteSaet } from './dagensPasLayout.mjs'

const pas = [
  { id: 'e1', name: 'Squat', sets: 5, reps: '3' },
  { id: 'e2', name: 'Bænkpres', sets: 4, reps: '5' },
  { id: 'e3', name: 'Rows', sets: 3, reps: '8-10' },
]

test('Næste øvelse: navn, sæt, reps og antal efter den, som på main', () => {
  const n = naesteOevelse(exerciseViewGroups(pas), 'e1')
  assert.equal(n.name, 'Bænkpres')
  assert.equal(naesteOevelseDetalje(n), ' · 4 sæt × 5 (+1)')
  assert.equal(naesteOevelse(exerciseViewGroups(pas), 'e3'), null)
})

test('R1-APP-OV4: knappens navn siger hele main-linjen, også sæt, reps og (+n)', () => {
  const n = naesteOevelse(exerciseViewGroups(pas), 'e1')
  assert.equal(naesteOevelseTekst(n), 'Næste øvelse: Bænkpres · 4 sæt × 5 (+1)')
  assert.equal(naesteKnapNavn(n, 50), 'Næste øvelse: Bænkpres · 4 sæt × 5 (+1). Hele passet, 50 % afsluttet')
  assert.equal(naesteKnapNavn(null, 100), 'Sidste øvelse i passet. Hele passet, 100 % afsluttet')
})

test('sætstregerne følger det aktuelle sæt', () => {
  assert.deepEqual(saetStreger({ setNumber: 2, total: 3 }), ['klaret', 'aktuelt', 'senere'])
})

test('APP-OV7: kun B, også uden valg og med gamle variantværdier', () => {
  const st = logStil()
  assert.equal(st.variant, 'B')
  for (const tidligereValg of ['A', 'B', undefined, null, '', 'ukendt']) {
    assert.deepEqual({ ...logStil(tidligereValg), ekstraKnap: null }, { ...st, ekstraKnap: null })
    for (const aktiv of [false, true]) assert.deepEqual(logStil(tidligereValg).ekstraKnap(aktiv), st.ekstraKnap(aktiv))
  }
  assert.equal(st.fliser.gridTemplateColumns, '1fr 1fr')
  assert.equal(st.handlinger.flexDirection, 'column')
  assert.equal(st.godkendt.minHeight, '64px')
  assert.equal(st.springOver.minHeight, '44px')
  for (const key of ['stepper', 'stepperMidte', 'stepperStak', 'saetTael']) assert.equal(key in st, false)
  for (const k of ['trin', 'trinFlise', 'tekstKnap']) assert.ok(parseFloat(st[k].minHeight) >= 44, k)
})

test('APP-OV5: bunden viser næste øvelse (navn, sæt × reps) og procent i ringen', () => {
  const groups = exerciseViewGroups(pas)
  const n = naesteOevelse(groups, 'e1')
  const k = naesteKort(n, { percent: 50 })
  assert.equal(k.etiket, 'Næste øvelse')
  assert.equal(k.navn, 'Bænkpres')
  assert.equal(k.ordination, '4 sæt × 5')
  assert.equal(k.efter, '(+1)')
  assert.equal(k.procent, 50)
  assert.equal(k.streger.length, 4)
  // Alt synligt står i knappens navn (label in name).
  const navn = naesteKnapNavn(n, k.procent)
  for (const del of [k.etiket, k.navn, `${k.ordination} ${k.efter}`, `${k.procent} %`, k.handling]) assert.ok(navn.includes(del), del)
  const sidst = naesteKort(naesteOevelse(groups, 'e2'), { percent: 75 })
  assert.equal(sidst.ordination, '3 sæt × 8-10')
  assert.equal(sidst.efter, '')
  const ingen = naesteKort(null, { percent: 100 })
  assert.equal(ingen.navn, 'Sidste øvelse i passet')
  assert.ok(naesteKnapNavn(null, 100).startsWith(ingen.navn))
})

test('APP-OV5: procenten er et helt tal fra 0 til 100, og ringen tegnes med den', () => {
  assert.equal(bundProcent(49.6), 50)
  assert.equal(bundProcent(133), 100)
  assert.equal(bundProcent(-4), 0)
  assert.equal(bundProcent(undefined), 0)
  const b = bundStil(37)
  assert.equal(b.variant, 'B')
  assert.ok(b.ring.background.includes('37%'))
  assert.equal(b.ring.width, '76px')
  assert.equal(b.ringHul.width, '62px')
})

test('APP-OV5: bundarkets linje har loggens felter og format', () => {
  assert.equal(ordinationTekst({ sets: 4, reps: '5', intensity: 'RPE 8' }), '4 sæt · × 5 reps · RPE 8')
  assert.equal(ordinationTekst({ sets: 3, reps: 'AMRAP' }), '3 sæt · × AMRAP')
})

test('R2-APP-OV5: kun ét næste sæt, det første planlagte i den aktuelle øvelse', () => {
  const m = statusser => ({ rows: [
    { index: 0, current: false, sets: [{ number: 1, status: 'Planlagt' }] },
    { index: 1, current: true, sets: statusser.map((status, i) => ({ number: i + 1, status })) },
  ] })
  assert.deepEqual(naesteSaet(m(['Færdigt', 'Planlagt', 'Sprunget over', 'Planlagt'])), { index: 1, number: 2 })
  assert.deepEqual(naesteSaet(m(['Planlagt', 'Planlagt', 'Planlagt'])), { index: 1, number: 1 })
  assert.equal(naesteSaet(m(['Færdigt', 'Sprunget over', 'Færdigt'])), null)
  assert.equal(naesteSaet({ rows: [{ index: 0, current: false, sets: [{ number: 1, status: 'Planlagt' }] }] }), null)
})
