import test from 'node:test'
import assert from 'node:assert/strict'
import { exerciseSetView, exerciseViewGroups, exerciseViewRows, bestExerciseRecords, mainLiftName } from './exerciseSetView.js'
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
  for (const name of ['Front squat', 'Pause baenkpres', 'Rumaensk doedloeft', 'Topsaet', 'Backoff', 'Step-up'])
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

for (const [input, type] of [
  ['Baenkpres Top set', 'top'], ['Baenkpres (top set)', 'top'],
  ['Back-off Baenkpres', 'backoff'], ['Topsaet Baenkpres', 'top'],
  ['Baenkpres, top', 'top'],
]) test(`QA 1317 parser: ${input}`, () => {
  assert.equal(exerciseSetView(input).name, 'B\u00e6nkpres')
  assert.equal(exerciseSetView(input).type, type)
})

test('home records combine set types and preserve the best original load/reps', () => {
  const records = [
    { exercise_name: 'Baenkpres Top set', weight: 100, reps: 3 },
    { exercise_name: 'Back-off Baenkpres', weight: 80, reps: 5 },
    { exercise_name: 'Baenkpres', weight: 100, reps: 4 },
    { exercise_name: 'Pause squat', weight: 60, reps: 5 },
  ]
  const copy = structuredClone(records)
  assert.deepEqual(bestExerciseRecords(records), [
    { name: 'B\u00e6nkpres', weight: 100, reps: 4 },
    { name: 'Pause squat', weight: 60, reps: 5 },
  ])
  assert.deepEqual(records, copy)
})

test('identical adjacent prescriptions display once; differing prescriptions stay visible', () => {
  const base = { sets: 1, reps: '3', intensity: 'RPE 8', recommended_weight: 100 }
  const rows = exerciseViewRows([
    { ...base, name: 'Baenkpres Top set' },
    { ...base, name: 'Back-off Baenkpres' },
    { ...base, name: 'Baenkpres' },
    { ...base, name: 'Baenkpres', recommended_weight: 80 },
  ])
  assert.deepEqual(rows.map(r => r.showPrescription), [true, false, false, true])
})

// Ordre 1390 (QA 1378 fund 1+2): programlaegningens egne suffikser og tilfaeldige
// stavemaader skal ende i det rigtige hovedloeft - ellers falder de ud af 1RM-kurverne.
for (const [input, lift] of [
  ['Baenkpres (comp)', 'Bænkpres'], ['Bænkpres - comp', 'Bænkpres'], ['Baenkpres - volumen', 'Bænkpres'],
  ['Bænkpres - primaer', 'Bænkpres'], ['Baenkpres - teknik-singler', 'Bænkpres'],
  ['Squat (comp)', 'Squat'], ['Squat - comp', 'Squat'], ['Squat - volumen', 'Squat'],
  ['Squat - primær', 'Squat'], ['Squat - teknik-singler', 'Squat'],
  ['Doedloeft (comp)', 'Dødløft'], ['Doedloeft - primaer', 'Dødløft'], ['Dødløft - volumen', 'Dødløft'],
  ['Konventionel doedloeft - comp', 'Dødløft'], ['Konventionel doedloeft - teknik-singler', 'Dødløft'],
  ['Sumo doedloeft (comp)', 'Sumo dødløft'], ['Sumo doedloeft - volumen', 'Sumo dødløft'],
  ['Sumo doedloeft - primaer', 'Sumo dødløft'], ['Sumo dødløft - teknik-singler', 'Sumo dødløft'],
  ['Squat (comp) - topsaet', 'Squat'], ['Baenkpres topsaet 1', 'Bænkpres'], ['Squat backoff 2', 'Squat'],
  ['Baenkpres - saet 2', 'Bænkpres'], ['Doedloeft (sumo)', 'Sumo dødløft'],
  ['Doedloeft - sumo topsaet', 'Sumo dødløft'], ['Back squat', 'Squat'], ['Competition squat', 'Squat'],
]) test(`main lift folds: ${input}`, () => assert.equal(mainLiftName(input), lift))

test('varianter med suffiks er stadig ikke hovedloeft', () => {
  for (const n of ['Pause baenkpres - primaer', 'Front squat - volumen', 'Rumaensk doedloeft (comp)', 'Close-grip baenkpres - comp', 'Topsaet'])
    assert.equal(mainLiftName(n), null)
})

test('bestExerciseRecords samler suffiks-navne i eet loeft', () => {
  const best = bestExerciseRecords([
    { exercise_name: 'Squat - volumen', weight: 100, reps: 5 },
    { exercise_name: 'Squat (comp)', weight: 120, reps: 3 },
    { exercise_name: 'Squat', weight: 110, reps: 3 },
  ])
  assert.deepEqual(best, [{ name: 'Squat', weight: 120, reps: 3 }])
})
