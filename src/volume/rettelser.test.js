// ORDRE 185, commit 3. Samme in-memory fake-storage-mønster som
// readinessDraft.test.js.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hentRettelser, gemRettelse, fjernRettelse } from './rettelser.js'
import { PRIMÆR, MEDVIRKENDE } from './muskelkort.js'

function fakeStorage() {
  const map = new Map()
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)) },
    removeItem: (k) => { map.delete(k) },
  }
}

test('ingen rettelser gemt endnu: hentRettelser giver et tomt Map', () => {
  const storage = fakeStorage()
  assert.equal(hentRettelser(storage).size, 0)
})

test('gem, hent, find igen — nøglet på normaliseret navn', () => {
  const storage = fakeStorage()
  const ok = gemRettelse({ oevelseNavn: 'Zercher squat', grupper: [{ gruppe: 'kneeExtensors', andel: PRIMÆR }] }, storage)
  assert.equal(ok, true)
  const rettelser = hentRettelser(storage)
  assert.equal(rettelser.size, 1)
  const r = rettelser.get('zercher squat')
  assert.equal(r.oevelseNavn, 'Zercher squat')
  assert.deepEqual(r.grupper, [{ gruppe: 'kneeExtensors', andel: PRIMÆR }])
  assert.equal(r.satAf, 'Marc')
})

test('stavevariant/suffiks rammer samme rettelse som grundnavnet (samme normalisering som muskelkort.js)', () => {
  const storage = fakeStorage()
  gemRettelse({ oevelseNavn: 'Bænkpres', grupper: [{ gruppe: 'triceps', andel: PRIMÆR }] }, storage)
  const rettelser = hentRettelser(storage)
  assert.ok(rettelser.has('baenkpres'))
  assert.ok(rettelser.get('baenkpres'))
})

test('gem igen for samme øvelse overskriver, opretter ikke to poster', () => {
  const storage = fakeStorage()
  gemRettelse({ oevelseNavn: 'Roning', grupper: [{ gruppe: 'lats', andel: PRIMÆR }] }, storage)
  gemRettelse({ oevelseNavn: 'Roning', grupper: [{ gruppe: 'lats', andel: PRIMÆR }, { gruppe: 'biceps', andel: MEDVIRKENDE }] }, storage)
  const rettelser = hentRettelser(storage)
  assert.equal(rettelser.size, 1)
  assert.equal(rettelser.get('roning').grupper.length, 2)
})

test('fjernRettelse sletter — hentRettelser ser den ikke mere', () => {
  const storage = fakeStorage()
  gemRettelse({ oevelseNavn: 'Roning', grupper: [{ gruppe: 'lats', andel: PRIMÆR }] }, storage)
  const fjernet = fjernRettelse('Roning', storage)
  assert.equal(fjernet, true)
  assert.equal(hentRettelser(storage).size, 0)
})

test('fjernRettelse for en øvelse uden rettelse: false, ingen fejl', () => {
  const storage = fakeStorage()
  assert.equal(fjernRettelse('Findes ikke', storage), false)
})

test('gemRettelse afviser ugyldig andel (kun PRIMÆR/MEDVIRKENDE er tilladt)', () => {
  const storage = fakeStorage()
  const ok = gemRettelse({ oevelseNavn: 'Test', grupper: [{ gruppe: 'lats', andel: 0.75 }] }, storage)
  assert.equal(ok, false)
  assert.equal(hentRettelser(storage).size, 0)
})

test('gemRettelse afviser tomt navn eller tom grupperliste', () => {
  const storage = fakeStorage()
  assert.equal(gemRettelse({ oevelseNavn: '', grupper: [{ gruppe: 'lats', andel: 1 }] }, storage), false)
  assert.equal(gemRettelse({ oevelseNavn: 'Noget', grupper: [] }, storage), false)
})

test('en fejlende storage (fx privat vindue) vælter ikke, returnerer false/tomt', () => {
  const throwingStorage = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') }, removeItem: () => { throw new Error('blocked') } }
  assert.equal(gemRettelse({ oevelseNavn: 'Test', grupper: [{ gruppe: 'lats', andel: 1 }] }, throwingStorage), false)
  assert.equal(hentRettelser(throwingStorage).size, 0)
  assert.doesNotThrow(() => fjernRettelse('Test', throwingStorage))
})
