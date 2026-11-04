import test from 'node:test'
import assert from 'node:assert/strict'
import { groupSessionExercises } from './supersetModel.mjs'

// Independent invariants over synthetic program combinations, actual import.
test('64 three-member circuits conserve every prescribed set and round boundary', () => {
  for (let a = 0; a <= 3; a++) for (let b = 0; b <= 3; b++) for (let c = 0; c <= 3; c++) {
    const counts = [a, b, c]
    const rows = counts.map((sets, i) => ({ id: `e${i}`, name: `Øvelse ${i}`, sets,
      exercise_order: i, note: 'Cirkel: invariant; Pause 45 sek' }))
    const original = JSON.stringify(rows)
    const result = groupSessionExercises(rows)
    assert.equal(JSON.stringify(rows), original)
    assert.deepEqual(result.warnings, [])
    const [group] = result.groups
    assert.equal(group.steps.length, a + b + c)
    assert.equal(new Set(group.steps.map(s => `${s.exerciseId}/${s.setNumber}`)).size, a + b + c)
    counts.forEach((n, i) => assert.deepEqual(group.steps.filter(s => s.exerciseId === `e${i}`).map(s => s.setNumber), Array.from({ length: n }, (_, j) => j + 1)))
    for (let round = 1; round <= Math.max(a, b, c); round++) {
      const actual = group.steps.filter(s => s.round === round)
      assert.deepEqual(actual.map(s => s.exerciseId), counts.flatMap((n, i) => n >= round ? [`e${i}`] : []))
      assert.equal(actual.at(-1).restAfterSeconds, 45)
      assert.equal(actual.at(-1).roundEnd, true)
      assert.ok(actual.slice(0, -1).every(s => s.restAfterSeconds === 0 && !s.roundEnd))
    }
  }
})

test('unreadable row fails closed and incomplete group never gives partial instructions', () => {
  const row = sets => ({ name: 'Øvelse', sets, note: 'Supersæt: A' })
  assert.deepEqual(groupSessionExercises([row(2), null, row(2)]).groups, [])
  const result = groupSessionExercises([row(2), row('invalid')])
  assert.equal(result.groups[0].members.length, 2)
  assert.equal(result.groups[0].steps.length, 0)
  assert.equal(result.warnings.length, 1)
})

test('result mutation cannot change caller rows or a later invocation', () => {
  const rows = [{ id: 'x', name: 'Øvelse', sets: 1 }]
  const first = groupSessionExercises(rows)
  first.groups[0].members[0].name = 'Changed'
  first.groups[0].steps.length = 0
  assert.equal(rows[0].name, 'Øvelse')
  assert.equal(groupSessionExercises(rows).groups[0].steps.length, 1)
})
