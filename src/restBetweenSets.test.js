import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseRestSecondsFromNote, restSecondsForExercise } from './restBetweenSets.js'

test('parseRestSecondsFromNote genkender "pause 90 sek"', () => {
  assert.equal(parseRestSecondsFromNote('Pause 90 sek mellem sæt'), 90)
})

test('parseRestSecondsFromNote genkender "hvile 2 min"', () => {
  assert.equal(parseRestSecondsFromNote('hvile 2 min'), 120)
})

test('parseRestSecondsFromNote genkender "rest 1:30" (min:sek)', () => {
  assert.equal(parseRestSecondsFromNote('rest 1:30'), 90)
})

test('parseRestSecondsFromNote genkender decimal-minutter med komma', () => {
  assert.equal(parseRestSecondsFromNote('Pause 1,5 min'), 90)
})

test('parseRestSecondsFromNote er case-uafhængig og tåler kolon/mellemrum', () => {
  assert.equal(parseRestSecondsFromNote('PAUSE: 60s'), 60)
})

test('parseRestSecondsFromNote returnerer null uden pause-nøgleord', () => {
  assert.equal(parseRestSecondsFromNote('Hold spændet i maven'), null)
  assert.equal(parseRestSecondsFromNote('90 sek'), null) // intet pause/hvile/rest-ord
})

test('parseRestSecondsFromNote returnerer null for tom/manglende note', () => {
  assert.equal(parseRestSecondsFromNote(''), null)
  assert.equal(parseRestSecondsFromNote(null), null)
  assert.equal(parseRestSecondsFromNote(undefined), null)
})

test('restSecondsForExercise bruger noten når den findes', () => {
  assert.equal(restSecondsForExercise({ note: 'Pause 120 sek' }), 120)
})

test('restSecondsForExercise falder tilbage til en fornuftig standard uden note-match', () => {
  assert.equal(restSecondsForExercise({ note: 'Hold ryggen neutral' }), 90)
  assert.equal(restSecondsForExercise({}), 90)
  assert.equal(restSecondsForExercise(null), 90)
})
