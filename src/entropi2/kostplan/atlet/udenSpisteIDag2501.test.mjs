import test from 'node:test'
import assert from 'node:assert/strict'
import { udenSpisteIDag } from './kostIDagModel.mjs'

const plan = [{ id: 'a', name: 'Aftensmad', eaten: true }, { id: 'f', name: 'Frokost' }, { id: 'm', name: 'Morgenmad' }]
const meals = [{ meal: 'Aftensmad' }, { meal: 'frokost ' }, { meal: 'Morgenmad' }, { meal: 'Snack' }]

test('2501: spist eller logget planmåltid skjules i Spist igen, resten står', () => {
  assert.deepEqual(udenSpisteIDag(meals, plan, new Set(['f'])).map(m => m.meal), ['Morgenmad', 'Snack'])
})
test('2501: uden spiste planmåltider er listen uændret', () => {
  assert.equal(udenSpisteIDag(meals, plan, new Set()).length, 3)
  assert.equal(udenSpisteIDag(meals, [], new Set()), meals)
})
