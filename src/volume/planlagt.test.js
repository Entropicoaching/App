// ORDRE 185, commit 1. Egen lille weeks-fixture (ikke e2e/fixtures.mjs —
// dens seed-uge har bevidst ingen start_date, se dens egen kommentar, så
// den kan ikke placeres i et kalendervindue). Formen matcher Dashboard.jsx's
// fetchWeeks (weeks→sessions→exercises), kun de felter planlagt.js læser.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { beregnPlanlagtDenneUge } from './planlagt.js'
import { ugenoegle } from './beregn.js'

const I_DAG = '2026-09-14' // mandag i "denne uge" til testene

function ugeMedSquat(startDate, sets) {
  return {
    start_date: startDate,
    sessions: [{ exercises: [{ name: 'Squat', sets }] }],
  }
}

test('kendt øvelse: planlagte sæt ganges med andel, ligesom gennemførte sæt i beregn.js', () => {
  const uger = [ugeMedSquat(I_DAG, 4)]
  const resultat = beregnPlanlagtDenneUge(uger, { referenceDato: I_DAG })
  assert.equal(resultat.uge, ugenoegle(I_DAG))
  assert.equal(resultat.ugePlaceret, true)
  assert.deepEqual(resultat.grupper.kneeExtensors, { direkte: 4, ialt: 4 })
  assert.deepEqual(resultat.grupper.hipExtensors, { direkte: 4, ialt: 4 })
  assert.deepEqual(resultat.grupper.backExtensors, { direkte: 0, ialt: 2 }) // 4 × 0,5
  assert.equal(resultat.ukendteSaet, 0)
})

test('uge uden start_date kan ikke placeres — ugePlaceret er false, ikke bare 0 planlagt', () => {
  const uger = [{ start_date: null, sessions: [{ exercises: [{ name: 'Squat', sets: 4 }] }] }]
  const resultat = beregnPlanlagtDenneUge(uger, { referenceDato: I_DAG })
  assert.equal(resultat.ugePlaceret, false)
  assert.deepEqual(resultat.grupper, {})
})

test('uge i en anden kalenderuge tælles ikke med i denne uges tal', () => {
  const enUgeFoer = '2026-09-07'
  const uger = [ugeMedSquat(enUgeFoer, 4)]
  const resultat = beregnPlanlagtDenneUge(uger, { referenceDato: I_DAG })
  assert.equal(resultat.ugePlaceret, false)
  assert.deepEqual(resultat.grupper, {})
})

test('ukendt øvelse tælles i ukendteSaet (i sæt-enheder, ikke øvelses-enheder)', () => {
  const uger = [{ start_date: I_DAG, sessions: [{ exercises: [{ name: 'Fuglehund med kætte', sets: 3 }] }] }]
  const resultat = beregnPlanlagtDenneUge(uger, { referenceDato: I_DAG })
  assert.equal(resultat.ukendteSaet, 3)
  assert.deepEqual(resultat.grupper, {})
})

test('øvelse med 0 eller manglende sets bidrager intet, men ugen tælles stadig som placeret', () => {
  const uger = [{ start_date: I_DAG, sessions: [{ exercises: [{ name: 'Squat', sets: 0 }, { name: 'Squat' }] }] }]
  const resultat = beregnPlanlagtDenneUge(uger, { referenceDato: I_DAG })
  assert.equal(resultat.ugePlaceret, true)
  assert.deepEqual(resultat.grupper, {})
  assert.equal(resultat.ukendteSaet, 0)
})

test('flere sessioner/øvelser i samme uge summeres', () => {
  const uge = {
    start_date: I_DAG,
    sessions: [
      { exercises: [{ name: 'Squat', sets: 3 }] },
      { exercises: [{ name: 'Bænkpres', sets: 3 }] },
    ],
  }
  const resultat = beregnPlanlagtDenneUge([uge], { referenceDato: I_DAG })
  assert.deepEqual(resultat.grupper.kneeExtensors, { direkte: 3, ialt: 3 })
  assert.deepEqual(resultat.grupper.pectoralisMajor, { direkte: 3, ialt: 3 })
  assert.deepEqual(resultat.grupper.triceps, { direkte: 0, ialt: 1.5 })
})

test('flere programuger med start_date i samme kalenderuge summeres begge (fx uge-flyt)', () => {
  const uger = [ugeMedSquat(I_DAG, 2), ugeMedSquat(I_DAG, 2)]
  const resultat = beregnPlanlagtDenneUge(uger, { referenceDato: I_DAG })
  assert.deepEqual(resultat.grupper.kneeExtensors, { direkte: 4, ialt: 4 })
})

test('rettelser gives videre til slaaOevelseOp — en Marc-kortlagt ukendt øvelse tælles nu med', () => {
  const uger = [{ start_date: I_DAG, sessions: [{ exercises: [{ name: 'Zercher squat', sets: 3 }] }] }]
  const rettelser = new Map([['zercher squat', { grupper: [{ gruppe: 'kneeExtensors', andel: 1 }] }]])
  const resultat = beregnPlanlagtDenneUge(uger, { referenceDato: I_DAG, rettelser })
  assert.equal(resultat.ukendteSaet, 0)
  assert.deepEqual(resultat.grupper.kneeExtensors, { direkte: 3, ialt: 3 })
})

test('tomt weeks-array: ugePlaceret false, ingen fejl', () => {
  const resultat = beregnPlanlagtDenneUge([], { referenceDato: I_DAG })
  assert.equal(resultat.ugePlaceret, false)
  assert.deepEqual(resultat.grupper, {})
  assert.equal(resultat.ukendteSaet, 0)
})
