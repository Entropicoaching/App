import { test } from 'node:test'
import assert from 'node:assert/strict'
import { defaultSetWeight, defaultSetReps, stepWeight, stepReps, stepRepsInInputs, autoFillSetInput } from './setLogDefaults.js'
import { nextAthleteSetInput } from './athleteTrainingInputs.js'

test('defaultSetWeight: en allerede tastet vægt vinder over alt andet', () => {
  assert.equal(defaultSetWeight('82.5', { lastWeight: 100, recommendedWeight: 90 }), '82.5')
})

test('defaultSetWeight: falder tilbage til sidste gang på øvelsen', () => {
  assert.equal(defaultSetWeight('', { lastWeight: 97.5, recommendedWeight: 90 }), '97.5')
})

test('defaultSetWeight: ingen historik → planens anbefalede vægt', () => {
  assert.equal(defaultSetWeight('', { lastWeight: null, recommendedWeight: 90 }), '90')
})

test('defaultSetWeight: hverken historik eller plan → tomt', () => {
  assert.equal(defaultSetWeight('', {}), '')
})

test('defaultSetReps følger samme rækkefølge som defaultSetWeight', () => {
  assert.equal(defaultSetReps('6', { lastReps: 8, planReps: 5 }), '6')
  assert.equal(defaultSetReps('', { lastReps: 8, planReps: 5 }), '8')
  assert.equal(defaultSetReps('', { lastReps: null, planReps: 5 }), '5')
  assert.equal(defaultSetReps('', {}), '')
})

test('stepWeight lægger 2,5 kg til som standard', () => {
  assert.equal(stepWeight('80'), '82.5')
  assert.equal(stepWeight('82.5'), '85')
})

test('stepWeight kan trække fra, og bunder ved 0', () => {
  assert.equal(stepWeight('80', -2.5), '77.5')
  assert.equal(stepWeight('1', -2.5), '0')
  assert.equal(stepWeight('0', -2.5), '0')
})

test('stepWeight tager udgangspunkt i 0 når feltet er tomt', () => {
  assert.equal(stepWeight('', 2.5), '2.5')
})

test('stepWeight undgår float-støj (0.1 + 0.2-problemet)', () => {
  assert.equal(stepWeight('77.5', 2.5), '80')
  assert.equal(stepWeight('97.5', 2.5), '100')
})

test('stepReps lægger 1 til som standard, og bunder ved 0', () => {
  assert.equal(stepReps('5'), '6')
  assert.equal(stepReps('5', -1), '4')
  assert.equal(stepReps('0', -1), '0')
  assert.equal(stepReps('', 1), '1')
})

// ORDRE 293 · F1 — kaldstedet, ikke kun stepReps. Sæt 2 starter med reps ''
// i input-state (nextAthleteSetInput), mens feltet VISER ordinationens
// nederste tal (her 4, fra "4-6"). Ét tryk skal give 4 ± 1, ikke 1 eller 0.
test('stepRepsInInputs: sæt 2 (reps tom i state) — ét tryk på plus giver det viste tal + 1', () => {
  const set1 = { weight: '80', note: '', rpe: '', reps: '4' }
  const inputs = { ex1_2: nextAthleteSetInput(set1, undefined) }
  assert.equal(inputs.ex1_2.reps, '')
  const shown = inputs.ex1_2
  const after = stepRepsInInputs(inputs, 'ex1_2', shown, '4', 1)
  assert.equal(after.ex1_2.reps, '5')
  assert.equal(after.ex1_2.weight, '80', 'vægten skal føres uændret med')
  const down = stepRepsInInputs(inputs, 'ex1_2', shown, '4', -1)
  assert.equal(down.ex1_2.reps, '3')
})

test('stepRepsInInputs: en allerede tastet/trinnet værdi vinder over det viste tal', () => {
  const inputs = { ex1_2: { weight: '80', note: '', rpe: '', reps: '7' } }
  assert.equal(stepRepsInInputs(inputs, 'ex1_2', inputs.ex1_2, '4', 1).ex1_2.reps, '8')
})

test('stepRepsInInputs: ingen post i state endnu → starter fra det viste tal og rører ikke andre sæt', () => {
  const inputs = { ex1_1: { weight: '80', note: '', rpe: '', reps: '4' } }
  const shown = { weight: '', note: '', rpe: '', reps: '' }
  const after = stepRepsInInputs(inputs, 'ex1_2', shown, '4', 1)
  assert.equal(after.ex1_2.reps, '5')
  assert.equal(after.ex1_1.reps, '4')
})

// ORDRE 293 · F3 — første øvelse åbnes før historikken er hentet (planens tal),
// og skal skifte til "sidste gang" når historikken ankommer, men aldrig røre
// noget atleten selv har gjort.
const PLAN = { weightDefault: '80', repsDefault: '4' }
const SIDSTE = { weightDefault: '95', repsDefault: '5' }

test('autoFillSetInput: tomt felt udfyldes (som før)', () => {
  assert.deepEqual(
    autoFillSetInput({ current: undefined, lastAuto: undefined, touched: false, ...PLAN }),
    { weight: '80', note: '', rpe: '', reps: '4' },
  )
})

test('autoFillSetInput: planens forudfyldning byttes ud med sidste gang når historikken ankommer', () => {
  const foerste = autoFillSetInput({ current: undefined, lastAuto: undefined, touched: false, ...PLAN })
  const lastAuto = { weight: foerste.weight, reps: foerste.reps }
  const efterHistorik = autoFillSetInput({ current: foerste, lastAuto, touched: false, ...SIDSTE })
  assert.equal(efterHistorik.weight, '95')
  assert.equal(efterHistorik.reps, '5')
})

test('autoFillSetInput: kører historikken igen uden nyt at sige, sker der intet', () => {
  const current = { weight: '95', note: '', rpe: '', reps: '5' }
  assert.equal(autoFillSetInput({ current, lastAuto: { weight: '95', reps: '5' }, touched: false, ...SIDSTE }), null)
})

test('autoFillSetInput: aldrig over noget atleten har trykket/tastet (touched), heller ikke et tømt felt', () => {
  const trinnet = { weight: '82.5', note: '', rpe: '', reps: '4' }
  assert.equal(autoFillSetInput({ current: trinnet, lastAuto: { weight: '80', reps: '4' }, touched: true, ...SIDSTE }), null)
  const tomt = { weight: '', note: '', rpe: '', reps: '' }
  assert.equal(autoFillSetInput({ current: tomt, lastAuto: { weight: '80', reps: '4' }, touched: true, ...SIDSTE }), null)
})

test('autoFillSetInput: en værdi der ikke er vores egen forudfyldning (fx tastet i Program-fanen) bliver stående', () => {
  const tastet = { weight: '70', note: '', rpe: '', reps: '' }
  assert.equal(autoFillSetInput({ current: tastet, lastAuto: undefined, touched: false, ...SIDSTE }), null)
  assert.equal(autoFillSetInput({ current: tastet, lastAuto: { weight: '80', reps: '4' }, touched: false, ...SIDSTE }), null)
})

test('autoFillSetInput: bevarer note og RPE når forudfyldningen byttes', () => {
  const current = { weight: '80', note: 'stram ryg', rpe: '8', reps: '4' }
  const ny = autoFillSetInput({ current, lastAuto: { weight: '80', reps: '4' }, touched: false, ...SIDSTE })
  assert.deepEqual(ny, { weight: '95', note: 'stram ryg', rpe: '8', reps: '5' })
})

test('autoFillSetInput: hverken plan eller historik → rører ikke noget', () => {
  assert.equal(autoFillSetInput({ current: undefined, lastAuto: undefined, touched: false, weightDefault: '', repsDefault: '' }), null)
})
