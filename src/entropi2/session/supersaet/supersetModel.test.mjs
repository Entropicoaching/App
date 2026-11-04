import test from 'node:test'
import assert from 'node:assert/strict'
import { groupSessionExercises as group } from './supersetModel.mjs'

const ex = (id, sets = 2, note = '', exercise_order = 0) => ({ id, name: `Øvelse ${id}`, sets, note, exercise_order })
const freeze = value => { Object.freeze(value); for (const child of Object.values(value)) if (child && typeof child === 'object') freeze(child); return value }

test('explicit adjacent pair alternates unequal sets and honours longest round pause including zero', () => {
  const input = freeze([ex('b', 2, 'Supersæt: a; Pause 0 sek', 2), ex('a', 3, 'Supersæt: A; Pause 90 sek', 1)])
  const result = group(input)
  assert.deepEqual(result.warnings, [])
  const [g] = result.groups
  assert.equal(g.kind, 'superset'); assert.equal(g.label, 'Supersæt A')
  assert.deepEqual(g.steps.map(s => [s.exerciseId, s.setNumber, s.restAfterSeconds]), [
    ['a', 1, 0], ['b', 1, 90], ['a', 2, 0], ['b', 2, 90], ['a', 3, 90],
  ])
  assert.deepEqual(g.steps.map(s => s.roundEnd), [false, true, false, true, true])
  assert.equal(input[0].id, 'b')
  assert.equal(group([ex('a', 1, 'Cirkel: 0; Pause 0 sek'), ex('b', 1, 'Cirkel: 0')]).groups[0].restSeconds, 0)
})

test('circle preserves stable order and omits exhausted or zero-set members', () => {
  const [g] = group([ex('a', '2', 'Cirkel: B'), ex('b', 0, 'cirkel: b'), ex('c', 1, 'Cirkel: B')]).groups
  assert.equal(g.kind, 'circuit'); assert.equal(g.rounds, 2)
  assert.deepEqual(g.steps.map(s => s.exerciseId), ['a', 'c', 'a'])
  assert.deepEqual(g.steps.map(s => s.restAfterSeconds), [0, null, null])
})

test('unmarked and noncontiguous rows never merge or infer groups from names/free prose', () => {
  const result = group([ex('a', 1, 'Supersæt: A', 0), ex('b', 1, 'Lav supersæt med A', 1), ex('c', 1, 'Supersæt: A', 2)])
  assert.deepEqual(result.groups.map(g => g.kind), ['single', 'single', 'single'])
  assert.equal(result.warnings.length, 2)
  assert.equal(group([{ ...ex('a'), name: 'A1 Squat' }, { ...ex('b'), name: 'A2 Row' }]).groups.length, 2)
  assert.equal(group([ex('a', 1, 'Supersæt: A'), ex('b', 1, 'Cirkel: A')]).groups.length, 2)
})

test('blank, malformed, conflicting and hostile values have explicit safe output', () => {
  assert.deepEqual(group(), { groups: [], warnings: [] })
  assert.equal(group({}).groups.length, 0)
  assert.equal(group([null, 3]).warnings.length, 2)
  for (const sets of [-1, 1.5, Infinity, 'oops', true, {}, 1001, '']) {
    const result = group([ex('a', sets)])
    assert.equal(result.groups[0].members[0].sets, null)
    assert.equal(result.groups[0].steps.length, 0)
    assert.equal(result.warnings.length, 1)
  }
  for (const note of ['Supersæt: A; Supersæt: B', 'Supersæt: A; Cirkel: A', 'Supersæt: A!', 'Supersæt:']) {
    const result = group([ex('a', 1, note), ex('b', 1, note)])
    assert.equal(result.groups.length, 2); assert.equal(result.warnings.length, 2)
  }
})

test('note rest uses copied strict parser, no guessed default and no duration from exercise prose', () => {
  for (const [note, expected] of [['Pause 1:30', 90], ['Hvile: 1,5 min', 90], ['Rest 0 s', 0], ['Hold 30 sek', null], ['Pause 1:99', null], ['Pause -10 sek', null], ['Pause 99999 s', null]]) {
    assert.equal(group([ex('a', 1, note)]).groups[0].restSeconds, expected, note)
  }
  assert.equal(group([ex('a', 1, 'Pause 30 sek; Pause bad')]).warnings.length, 1)
})

test('finite order strings sort stably; missing and invalid order follow ordered rows', () => {
  const rows = [ex('a', 1, '', undefined), ex('b', 1, '', '2'), ex('c', 1, '', '1'), ex('d', 1, '', '2'), ex('e', 1, '', NaN)]
  delete rows[0].exercise_order
  assert.deepEqual(group(rows).groups.flatMap(g => g.steps.map(s => s.exerciseId)), ['c', 'b', 'd', 'a', 'e'])
})
