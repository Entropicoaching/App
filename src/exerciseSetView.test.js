import test from 'node:test'
import assert from 'node:assert/strict'
import { exerciseSetView, exerciseViewGroups, exerciseViewRows } from './exerciseSetView.js'
import { nextSetInSession } from './nextSet.js'

for (const [input, name, type] of [
  ['Bænkpres - topsæt', 'Bænkpres', 'top'],
  ['Baenkpres - topsaet', 'Bænkpres', 'top'],
  ['Bænkpres top', 'Bænkpres', 'top'],
  ['Bænkpres (topset)', 'Bænkpres', 'top'],
  ['Bænkpres – topsæt', 'Bænkpres', 'top'],
  [' Bænkpres : TOPSÆT ', 'Bænkpres', 'top'],
  ['Bænkpres - backoff', 'Bænkpres', 'backoff'],
  ['Baenkpres back-off', 'Bænkpres', 'backoff'],
  ['Bænkpres backoff-sæt', 'Bænkpres', 'backoff'],
  ['Bænkpres (backoff-saet)', 'Bænkpres', 'backoff'],
  ['Bænkpres back off set', 'Bænkpres', 'backoff'],
  ['Bænkpres straight sets', 'Bænkpres', 'straight'],
  ['Bænkpres', 'Bænkpres', 'straight'],
  ['Sumo doedloeft - topsaet', 'Sumo dødløft', 'top'],
  ['Pause squat - backoff', 'Pause squat', 'backoff'],
  ['Close-grip bænkpres - topsæt', 'Close-grip bænkpres', 'top'],
]) test(`set view: ${input}`, () => {
  const view = exerciseSetView(input)
  assert.equal(view.name, name)
  assert.equal(view.type, type)
  assert.equal(view.label, type === 'top' ? 'Top' : type === 'backoff' ? 'Backoff' : 'Sæt')
})

test('only set-type suffixes removed; variations/comp/notes stay distinct', () => {
  for (const name of ['Front squat', 'Bænkpres (comp)', 'Bænkpres - teknik-singler', 'Squat - volumen', 'Topsaet', 'Backoff', 'Step-up'])
    assert.equal(exerciseSetView(name).name, name)
  assert.equal(exerciseViewGroups([{ name: 'Squat' }, { name: 'Pause squat' }]).length, 2)
})

const exercises = [
  { id: 'top', name: 'Baenkpres - topsaet', sets: 1, reps: '3', recommended_weight: 100 },
  { id: 'back', name: 'Bænkpres - backoff-sæt', sets: 2, reps: '5', recommended_weight: 80 },
  { id: 'plain', name: 'Bænkpres', sets: 1, reps: '8', recommended_weight: 60 },
]
test('one visual exercise, original prescriptions and identities preserved', () => {
  const snapshot = structuredClone(exercises)
  const groups = exerciseViewGroups(exercises)
  assert.equal(groups.length, 1)
  assert.equal(groups[0].name, 'Bænkpres')
  assert.equal(groups[0].totalSets, 4)
  const rows = exerciseViewRows(exercises)
  assert.deepEqual(rows.map(r => [r.ex.id, r.offset, r.startsGroup, r.endsGroup]), [
    ['top', 0, true, false], ['back', 1, false, false], ['plain', 3, false, true],
  ])
  rows.forEach((r, i) => assert.equal(r.ex, exercises[i]))
  assert.deepEqual(exercises, snapshot)
})

test('old logs with colliding set numbers still resolve each original exercise', () => {
  const logs = [{ exercise_id: 'top', set_number: 1, weight: 100 },
    { exercise_id: 'back', set_number: 1, weight: 80, skipped: true }]
  exerciseViewRows(exercises)
  const next = nextSetInSession({ exercises }, logs)
  assert.equal(next.exercise.id, 'back')
  assert.equal(next.setNumber, 2)
  assert.equal(next.exercise.recommended_weight, 80)
})

test('circuits keep order; null and empty names do not merge', () => {
  const groups = exerciseViewGroups([...exercises, { id: 's', name: 'Squat' }, exercises[0]])
  assert.deepEqual(groups.map(g => g.name), ['Bænkpres', 'Squat', 'Bænkpres'])
  assert.deepEqual(exerciseViewGroups(null), [])
  assert.equal(exerciseViewGroups([{ name: null }, { name: '' }]).length, 2)
})
