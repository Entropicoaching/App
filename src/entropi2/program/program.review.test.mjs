import test from 'node:test'
import assert from 'node:assert/strict'
import { programModel } from './programModel.mjs'

// Separate counterexamples, importing the final production projection directly.
test('all seven day positions and undated sessions survive without sorting or date inference', () => {
  const sessions = [6, 0, null, 2, 1, 5, 4, 3].map(weekday => ({ weekday, exercises: [] }))
  assert.deepEqual(programModel({ sessions }).sessions.map(s => s.day),
    ['Søndag', 'Mandag', 'Dag ikke fastlagt', 'Onsdag', 'Tirsdag', 'Lørdag', 'Fredag', 'Torsdag'])
})
test('invalid rows cannot establish a rest session and malformed numbers stay unknown', () => {
  const model = programModel({ sessions: [null, {}, { exercises: [] }, { exercises: [null, { sets: NaN, reps: {}, intensity: false }] }] })
  assert.deepEqual(model.sessions.map(s => s.kind), ['incomplete', 'incomplete', 'rest', 'training'])
  assert.equal(model.sessions[3].exercises[1].sets, 'Sæt ikke angivet')
  assert.equal(model.sessions[3].exercises[1].reps, '')
})
test('long literal prescriptions, timed work and independent targets are retained', () => {
  const name = 'Øvelse'.repeat(100)
  const { exercises } = programModel({ sessions: [{ exercises: [
    { name, sets: 2, reps: '1:30', intensity: '70–75 %', recommended_weight: 25.25 },
    { name, sets: 3, reps: 'AMRAP', intensity: 'Stop med 2 gentagelser tilbage' },
  ] }] }).sessions[0]
  assert.equal(exercises[0].name, name)
  assert.equal(exercises[0].reps, '1:30')
  assert.equal(exercises[0].intensity, '70–75 %')
  assert.equal(exercises[0].weight, '25,25 kg')
  assert.equal(exercises[1].sets, '3 sæt')
  assert.equal(exercises[1].weight, '')
})
