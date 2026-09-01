import test from 'node:test'
import assert from 'node:assert/strict'
import { foldNavn, grundnavn, byggKategoriOpslag, kategoriFor, erHovedloeft } from './exerciseNames.js'

// Udsnit af det rigtige exercise_library (alle navne med aeoeaa, som i basen).
const LIB = [
  { name: 'Bænkpres', category: 'Bænkpres' },
  { name: 'Pause bænkpres', category: 'Bænkpres' },
  { name: 'Close grip bænkpres', category: 'Bænkpres' },
  { name: 'Dødløft', category: 'Dødløft' },
  { name: 'Sumo dødløft', category: 'Dødløft' },
  { name: 'Rumænsk dødløft', category: 'Dødløft' },
  { name: 'Squat', category: 'Squat' },
  { name: 'Pause squat', category: 'Squat' },
  { name: 'Slingshot Bænkpres', category: 'Accessory' },
]
const OPSLAG = byggKategoriOpslag(LIB)

test('begge stavemaader rammer samme kategori', () => {
  for (const [navn, kat] of [
    ['Bænkpres', 'Bænkpres'], ['Baenkpres', 'Bænkpres'],
    ['Dødløft', 'Dødløft'], ['Doedloeft', 'Dødløft'],
    ['Sumo dødløft', 'Dødløft'], ['Sumo doedloeft', 'Dødløft'],
    ['Rumænsk dødløft', 'Dødløft'], ['Rumaensk doedloeft', 'Dødløft'],
  ]) assert.equal(kategoriFor(navn, OPSLAG), kat, navn)
})

test('det der faktisk faldt ud af graferne er tilbage', () => {
  // Emmas og Marcs logs fra 17/8 og frem laa under disse navne.
  for (const navn of ['Baenkpres', 'Doedloeft', 'Rumaensk doedloeft', 'Sumo doedloeft'])
    assert.notEqual(kategoriFor(navn, OPSLAG), null, `${navn} skal have en kategori`)
})

test('suffiks-varianter finder grundnavnets kategori', () => {
  assert.equal(kategoriFor('Bænkpres - topsæt', OPSLAG), 'Bænkpres')
  assert.equal(kategoriFor('Baenkpres - topsaet', OPSLAG), 'Bænkpres')
  assert.equal(kategoriFor('Bænkpres - backoff', OPSLAG), 'Bænkpres')
  assert.equal(kategoriFor('Bænkpres (comp)', OPSLAG), 'Bænkpres')
  assert.equal(kategoriFor('Baenkpres (comp) - topsaet', OPSLAG), 'Bænkpres')
  assert.equal(kategoriFor('Dødløft back-off', OPSLAG), 'Dødløft')
  assert.equal(kategoriFor('Bænkpres (2. eksp.)', OPSLAG), 'Bænkpres')
})

test('topsaet og backoff er stadig FORSKELLIGE oevelser i historikken', () => {
  // Kategorien er faelles, men navnene maa aldrig smelte sammen -
  // det er to forskellige belastninger.
  assert.notEqual(foldNavn('Bænkpres - topsæt'), foldNavn('Bænkpres - backoff'))
})

test('gaetter ikke: ukendt oevelse giver null, ikke en kategori', () => {
  assert.equal(kategoriFor('Face pulls', OPSLAG), null)
  assert.equal(kategoriFor('Leg curl', OPSLAG), null)
  assert.equal(kategoriFor('', OPSLAG), null)
  assert.equal(kategoriFor(null, OPSLAG), null)
  assert.equal(kategoriFor('Bænkpres', null), null)
})

test('grundnavn skraeller kun vores egne suffikser af', () => {
  assert.equal(grundnavn('Bænkpres - topsæt'), 'Bænkpres')
  assert.equal(grundnavn('Slingshot bænkpres - backoff'), 'Slingshot bænkpres')
  // Rigtige oevelsesnavne med bindestreg maa IKKE skaeres over.
  assert.equal(grundnavn('Close-grip bænkpres'), 'Close-grip bænkpres')
  assert.equal(grundnavn('Bulgarian split squat'), 'Bulgarian split squat')
})

test('hovedloeft-detektion er stavemaade-uafhaengig', () => {
  for (const n of ['Bænkpres', 'Baenkpres', 'Dødløft', 'Doedloeft', 'Squat', 'Sumo doedloeft'])
    assert.equal(erHovedloeft(n), true, n)
  assert.equal(erHovedloeft('Face pulls'), false)
  assert.equal(erHovedloeft(null), false)
})

test('taaler skrald uden at kaste', () => {
  for (const v of [null, undefined, 42, {}, []]) {
    assert.doesNotThrow(() => foldNavn(v))
    assert.doesNotThrow(() => grundnavn(v))
    assert.doesNotThrow(() => kategoriFor(v, OPSLAG))
  }
  assert.doesNotThrow(() => byggKategoriOpslag(null))
  assert.doesNotThrow(() => byggKategoriOpslag([{ navn: 'mangler felter' }, null]))
})
