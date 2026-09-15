// ORDRE 185, commit 1. Egen lille weeks-fixture (ikke e2e/fixtures.mjs —
// dens seed-uge har bevidst ingen start_date, se dens egen kommentar, så
// den kan ikke placeres i et kalendervindue). Formen matcher Dashboard.jsx's
// fetchWeeks (weeks→sessions→exercises), kun de felter planlagt.js læser.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { beregnPlanlagtDenneUge, beregnPlanlagtPrUge } from './planlagt.js'
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

// ---- ORDRE 210, commit 1: beregnPlanlagtPrUge (hele forløbet) ----

function log(oevelseNavn, loggetDato, skipped = false) {
  return { oevelseNavn, loggetDato, skipped }
}

test('planlagt og gennemført side om side, pr. kalenderuge, ældste først', () => {
  const ugeA = '2026-09-14' // mandag
  const ugeB = '2026-09-21' // mandag, ugen efter
  const weeks = [ugeMedSquat(ugeA, 4), ugeMedSquat(ugeB, 4)]
  const logs = [log('Squat', ugeA), log('Squat', ugeA), log('Squat', ugeB)]
  const resultat = beregnPlanlagtPrUge(weeks, logs)
  assert.equal(resultat.uger.length, 2)
  assert.equal(resultat.uger[0].uge, ugenoegle(ugeA))
  assert.equal(resultat.uger[1].uge, ugenoegle(ugeB))
  assert.deepEqual(resultat.uger[0].planlagt.grupper.kneeExtensors, { direkte: 4, ialt: 4 })
  assert.deepEqual(resultat.uger[0].gennemfoert.grupper.kneeExtensors, { direkte: 2, ialt: 2 })
  assert.deepEqual(resultat.uger[1].gennemfoert.grupper.kneeExtensors, { direkte: 1, ialt: 1 })
  assert.equal(resultat.ugerUdenDato, 0)
})

test('uger uden start_date udelades fra uger[], men tælles i ugerUdenDato', () => {
  const weeks = [ugeMedSquat(I_DAG, 4), { start_date: null, sessions: [] }, { start_date: undefined, sessions: [] }]
  const resultat = beregnPlanlagtPrUge(weeks, [])
  assert.equal(resultat.uger.length, 1)
  assert.equal(resultat.ugerUdenDato, 2)
})

test('overlappende programuger (samme kalenderuge) summeres i én bucket, ikke to rækker', () => {
  const weeks = [ugeMedSquat(I_DAG, 2), ugeMedSquat(I_DAG, 2)]
  const resultat = beregnPlanlagtPrUge(weeks, [])
  assert.equal(resultat.uger.length, 1)
  assert.deepEqual(resultat.uger[0].planlagt.grupper.kneeExtensors, { direkte: 4, ialt: 4 })
})

test('tom programuge (ingen sessioner) er stadig med, alle tal 0', () => {
  const weeks = [{ start_date: I_DAG, sessions: [] }]
  const resultat = beregnPlanlagtPrUge(weeks, [])
  assert.equal(resultat.uger.length, 1)
  assert.deepEqual(resultat.uger[0].planlagt.grupper, {})
  assert.deepEqual(resultat.uger[0].gennemfoert.grupper, {})
})

test('program med huller: kun de daterede uger giver rækker, ingen opdigtede nul-uger imellem', () => {
  const ugeA = '2026-08-31' // mandag
  const ugeC = '2026-09-21' // tre uger senere, ingen dateret uge for ugen imellem
  const weeks = [ugeMedSquat(ugeA, 3), ugeMedSquat(ugeC, 3)]
  const resultat = beregnPlanlagtPrUge(weeks, [])
  assert.equal(resultat.uger.length, 2)
  assert.equal(resultat.uger[0].uge, ugenoegle(ugeA))
  assert.equal(resultat.uger[1].uge, ugenoegle(ugeC))
})

test('gennemførte sæt i en kalenderuge uden dateret programuge tælles ikke med', () => {
  const weeks = [ugeMedSquat(I_DAG, 4)]
  const enUgeFoer = '2026-09-07'
  const logs = [log('Squat', enUgeFoer)]
  const resultat = beregnPlanlagtPrUge(weeks, logs)
  assert.equal(resultat.uger.length, 1)
  assert.deepEqual(resultat.uger[0].gennemfoert.grupper, {})
})

test('skipped-sæt tælles ikke med i gennemført, samme regel som beregn.js', () => {
  const weeks = [ugeMedSquat(I_DAG, 4)]
  const logs = [log('Squat', I_DAG, true)]
  const resultat = beregnPlanlagtPrUge(weeks, logs)
  assert.deepEqual(resultat.uger[0].gennemfoert.grupper, {})
})

test('ukendt øvelse tælles i ukendteSaet for planlagt og gennemført hver for sig', () => {
  const weeks = [{ start_date: I_DAG, sessions: [{ exercises: [{ name: 'Fuglehund med kætte', sets: 3 }] }] }]
  const logs = [log('Fuglehund med kætte', I_DAG)]
  const resultat = beregnPlanlagtPrUge(weeks, logs)
  assert.equal(resultat.uger[0].planlagt.ukendteSaet, 3)
  assert.equal(resultat.uger[0].gennemfoert.ukendteSaet, 1)
})

test('rettelser gives videre til både planlagt og gennemført', () => {
  const weeks = [{ start_date: I_DAG, sessions: [{ exercises: [{ name: 'Zercher squat', sets: 3 }] }] }]
  const logs = [log('Zercher squat', I_DAG)]
  const rettelser = new Map([['zercher squat', { grupper: [{ gruppe: 'kneeExtensors', andel: 1 }] }]])
  const resultat = beregnPlanlagtPrUge(weeks, logs, { rettelser })
  assert.equal(resultat.uger[0].planlagt.ukendteSaet, 0)
  assert.deepEqual(resultat.uger[0].planlagt.grupper.kneeExtensors, { direkte: 3, ialt: 3 })
  assert.equal(resultat.uger[0].gennemfoert.ukendteSaet, 0)
  assert.deepEqual(resultat.uger[0].gennemfoert.grupper.kneeExtensors, { direkte: 1, ialt: 1 })
})

test('tomt weeks og tomt logs: tom uger-liste, ingen fejl', () => {
  const resultat = beregnPlanlagtPrUge([], [])
  assert.deepEqual(resultat.uger, [])
  assert.equal(resultat.ugerUdenDato, 0)
})
