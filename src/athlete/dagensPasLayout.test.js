// APP-OV4: rene layout-hjælpere til Dagens pas. "Næste øvelse" skal skrive
// præcis det samme som main (ORDRE 330 · blok 2), og A/B må kun være layout.
import test from 'node:test'
import assert from 'node:assert/strict'
import { exerciseViewGroups } from '../exerciseSetView.js'
import { naesteOevelse, naesteOevelseDetalje, naesteOevelseTekst, naesteKnapNavn, saetStreger, logVariant, logStil } from './dagensPasLayout.mjs'

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

test('kun A og B; trykflader mindst 44 px i begge', () => {
  assert.equal(logVariant('B'), 'B')
  assert.equal(logVariant('noget andet'), 'A')
  for (const v of ['A', 'B']) {
    const st = logStil(v)
    for (const k of ['trin', 'trinFlise', 'tekstKnap']) assert.ok(parseFloat(st[k].minHeight) >= 44, `${v}.${k}`)
  }
})
