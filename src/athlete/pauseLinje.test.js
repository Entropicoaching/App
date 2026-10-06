import { test } from 'node:test'
import assert from 'node:assert/strict'
import { visTid, harSetPauseForklaring, markerPauseForklaring, naesteLabel, foersteSaetTekst } from './pauseLinje.js'
import { remainingSeconds } from '../restTimer.js'

const lager = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) } }

test('ordre 1459: 90 sek vises som 1:30, under et minut som 45s', () => {
  assert.equal(visTid(90), '1:30')
  assert.equal(visTid(45), '45s')
})

test('ordre 1459: forklaringen er set først efter markering, storage-fejl er ufarlige', () => {
  const s = lager()
  assert.equal(harSetPauseForklaring(s), false)
  markerPauseForklaring(s)
  assert.equal(harSetPauseForklaring(s), true)
  const kaster = { getItem: () => { throw new Error('x') }, setItem: () => { throw new Error('x') } }
  assert.equal(harSetPauseForklaring(kaster), false)
  assert.doesNotThrow(() => markerPauseForklaring(kaster))
})

test('ordre 1459: tiden regnes fra starttid, 40 s i baggrunden giver 50 s tilbage uden tick', () => {
  const start = 1_000_000
  assert.equal(remainingSeconds(90, start, start + 40_000), 50)
  assert.equal(remainingSeconds(90, start, start + 500_000), 0)
})

test('naesteLabel: foer foerste saet staar der Foerste saet, ikke Naeste', () => {
  assert.equal(naesteLabel({ navn: 'Squat', saetNr: 1, total: 4, intetLogget: true }), 'Første sæt: Squat · sæt 1/4')
  assert.equal(naesteLabel({ navn: 'Squat', saetNr: 2, total: 4, intetLogget: false }), 'Næste: Squat · sæt 2/4')
})

test('ordre 1475: foersteSaetTekst: navn, reps og vaegt; kropsvaegt uden kg', () => {
  assert.equal(foersteSaetTekst({ navn: 'Squat', reps: '4', kg: 80 }), 'Første sæt: Squat, 4 reps @ 80 kg')
  assert.equal(foersteSaetTekst({ navn: 'Squat', reps: 4, kg: '82.5' }), 'Første sæt: Squat, 4 reps @ 82,5 kg')
  assert.equal(foersteSaetTekst({ navn: 'Pull-ups', reps: 6, kg: '' }), 'Første sæt: Pull-ups, 6 reps')
})
