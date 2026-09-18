import { test } from 'node:test'
import assert from 'node:assert/strict'
import { defaultSetWeight, defaultSetReps, stepWeight, stepReps } from './setLogDefaults.js'

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
